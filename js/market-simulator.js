import { gameState } from './game-state.js';
import { markets, ensureStockMetadata } from './stock.js';
import { createOrder, orderBook, tradeHistory, initOrderBook, resetOrderBook } from './order-book.js';

const MARKET_STATE_KEY = 'stockGameRealisticMarketState';
const MARKET_STATE_VERSION = 2;
const TRADER_COUNT = 100;
const LEADERBOARD_LIMIT = 18;
const MAX_HISTORY_LENGTH = 100;
const TRADERS_PER_STOCK = 12;
const MARKET_MAKERS_PER_STOCK = 3;
const MARKET_MAKER_QUOTE_LEVELS = 3;
const MIN_VISIBLE_LEVELS_PER_SIDE = 3;
const INITIAL_TRADER_KRW = 3_000_000;
const DEFAULT_EXCHANGE_RATE = 1300;

const STRATEGIES = {
    market_maker: {
        label: '유동성 공급',
        isMarketMaker: true
    },
    momentum: {
        label: '추세 추종'
    },
    value: {
        label: '가치 매매'
    },
    contrarian: {
        label: '역추세'
    },
    swing: {
        label: '스윙'
    }
};

const STRATEGY_COUNTS = [
    ['market_maker', 12],
    ['momentum', 24],
    ['value', 24],
    ['contrarian', 20],
    ['swing', 20]
];

export const marketSimulationState = {
    traders: []
};

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
    return min + Math.random() * (max - min);
}

function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function sample(array, count) {
    return shuffle(array).slice(0, Math.max(0, count));
}

function getCurrencyForMarket(marketId) {
    return marketId === 'korea' ? 'krw' : 'usd';
}

function getTickSize(marketId) {
    return marketId === 'korea' ? 100 : 0.01;
}

function roundPrice(price, marketId) {
    if (marketId === 'korea') {
        return Math.max(100, Math.round(price / 100) * 100);
    }

    return Math.max(0.01, Math.round(price * 100) / 100);
}

function formatTraderName(index, strategyKey) {
    const strategyCode = {
        market_maker: 'MM',
        momentum: 'MO',
        value: 'VL',
        contrarian: 'CT',
        swing: 'SW'
    }[strategyKey] || 'TR';

    return `${strategyCode}-${String(index + 1).padStart(3, '0')}`;
}

function getInitialTraderCash(focus, exchangeRate = gameState.exchangeRate) {
    const effectiveExchangeRate = Number.isFinite(exchangeRate) && exchangeRate > 0
        ? exchangeRate
        : DEFAULT_EXCHANGE_RATE;
    const krwShare = {
        korea: 1,
        both: 0.55,
        usa: 0.35
    }[focus] ?? 1;
    const krwCash = Math.round(INITIAL_TRADER_KRW * krwShare);
    const usdValueInKrw = Math.max(0, INITIAL_TRADER_KRW - krwCash);
    const usdCash = Number((usdValueInKrw / effectiveExchangeRate).toFixed(2));

    return {
        krw: krwCash,
        usd: usdCash
    };
}

function createTrader(index, strategyKey) {
    const strategy = STRATEGIES[strategyKey];
    const focus = strategyKey === 'market_maker'
        ? 'both'
        : index % 5 === 0
            ? 'both'
            : index % 2 === 0
                ? 'korea'
                : 'usa';
    const initialCash = getInitialTraderCash(focus);

    return {
        id: `trader_${index + 1}`,
        name: formatTraderName(index, strategyKey),
        strategy: strategyKey,
        strategyLabel: strategy.label,
        focus,
        cash: {
            krw: initialCash.krw,
            usd: initialCash.usd
        },
        holdings: {},
        reservedCash: {
            krw: 0,
            usd: 0
        },
        reservedHoldings: {},
        initialAssetsKrw: 0,
        tradeCount: 0
    };
}

function buildInitialTraders() {
    const traders = [];
    let index = 0;

    STRATEGY_COUNTS.forEach(([strategyKey, count]) => {
        for (let i = 0; i < count; i++) {
            traders.push(createTrader(index, strategyKey));
            index++;
        }
    });

    return traders;
}

function normalizeTrader(trader) {
    trader.cash = {
        krw: Number(trader.cash?.krw || 0),
        usd: Number(trader.cash?.usd || 0)
    };
    trader.holdings = trader.holdings || {};
    trader.reservedCash = {
        krw: 0,
        usd: 0
    };
    trader.reservedHoldings = {};
    trader.tradeCount = Number(trader.tradeCount || 0);
    trader.strategyLabel = STRATEGIES[trader.strategy]?.label || trader.strategyLabel || '트레이더';
    trader.initialAssetsKrw = Number(trader.initialAssetsKrw || 0);
    return trader;
}

function getTraderById(traderId) {
    return marketSimulationState.traders.find(trader => trader.id === traderId) || null;
}

function traderCanTradeMarket(trader, marketId) {
    return trader.focus === 'both' || trader.focus === marketId;
}

function getTraderHolding(trader, stockId) {
    return Number(trader.holdings[stockId] || 0);
}

function getTraderReservedHolding(trader, stockId) {
    return Number(trader.reservedHoldings[stockId] || 0);
}

function getTraderAvailableHolding(trader, stockId) {
    return Math.max(0, getTraderHolding(trader, stockId) - getTraderReservedHolding(trader, stockId));
}

function getTraderAvailableCash(trader, currency) {
    return Math.max(0, Number(trader.cash[currency] || 0) - Number(trader.reservedCash[currency] || 0));
}

function reserveTraderCash(trader, currency, amount) {
    trader.reservedCash[currency] = Number(trader.reservedCash[currency] || 0) + amount;
}

function reserveTraderHolding(trader, stockId, quantity) {
    trader.reservedHoldings[stockId] = getTraderReservedHolding(trader, stockId) + quantity;
}

function releaseAllReservations() {
    marketSimulationState.traders.forEach(trader => {
        trader.reservedCash.krw = 0;
        trader.reservedCash.usd = 0;
        trader.reservedHoldings = {};
    });
}

function ensureBook(stockId, marketId) {
    if (!orderBook[marketId][stockId]) {
        initOrderBook(stockId, marketId);
    }

    if (!tradeHistory[marketId][stockId]) {
        tradeHistory[marketId][stockId] = [];
    }
}

function clearMarketBooks(marketId) {
    markets[marketId].forEach(stock => {
        ensureBook(stock.id, marketId);
        orderBook[marketId][stock.id].buyOrders = [];
        orderBook[marketId][stock.id].sellOrders = [];
    });
}

function getDistributedShares(stockId) {
    const traderShares = marketSimulationState.traders.reduce((total, trader) => {
        return total + getTraderHolding(trader, stockId);
    }, 0);
    const playerShares = Number(gameState.holdings[stockId]?.quantity || 0);

    return traderShares + playerShares;
}

function getUndistributedShares(stock) {
    return Math.max(0, Number(stock.totalShares || 0) - getDistributedShares(stock.id));
}

function getTargetBookQuantity(stock) {
    const targetNotional = stock.market === 'korea' ? 1_200_000 : 900;
    const minQuantity = stock.market === 'korea' ? 5 : 3;
    const maxQuantity = stock.market === 'korea' ? 180 : 140;
    const calculatedQuantity = Math.floor(targetNotional / Math.max(stock.price, getTickSize(stock.market)));
    return Math.max(minQuantity, Math.min(maxQuantity, calculatedQuantity));
}

function getMarketMakersForMarket(marketId) {
    return shuffle(marketSimulationState.traders.filter(trader => {
        return traderCanTradeMarket(trader, marketId) && trader.strategy === 'market_maker';
    }));
}

function spendTraderCash(trader, currency, amount) {
    if (currency === 'usd') {
        trader.cash.usd = Number(Math.max(0, trader.cash.usd - amount).toFixed(2));
        return;
    }

    trader.cash.krw = Math.max(0, Math.round(trader.cash.krw - amount));
}

function seedTraderInventory(trader, stock, allocationRatio) {
    const currency = getCurrencyForMarket(stock.market);
    const availableCash = Number(trader.cash[currency] || 0);
    if (availableCash < stock.price) {
        return 0;
    }

    const maxAffordable = Math.floor(availableCash / stock.price);
    const targetBudget = availableCash * allocationRatio;
    const targetQuantity = Math.max(1, Math.floor(targetBudget / stock.price));
    const quantity = Math.min(maxAffordable, targetQuantity);

    if (quantity <= 0) {
        return 0;
    }

    spendTraderCash(trader, currency, quantity * stock.price);
    trader.holdings[stock.id] = getTraderHolding(trader, stock.id) + quantity;
    return quantity;
}

function topUpMarketMakerInventory(stock) {
    const marketMakers = getMarketMakersForMarket(stock.market);
    if (marketMakers.length === 0) {
        return;
    }

    const targetInventory = getTargetBookQuantity(stock) * MARKET_MAKER_QUOTE_LEVELS;
    let currentInventory = marketMakers.reduce((total, trader) => total + getTraderHolding(trader, stock.id), 0);
    let remainingFloat = getUndistributedShares(stock);

    if (currentInventory >= targetInventory || remainingFloat <= 0) {
        return;
    }

    const currency = getCurrencyForMarket(stock.market);
    const idealPerTrader = Math.max(1, Math.ceil(targetInventory / marketMakers.length));

    marketMakers.forEach(trader => {
        if (currentInventory >= targetInventory || remainingFloat <= 0) {
            return;
        }

        const traderHolding = getTraderHolding(trader, stock.id);
        const traderShortage = Math.max(0, idealPerTrader - traderHolding);
        const maxAffordable = Math.floor(getTraderAvailableCash(trader, currency) / stock.price);
        const quantity = Math.min(traderShortage, maxAffordable, remainingFloat);

        if (quantity <= 0) {
            return;
        }

        spendTraderCash(trader, currency, quantity * stock.price);
        trader.holdings[stock.id] = traderHolding + quantity;
        currentInventory += quantity;
        remainingFloat -= quantity;
    });

    if (currentInventory >= targetInventory || remainingFloat <= 0) {
        return;
    }

    marketMakers.forEach(trader => {
        if (currentInventory >= targetInventory || remainingFloat <= 0) {
            return;
        }

        const maxAffordable = Math.floor(getTraderAvailableCash(trader, currency) / stock.price);
        const quantity = Math.min(targetInventory - currentInventory, maxAffordable, remainingFloat);

        if (quantity <= 0) {
            return;
        }

        spendTraderCash(trader, currency, quantity * stock.price);
        trader.holdings[stock.id] = getTraderHolding(trader, stock.id) + quantity;
        currentInventory += quantity;
        remainingFloat -= quantity;
    });
}

function allocateStockSupply(stock) {
    ensureStockMetadata(stock, getDistributedShares(stock.id));

    if (stock.initialTraderAllocationComplete) {
        topUpMarketMakerInventory(stock);
        return;
    }

    const eligibleTraders = marketSimulationState.traders.filter(trader => traderCanTradeMarket(trader, stock.market));
    if (eligibleTraders.length === 0) {
        stock.initialTraderAllocationComplete = true;
        return;
    }

    if (getDistributedShares(stock.id) > 0) {
        stock.initialTraderAllocationComplete = true;
        return;
    }

    const marketMakers = eligibleTraders.filter(trader => trader.strategy === 'market_maker');
    const regulars = eligibleTraders.filter(trader => trader.strategy !== 'market_maker');
    const seedParticipants = shuffle(regulars).slice(0, Math.min(regulars.length, randomInt(4, 10)));
    const marketMakerRatio = stock.market === 'korea' ? 0.18 : 0.24;
    const participantRatio = stock.market === 'korea' ? 0.08 : 0.14;

    shuffle(marketMakers).forEach(trader => {
        seedTraderInventory(trader, stock, marketMakerRatio);
    });

    seedParticipants.forEach(trader => {
        const focusBoost = trader.focus === stock.market ? 1 : 0.75;
        seedTraderInventory(trader, stock, participantRatio * focusBoost);
    });

    if (getDistributedShares(stock.id) === 0) {
        const fallbackPool = marketMakers.length > 0 ? shuffle(marketMakers) : shuffle(eligibleTraders);
        fallbackPool.some(trader => seedTraderInventory(trader, stock, 1) > 0);
    }

    topUpMarketMakerInventory(stock);
    stock.initialTraderAllocationComplete = true;
}

function setInitialTraderAssets(exchangeRate) {
    marketSimulationState.traders.forEach(trader => {
        if (!trader.initialAssetsKrw) {
            trader.initialAssetsKrw = calculateTraderAssets(trader, exchangeRate);
        }
    });
}

export function initializeMarketSimulation(exchangeRate) {
    if (marketSimulationState.traders.length === 0) {
        marketSimulationState.traders = buildInitialTraders().map(normalizeTrader);
    } else {
        marketSimulationState.traders = marketSimulationState.traders.map(normalizeTrader);
    }

    Object.keys(markets).forEach(marketId => {
        markets[marketId].forEach(stock => {
            ensureStockMetadata(stock, getDistributedShares(stock.id));
            ensureBook(stock.id, marketId);
        });
    });

    Object.keys(markets).forEach(marketId => {
        markets[marketId].forEach(stock => {
            allocateStockSupply(stock);
        });
    });

    setInitialTraderAssets(exchangeRate);
}

function getMovingAverage(stock, length = 6) {
    if (!stock.priceHistory || stock.priceHistory.length === 0) {
        return stock.price;
    }

    const samplePoints = stock.priceHistory.slice(-length);
    const total = samplePoints.reduce((sum, point) => sum + point.price, 0);
    return total / samplePoints.length;
}

function getMomentum(stock) {
    if (!stock.priceHistory || stock.priceHistory.length < 2) {
        return 0;
    }

    const recent = stock.priceHistory[stock.priceHistory.length - 1].price;
    const baseline = stock.priceHistory[Math.max(0, stock.priceHistory.length - 6)].price;
    if (baseline === 0) {
        return 0;
    }

    return (recent - baseline) / baseline;
}

function getBookBestPrice(stockId, marketId, side) {
    ensureBook(stockId, marketId);
    const book = orderBook[marketId][stockId];
    const orders = side === 'buy' ? book.buyOrders : book.sellOrders;
    if (orders.length === 0) {
        return null;
    }

    return side === 'buy'
        ? Math.max(...orders.map(order => order.price))
        : Math.min(...orders.map(order => order.price));
}

function createTraderLimitOrder(trader, stock, side, price, quantity) {
    const marketId = stock.market;
    const currency = getCurrencyForMarket(marketId);
    const roundedPrice = roundPrice(price, marketId);
    const finalQuantity = Math.max(0, Math.floor(quantity));

    if (finalQuantity <= 0) {
        return null;
    }

    if (side === 'buy') {
        const maxAffordable = Math.floor(getTraderAvailableCash(trader, currency) / roundedPrice);
        if (maxAffordable <= 0) {
            return null;
        }

        const quantityToBuy = Math.min(finalQuantity, maxAffordable);
        if (quantityToBuy <= 0) {
            return null;
        }

        const order = createOrder(stock.id, marketId, 'buy', 'limit', roundedPrice, quantityToBuy, trader.id, trader.strategyLabel);
        order.ownerType = 'trader';
        reserveTraderCash(trader, currency, roundedPrice * quantityToBuy);
        return order;
    }

    const maxSellable = getTraderAvailableHolding(trader, stock.id);
    if (maxSellable <= 0) {
        return null;
    }

    const quantityToSell = Math.min(finalQuantity, maxSellable);
    if (quantityToSell <= 0) {
        return null;
    }

    const order = createOrder(stock.id, marketId, 'sell', 'limit', roundedPrice, quantityToSell, trader.id, trader.strategyLabel);
    order.ownerType = 'trader';
    reserveTraderHolding(trader, stock.id, quantityToSell);
    return order;
}

function buildMarketMakerOrders(trader, stock) {
    const orders = [];
    const inventory = getTraderHolding(trader, stock.id);
    const targetBookQuantity = getTargetBookQuantity(stock);
    const spreadRatio = randomFloat(0.0018, 0.0055);
    const quoteBias = inventory > stock.totalShares * 0.03 ? -0.0015 : inventory < stock.totalShares * 0.005 ? 0.0015 : 0;
    const midPrice = stock.price * (1 + quoteBias);
    const baseQuantity = Math.max(1, Math.floor(targetBookQuantity / MARKET_MAKER_QUOTE_LEVELS));

    for (let level = 0; level < MARKET_MAKER_QUOTE_LEVELS; level++) {
        const levelSpread = spreadRatio * (1 + (level * 0.8));
        const bidPrice = midPrice * (1 - levelSpread);
        const askPrice = midPrice * (1 + levelSpread);
        const levelQuantity = Math.max(1, Math.floor(baseQuantity * randomFloat(0.85, 1.35)));

        const buyOrder = createTraderLimitOrder(trader, stock, 'buy', bidPrice, levelQuantity);
        if (buyOrder) {
            orders.push(buyOrder);
        }

        const sellOrder = createTraderLimitOrder(trader, stock, 'sell', askPrice, levelQuantity);
        if (sellOrder) {
            orders.push(sellOrder);
        }
    }

    return orders;
}

function buildDirectionalOrder(trader, stock) {
    const averagePrice = getMovingAverage(stock);
    const momentum = getMomentum(stock);
    const valuationGap = averagePrice === 0 ? 0 : (averagePrice - stock.price) / averagePrice;
    let signal = 0;

    switch (trader.strategy) {
    case 'momentum':
        signal = momentum * 1.8 + randomFloat(-0.015, 0.015);
        break;
    case 'value':
        signal = valuationGap * 2.1 + randomFloat(-0.012, 0.012);
        break;
    case 'contrarian':
        signal = (-momentum * 1.4) + (valuationGap * 0.6) + randomFloat(-0.015, 0.015);
        break;
    default:
        signal = (momentum * 0.8) + (valuationGap * 0.5) + randomFloat(-0.02, 0.02);
        break;
    }

    if (Math.abs(signal) < 0.002 && Math.random() < 0.2) {
        return null;
    }

    const side = signal >= 0 ? 'buy' : 'sell';
    const pressure = Math.min(0.055, Math.abs(signal) + randomFloat(0.002, 0.016));
    const referenceBid = getBookBestPrice(stock.id, stock.market, 'buy') || stock.price * 0.995;
    const referenceAsk = getBookBestPrice(stock.id, stock.market, 'sell') || stock.price * 1.005;
    const referencePrice = side === 'buy' ? referenceAsk : referenceBid;
    const aggressivePrice = side === 'buy'
        ? referencePrice * (1 + pressure)
        : referencePrice * (1 - pressure);

    const quantityMultiplier = trader.strategy === 'swing' ? randomFloat(1.0, 1.8) : randomFloat(0.6, 1.4);
    const baseQuantity = Math.max(1, Math.floor(stock.totalShares * randomFloat(0.0025, 0.012) * quantityMultiplier));

    return createTraderLimitOrder(trader, stock, side, aggressivePrice, baseQuantity);
}

function sortBook(stockId, marketId) {
    ensureBook(stockId, marketId);
    const book = orderBook[marketId][stockId];

    book.buyOrders.sort((left, right) => {
        if (left.price !== right.price) {
            return right.price - left.price;
        }

        return left.timestamp - right.timestamp;
    });

    book.sellOrders.sort((left, right) => {
        if (left.price !== right.price) {
            return left.price - right.price;
        }

        return left.timestamp - right.timestamp;
    });
}

function pushPriceHistory(stock, price) {
    stock.priceHistory.push({
        time: Date.now(),
        price
    });

    if (stock.priceHistory.length > MAX_HISTORY_LENGTH) {
        stock.priceHistory.shift();
    }
}

function recordTrade(stock, price, quantity, buyUserId, sellUserId) {
    const marketId = stock.market;
    ensureBook(stock.id, marketId);
    const trade = {
        id: `trade_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        stockId: stock.id,
        stockName: stock.name,
        price,
        quantity,
        buyUserId,
        sellUserId,
        timestamp: Date.now()
    };

    tradeHistory[marketId][stock.id].push(trade);
    if (tradeHistory[marketId][stock.id].length > MAX_HISTORY_LENGTH) {
        tradeHistory[marketId][stock.id].shift();
    }

    stock.prevPrice = stock.price;
    stock.price = price;
    stock.lastVolume = (stock.lastVolume || 0) + quantity;
    stock.lastTradeCount = (stock.lastTradeCount || 0) + 1;
    pushPriceHistory(stock, price);

    return trade;
}

function settleTraderBuy(trader, stock, quantity, price, orderPrice) {
    const currency = getCurrencyForMarket(stock.market);
    trader.cash[currency] -= price * quantity;
    trader.reservedCash[currency] = Math.max(0, trader.reservedCash[currency] - (orderPrice * quantity));
    trader.holdings[stock.id] = getTraderHolding(trader, stock.id) + quantity;
    trader.tradeCount += quantity;
}

function settleTraderSell(trader, stock, quantity, price) {
    const currency = getCurrencyForMarket(stock.market);
    trader.cash[currency] += price * quantity;
    trader.reservedHoldings[stock.id] = Math.max(0, getTraderReservedHolding(trader, stock.id) - quantity);
    trader.holdings[stock.id] = Math.max(0, getTraderHolding(trader, stock.id) - quantity);
    trader.tradeCount += quantity;
}

function matchStockOrders(stock) {
    const marketId = stock.market;
    ensureBook(stock.id, marketId);
    sortBook(stock.id, marketId);
    const book = orderBook[marketId][stock.id];

    while (book.buyOrders.length > 0 && book.sellOrders.length > 0) {
        const topBuy = book.buyOrders[0];
        const topSell = book.sellOrders[0];

        if (topBuy.price < topSell.price) {
            break;
        }

        const quantity = Math.min(topBuy.remainingQuantity, topSell.remainingQuantity);
        const tradePrice = topSell.price;
        const buyer = getTraderById(topBuy.userId);
        const seller = getTraderById(topSell.userId);

        if (!buyer || !seller) {
            break;
        }

        settleTraderBuy(buyer, stock, quantity, tradePrice, topBuy.price);
        settleTraderSell(seller, stock, quantity, tradePrice);
        recordTrade(stock, tradePrice, quantity, topBuy.userId, topSell.userId);

        topBuy.remainingQuantity -= quantity;
        topSell.remainingQuantity -= quantity;
        topBuy.status = topBuy.remainingQuantity === 0 ? 'filled' : 'partial';
        topSell.status = topSell.remainingQuantity === 0 ? 'filled' : 'partial';

        if (topBuy.remainingQuantity === 0) {
            book.buyOrders.shift();
        }

        if (topSell.remainingQuantity === 0) {
            book.sellOrders.shift();
        }
    }
}

function getBookSideStats(stockId, marketId, side) {
    ensureBook(stockId, marketId);
    const orders = side === 'buy'
        ? orderBook[marketId][stockId].buyOrders
        : orderBook[marketId][stockId].sellOrders;

    return {
        count: orders.length,
        quantity: orders.reduce((total, order) => total + order.remainingQuantity, 0)
    };
}

function buildPassiveLiquidityOrders(stock, side, requiredQuantity, requiredLevels) {
    const marketId = stock.market;
    const marketMakers = getMarketMakersForMarket(marketId);
    const orders = [];
    const tickSize = getTickSize(marketId);
    const startingQuantity = Math.max(1, Math.ceil(requiredQuantity / Math.max(1, requiredLevels)));

    if (side === 'sell') {
        topUpMarketMakerInventory(stock);
    }

    const currentBestBid = getBookBestPrice(stock.id, marketId, 'buy');
    const currentBestAsk = getBookBestPrice(stock.id, marketId, 'sell');

    marketMakers.forEach(trader => {
        if (requiredQuantity <= 0 && requiredLevels <= 0) {
            return;
        }

        for (let level = 0; level < MARKET_MAKER_QUOTE_LEVELS; level++) {
            if (requiredQuantity <= 0 && requiredLevels <= 0) {
                break;
            }

            const offsetRatio = 0.0025 + (level * 0.0035);
            let price = side === 'buy'
                ? stock.price * (1 - offsetRatio)
                : stock.price * (1 + offsetRatio);

            if (side === 'buy' && currentBestAsk !== null) {
                price = Math.min(price, currentBestAsk - tickSize);
            }

            if (side === 'sell' && currentBestBid !== null) {
                price = Math.max(price, currentBestBid + tickSize);
            }

            const quantity = Math.max(1, Math.floor(startingQuantity * randomFloat(0.85, 1.2)));
            const order = createTraderLimitOrder(trader, stock, side, price, quantity);
            if (!order) {
                continue;
            }

            orders.push(order);
            requiredQuantity -= order.remainingQuantity;
            requiredLevels -= 1;
        }
    });

    return orders;
}

function ensureVisibleLiquidity(stock) {
    const marketId = stock.market;
    const targetQuantity = getTargetBookQuantity(stock);
    const sellStats = getBookSideStats(stock.id, marketId, 'sell');
    const buyStats = getBookSideStats(stock.id, marketId, 'buy');

    if (sellStats.count < MIN_VISIBLE_LEVELS_PER_SIDE || sellStats.quantity < targetQuantity) {
        const restingSellOrders = buildPassiveLiquidityOrders(
            stock,
            'sell',
            Math.max(0, targetQuantity - sellStats.quantity),
            Math.max(0, MIN_VISIBLE_LEVELS_PER_SIDE - sellStats.count)
        );

        restingSellOrders.forEach(order => {
            orderBook[marketId][stock.id].sellOrders.push(order);
        });
    }

    if (buyStats.count < MIN_VISIBLE_LEVELS_PER_SIDE || buyStats.quantity < targetQuantity) {
        const restingBuyOrders = buildPassiveLiquidityOrders(
            stock,
            'buy',
            Math.max(0, targetQuantity - buyStats.quantity),
            Math.max(0, MIN_VISIBLE_LEVELS_PER_SIDE - buyStats.count)
        );

        restingBuyOrders.forEach(order => {
            orderBook[marketId][stock.id].buyOrders.push(order);
        });
    }

    sortBook(stock.id, marketId);
}

function buildOrdersForStock(stock, marketId, usedTraderIds) {
    ensureBook(stock.id, marketId);
    topUpMarketMakerInventory(stock);

    const eligibleTraders = marketSimulationState.traders.filter(trader => {
        return traderCanTradeMarket(trader, marketId) && !usedTraderIds.has(trader.id);
    });
    const reusableMarketMakers = getMarketMakersForMarket(marketId);
    const marketMakers = sample(reusableMarketMakers, MARKET_MAKERS_PER_STOCK);
    const regulars = sample(eligibleTraders.filter(trader => trader.strategy !== 'market_maker'), TRADERS_PER_STOCK);

    regulars.forEach(trader => usedTraderIds.add(trader.id));

    const generatedOrders = [];

    marketMakers.forEach(trader => {
        generatedOrders.push(...buildMarketMakerOrders(trader, stock));
    });

    regulars.forEach(trader => {
        const order = buildDirectionalOrder(trader, stock);
        if (order) {
            generatedOrders.push(order);
        }
    });

    generatedOrders.forEach(order => {
        if (order.type === 'buy') {
            orderBook[marketId][stock.id].buyOrders.push(order);
        } else {
            orderBook[marketId][stock.id].sellOrders.push(order);
        }
    });
}

export function simulateMarketTick(marketId, exchangeRate) {
    initializeMarketSimulation(exchangeRate);
    releaseAllReservations();
    clearMarketBooks(marketId);

    const usedTraderIds = new Set();

    markets[marketId].forEach(stock => {
        stock.lastVolume = 0;
        stock.lastTradeCount = 0;
        buildOrdersForStock(stock, marketId, usedTraderIds);
        matchStockOrders(stock);
        ensureVisibleLiquidity(stock);
        sortBook(stock.id, marketId);
    });
}

function updatePlayerHoldingOnBuy(stockId, quantity, totalCost) {
    if (!gameState.holdings[stockId]) {
        gameState.holdings[stockId] = {
            quantity: 0,
            avgPrice: 0
        };
    }

    const holding = gameState.holdings[stockId];
    const previousCost = holding.avgPrice * holding.quantity;
    holding.quantity += quantity;
    holding.avgPrice = (previousCost + totalCost) / holding.quantity;
}

function updatePlayerHoldingOnSell(stockId, quantity) {
    const holding = gameState.holdings[stockId];
    if (!holding) {
        return;
    }

    holding.quantity -= quantity;
    if (holding.quantity <= 0) {
        delete gameState.holdings[stockId];
    }
}

export function executePlayerMarketBuy(stockId, requestedQuantity) {
    const stock = markets.korea.concat(markets.usa).find(item => item.id === stockId);
    if (!stock || !gameState.marketStatus[stock.market]?.isOpen || gameState.gameOver) {
        return { success: false, message: '시장가 매수 조건을 만족하지 못했습니다.' };
    }

    ensureBook(stockId, stock.market);
    sortBook(stockId, stock.market);
    const currency = getCurrencyForMarket(stock.market);
    const book = orderBook[stock.market][stockId];

    let remainingQuantity = Math.max(0, Math.floor(requestedQuantity));
    let filledQuantity = 0;
    let totalCost = 0;

    while (remainingQuantity > 0 && book.sellOrders.length > 0) {
        const bestAsk = book.sellOrders[0];
        const seller = getTraderById(bestAsk.userId);
        if (!seller) {
            book.sellOrders.shift();
            continue;
        }

        const maxAffordable = Math.floor(gameState.cash[currency] / bestAsk.price);
        if (maxAffordable <= 0) {
            break;
        }

        const tradeQuantity = Math.min(remainingQuantity, bestAsk.remainingQuantity, maxAffordable);
        if (tradeQuantity <= 0) {
            break;
        }

        const tradeCost = tradeQuantity * bestAsk.price;
        gameState.cash[currency] -= tradeCost;
        updatePlayerHoldingOnBuy(stockId, tradeQuantity, tradeCost);
        settleTraderSell(seller, stock, tradeQuantity, bestAsk.price);
        recordTrade(stock, bestAsk.price, tradeQuantity, 'player', bestAsk.userId);

        bestAsk.remainingQuantity -= tradeQuantity;
        bestAsk.status = bestAsk.remainingQuantity === 0 ? 'filled' : 'partial';

        if (bestAsk.remainingQuantity === 0) {
            book.sellOrders.shift();
        }

        remainingQuantity -= tradeQuantity;
        filledQuantity += tradeQuantity;
        totalCost += tradeCost;
    }

    sortBook(stockId, stock.market);

    if (filledQuantity === 0) {
        return { success: false, message: '매도 호가가 부족하거나 잔고가 부족합니다.' };
    }

    return {
        success: true,
        stockName: stock.name,
        requestedQuantity,
        filledQuantity,
        partial: filledQuantity < requestedQuantity,
        averagePrice: totalCost / filledQuantity,
        totalCost
    };
}

export function executePlayerMarketSell(stockId, requestedQuantity) {
    const stock = markets.korea.concat(markets.usa).find(item => item.id === stockId);
    if (!stock || !gameState.marketStatus[stock.market]?.isOpen || gameState.gameOver) {
        return { success: false, message: '시장가 매도 조건을 만족하지 못했습니다.' };
    }

    const playerHolding = Number(gameState.holdings[stockId]?.quantity || 0);
    if (playerHolding <= 0) {
        return { success: false, message: '보유 수량이 없습니다.' };
    }

    ensureBook(stockId, stock.market);
    sortBook(stockId, stock.market);
    const currency = getCurrencyForMarket(stock.market);
    const book = orderBook[stock.market][stockId];

    let remainingQuantity = Math.min(Math.max(0, Math.floor(requestedQuantity)), playerHolding);
    let filledQuantity = 0;
    let totalProceeds = 0;

    while (remainingQuantity > 0 && book.buyOrders.length > 0) {
        const bestBid = book.buyOrders[0];
        const buyer = getTraderById(bestBid.userId);
        if (!buyer) {
            book.buyOrders.shift();
            continue;
        }

        const tradeQuantity = Math.min(remainingQuantity, bestBid.remainingQuantity);
        if (tradeQuantity <= 0) {
            break;
        }

        const tradeProceeds = tradeQuantity * bestBid.price;
        gameState.cash[currency] += tradeProceeds;
        updatePlayerHoldingOnSell(stockId, tradeQuantity);
        settleTraderBuy(buyer, stock, tradeQuantity, bestBid.price, bestBid.price);
        recordTrade(stock, bestBid.price, tradeQuantity, bestBid.userId, 'player');

        bestBid.remainingQuantity -= tradeQuantity;
        bestBid.status = bestBid.remainingQuantity === 0 ? 'filled' : 'partial';

        if (bestBid.remainingQuantity === 0) {
            book.buyOrders.shift();
        }

        remainingQuantity -= tradeQuantity;
        filledQuantity += tradeQuantity;
        totalProceeds += tradeProceeds;
    }

    sortBook(stockId, stock.market);

    if (filledQuantity === 0) {
        return { success: false, message: '매수 호가가 부족합니다.' };
    }

    return {
        success: true,
        stockName: stock.name,
        requestedQuantity,
        filledQuantity,
        partial: filledQuantity < requestedQuantity,
        averagePrice: totalProceeds / filledQuantity,
        totalProceeds
    };
}

export function clearMarketSimulationOrders(marketId) {
    releaseAllReservations();
    clearMarketBooks(marketId);
}

export function calculateTraderAssets(trader, exchangeRate) {
    let totalKrw = Number(trader.cash.krw || 0);
    let totalUsd = Number(trader.cash.usd || 0);

    Object.entries(trader.holdings || {}).forEach(([stockId, quantity]) => {
        const stock = markets.korea.concat(markets.usa).find(item => item.id === parseInt(stockId, 10));
        if (!stock || quantity <= 0) {
            return;
        }

        if (stock.market === 'korea') {
            totalKrw += stock.price * quantity;
        } else {
            totalUsd += stock.price * quantity;
        }
    });

    return totalKrw + (totalUsd * exchangeRate);
}

export function getTraderLeaderboard(exchangeRate, limit = LEADERBOARD_LIMIT) {
    return [...marketSimulationState.traders]
        .map(trader => {
            const totalAssets = calculateTraderAssets(trader, exchangeRate);
            const baseAssets = trader.initialAssetsKrw || totalAssets;
            const returnPct = baseAssets === 0 ? 0 : ((totalAssets - baseAssets) / baseAssets) * 100;

            return {
                id: trader.id,
                name: trader.name,
                strategy: trader.strategyLabel,
                focus: trader.focus,
                totalAssets,
                returnPct,
                tradeCount: trader.tradeCount
            };
        })
        .sort((left, right) => right.totalAssets - left.totalAssets)
        .slice(0, limit);
}

export function getStockMarketSnapshot(stockId, marketId) {
    ensureBook(stockId, marketId);
    const book = orderBook[marketId][stockId];
    const bestBid = book.buyOrders.length > 0
        ? Math.max(...book.buyOrders.map(order => order.price))
        : null;
    const bestAsk = book.sellOrders.length > 0
        ? Math.min(...book.sellOrders.map(order => order.price))
        : null;
    const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;
    const spreadPct = spread !== null && bestAsk !== 0 ? (spread / bestAsk) * 100 : null;
    const recentTrades = tradeHistory[marketId][stockId] || [];
    const lastTrade = recentTrades.length > 0 ? recentTrades[recentTrades.length - 1] : null;
    const stock = markets[marketId].find(item => item.id === stockId);

    return {
        bestBid,
        bestAsk,
        spread,
        spreadPct,
        lastTradePrice: lastTrade?.price || stock?.price || null,
        lastVolume: stock?.lastVolume || 0,
        tradeCount: stock?.lastTradeCount || 0
    };
}

export function saveMarketSimulationState() {
    const payload = {
        version: MARKET_STATE_VERSION,
        traders: marketSimulationState.traders.map(trader => ({
            id: trader.id,
            name: trader.name,
            strategy: trader.strategy,
            strategyLabel: trader.strategyLabel,
            focus: trader.focus,
            cash: trader.cash,
            holdings: trader.holdings,
            initialAssetsKrw: trader.initialAssetsKrw,
            tradeCount: trader.tradeCount
        }))
    };

    localStorage.setItem(MARKET_STATE_KEY, JSON.stringify(payload));
}

export function loadMarketSimulationState() {
    const saved = localStorage.getItem(MARKET_STATE_KEY);
    if (!saved) {
        return false;
    }

    try {
        const parsed = JSON.parse(saved);
        if (parsed.version !== MARKET_STATE_VERSION) {
            return false;
        }

        marketSimulationState.traders = (parsed.traders || []).slice(0, TRADER_COUNT).map(normalizeTrader);
        return marketSimulationState.traders.length > 0;
    } catch (error) {
        console.error('시장 상태를 불러오지 못했습니다:', error);
        return false;
    }
}

export function resetMarketSimulation() {
    marketSimulationState.traders = [];
    resetOrderBook();
    localStorage.removeItem(MARKET_STATE_KEY);
}
