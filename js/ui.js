import { gameState, getTotalAssets, getExchangeRateChange } from './game-state.js';
import { markets, findStock, getStockSessionChange, getMarketCap } from './stock.js';
import { getTraderLeaderboard, getStockMarketSnapshot } from './market-simulator.js';
import { getOrderBookDepth, getRecentTrades } from './order-book.js';
import { updateChartIfOpen } from './chart.js';

let activeMarketTab = 'korea';
let selectedStockId = null;
let tradingPanelInitialized = false;

function getCurrencySymbol(marketId) {
    return marketId === 'korea' ? '₩' : '$';
}

function formatCurrencyByMarket(marketId, amount, options = {}) {
    if (amount === null || amount === undefined || Number.isNaN(amount)) {
        return '--';
    }

    const absoluteAmount = Math.abs(amount);
    const currencySymbol = getCurrencySymbol(marketId);

    if (marketId === 'korea') {
        return `${currencySymbol}${Math.round(absoluteAmount).toLocaleString()}`;
    }

    return `${currencySymbol}${absoluteAmount.toLocaleString(undefined, {
        minimumFractionDigits: options.minimumFractionDigits ?? 2,
        maximumFractionDigits: options.maximumFractionDigits ?? 2
    })}`;
}

function formatSignedCurrencyByMarket(marketId, amount) {
    const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
    return `${sign}${formatCurrencyByMarket(marketId, amount)}`;
}

function formatStockPrice(stock, amount = stock?.price ?? 0) {
    return formatCurrencyByMarket(stock?.market || 'korea', amount);
}

function formatMarketName(marketId) {
    return marketId === 'korea' ? '국내시장' : '미국시장';
}

function getStockTicker(stock) {
    const prefix = stock.market === 'korea' ? 'KRX' : 'US';
    return `${prefix}-${String(stock.id).padStart(4, '0')}`;
}

function getSelectedStock() {
    if (selectedStockId === null) {
        return null;
    }

    return findStock(selectedStockId);
}

function updateTabDom() {
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.toggle('active', button.id === `tab-${activeMarketTab}`);
    });

    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `${activeMarketTab}-market`);
    });
}

function pickDefaultStock(marketId = activeMarketTab) {
    const preferredStocks = markets[marketId] || [];
    if (preferredStocks.length > 0) {
        selectedStockId = preferredStocks[0].id;
        return;
    }

    const fallbackStock = markets.korea[0] || markets.usa[0] || null;
    selectedStockId = fallbackStock ? fallbackStock.id : null;
}

function ensureSelectedStock(marketId = activeMarketTab) {
    const selectedStock = getSelectedStock();
    if (!selectedStock || selectedStock.market !== marketId) {
        pickDefaultStock(marketId);
    }
}

function getOrderQuantity() {
    const input = document.getElementById('selected-order-quantity');
    if (!input) {
        return 1;
    }

    const parsedValue = parseInt(input.value || '1', 10);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 1;
}

function getSelectedHoldingQuantity(stockId) {
    return Number(gameState.holdings[stockId]?.quantity || 0);
}

function setOrderActionState(stock) {
    const buyButton = document.getElementById('order-buy-btn');
    const sellButton = document.getElementById('order-sell-btn');
    const leverageButton = document.getElementById('selected-leverage-action');
    const marketStatus = stock ? gameState.marketStatus[stock.market]?.isOpen : false;
    const hasHolding = stock ? getSelectedHoldingQuantity(stock.id) > 0 : false;
    const leverageToggle = document.getElementById('leverage-toggle');
    const leverageEnabled = Boolean(leverageToggle?.checked);
    const direction = document.querySelector('input[name="leverage-direction"]:checked')?.value || 'long';
    const leverage = document.querySelector('input[name="leverage-ratio"]:checked')?.value || '2';

    if (buyButton) {
        buyButton.disabled = !stock || !marketStatus;
    }

    if (sellButton) {
        sellButton.disabled = !stock || !marketStatus || !hasHolding;
    }

    if (leverageButton) {
        leverageButton.disabled = !stock || !marketStatus || !leverageEnabled;
        leverageButton.textContent = direction === 'short'
            ? `숏 ${getOrderQuantity()}주 진입`
            : `${leverage}x 롱 ${getOrderQuantity()}주 진입`;
        leverageButton.classList.toggle('short-mode', direction === 'short');
    }
}

function renderInfoMessage(containerId, message) {
    const element = document.getElementById(containerId);
    if (element) {
        element.innerHTML = `<p class="empty-state">${message}</p>`;
    }
}

function renderSummaryCards(stock) {
    const summaryElement = document.getElementById('selected-stock-summary');
    if (!summaryElement) {
        return;
    }

    if (!stock) {
        summaryElement.innerHTML = '';
        return;
    }

    const snapshot = getStockMarketSnapshot(stock.id, stock.market);
    const sessionChange = getStockSessionChange(stock, gameState.marketStatus[stock.market]?.isOpen);
    const holding = gameState.holdings[stock.id];
    const spreadText = snapshot.spread !== null
        ? `${formatCurrencyByMarket(stock.market, snapshot.spread)} / ${snapshot.spreadPct?.toFixed(2) || '0.00'}%`
        : '--';
    const holdingText = holding
        ? `${holding.quantity.toLocaleString()}주 · 평균 ${formatStockPrice(stock, holding.avgPrice)}`
        : '보유 없음';

    summaryElement.innerHTML = `
        <div class="summary-card">
            <span class="summary-label">시가총액</span>
            <strong class="summary-value">${formatCurrencyByMarket(stock.market, getMarketCap(stock))}</strong>
        </div>
        <div class="summary-card">
            <span class="summary-label">총 발행주식</span>
            <strong class="summary-value">${stock.totalShares.toLocaleString()}주</strong>
        </div>
        <div class="summary-card">
            <span class="summary-label">5분 누적</span>
            <strong class="summary-value ${sessionChange.changeAmount > 0 ? 'price-up' : sessionChange.changeAmount < 0 ? 'price-down' : ''}">
                ${formatSignedCurrencyByMarket(stock.market, sessionChange.changeAmount)} (${sessionChange.changePct >= 0 ? '+' : ''}${sessionChange.changePct.toFixed(2)}%)
            </strong>
        </div>
        <div class="summary-card">
            <span class="summary-label">호가 스프레드</span>
            <strong class="summary-value">${spreadText}</strong>
        </div>
        <div class="summary-card">
            <span class="summary-label">최근 체결량</span>
            <strong class="summary-value">${(snapshot.lastVolume || 0).toLocaleString()}주</strong>
        </div>
        <div class="summary-card">
            <span class="summary-label">내 보유현황</span>
            <strong class="summary-value">${holdingText}</strong>
        </div>
    `;
}

function renderOrderBookSide(containerId, stock, orders, side) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    if (!stock || orders.length === 0) {
        container.innerHTML = '<p class="empty-state compact">대기 호가가 없습니다</p>';
        return;
    }

    const maxQuantity = Math.max(...orders.map(order => order.quantity), 1);
    container.innerHTML = orders.map(order => {
        const ratio = Math.max(10, Math.round((order.quantity / maxQuantity) * 100));
        return `
            <div class="orderbook-row ${side}">
                <span class="depth-bar" style="--depth:${ratio}%"></span>
                <span class="orderbook-price">${formatStockPrice(stock, order.price)}</span>
                <span class="orderbook-qty">${order.quantity.toLocaleString()}주</span>
            </div>
        `;
    }).join('');
}

function renderOrderBook(stock) {
    const summaryElement = document.getElementById('selected-orderbook-summary');
    if (!stock) {
        renderInfoMessage('selected-orderbook-sell', '호가를 불러올 종목을 선택하세요');
        renderInfoMessage('selected-orderbook-buy', '호가를 불러올 종목을 선택하세요');
        if (summaryElement) {
            summaryElement.textContent = '호가 정보 없음';
        }
        return;
    }

    const depth = getOrderBookDepth(stock.id, stock.market, 6);
    const bestAsk = depth.sellOrders[0];
    const bestBid = depth.buyOrders[0];
    const totalAsk = depth.sellOrders.reduce((total, order) => total + order.quantity, 0);
    const totalBid = depth.buyOrders.reduce((total, order) => total + order.quantity, 0);

    renderOrderBookSide('selected-orderbook-sell', stock, depth.sellOrders, 'ask');
    renderOrderBookSide('selected-orderbook-buy', stock, depth.buyOrders, 'bid');

    if (summaryElement) {
        const askText = bestAsk ? `매도1 ${formatStockPrice(stock, bestAsk.price)}` : '매도1 --';
        const bidText = bestBid ? `매수1 ${formatStockPrice(stock, bestBid.price)}` : '매수1 --';
        summaryElement.textContent = `${askText} · ${bidText} · 잔량 ${totalAsk.toLocaleString()} / ${totalBid.toLocaleString()}주`;
    }
}

function renderRecentTradeTape(stock) {
    const container = document.getElementById('selected-recent-trades');
    if (!container) {
        return;
    }

    if (!stock) {
        container.innerHTML = '<p class="empty-state compact">체결 내역이 없습니다</p>';
        return;
    }

    const trades = getRecentTrades(stock.id, stock.market, 8);
    if (trades.length === 0) {
        container.innerHTML = '<p class="empty-state compact">최근 체결이 없습니다</p>';
        return;
    }

    container.innerHTML = trades.map(trade => {
        const tradeDate = new Date(trade.timestamp);
        const timeLabel = `${String(tradeDate.getHours()).padStart(2, '0')}:${String(tradeDate.getMinutes()).padStart(2, '0')}:${String(tradeDate.getSeconds()).padStart(2, '0')}`;
        const isPlayerTrade = trade.buyUserId === 'player' || trade.sellUserId === 'player';

        return `
            <div class="trade-tape-row ${isPlayerTrade ? 'highlight' : ''}">
                <span class="trade-time">${timeLabel}</span>
                <span class="trade-price">${formatStockPrice(stock, trade.price)}</span>
                <span class="trade-qty">${trade.quantity.toLocaleString()}주</span>
            </div>
        `;
    }).join('');
}

function renderOrderEstimate(stock) {
    const estimateElement = document.getElementById('selected-order-estimate');
    const availabilityElement = document.getElementById('selected-order-availability');
    if (!estimateElement || !availabilityElement) {
        return;
    }

    if (!stock) {
        estimateElement.textContent = '종목을 선택하면 예상 체결 금액을 보여줍니다.';
        availabilityElement.textContent = '주문 가능 정보 없음';
        setOrderActionState(null);
        return;
    }

    const snapshot = getStockMarketSnapshot(stock.id, stock.market);
    const quantity = getOrderQuantity();
    const referenceAsk = snapshot.bestAsk ?? stock.price;
    const referenceBid = snapshot.bestBid ?? stock.price;
    const buyEstimate = referenceAsk * quantity;
    const sellEstimate = referenceBid * quantity;
    const currencyKey = stock.market === 'korea' ? 'krw' : 'usd';
    const availableCash = gameState.cash[currencyKey];
    const availableHolding = getSelectedHoldingQuantity(stock.id);
    const leverageEnabled = Boolean(document.getElementById('leverage-toggle')?.checked);
    const leverage = parseInt(document.querySelector('input[name="leverage-ratio"]:checked')?.value || '2', 10);
    const leverageOwnCapital = buyEstimate / leverage;

    estimateElement.innerHTML = `
        <div>예상 매수금액 <strong>${formatCurrencyByMarket(stock.market, buyEstimate)}</strong></div>
        <div>예상 매도금액 <strong>${formatCurrencyByMarket(stock.market, sellEstimate)}</strong></div>
        ${leverageEnabled ? `<div>레버리지 필요 증거금 <strong>${formatCurrencyByMarket(stock.market, leverageOwnCapital)}</strong></div>` : ''}
    `;
    availabilityElement.innerHTML = `
        <span>예수금 ${formatCurrencyByMarket(stock.market, availableCash)}</span>
        <span>보유수량 ${availableHolding.toLocaleString()}주</span>
    `;

    setOrderActionState(stock);
}

function renderSelectedStockPanel() {
    ensureSelectedStock(activeMarketTab);
    const stock = getSelectedStock();
    const nameElement = document.getElementById('selected-stock-name');
    const tickerElement = document.getElementById('selected-stock-code');
    const marketBadgeElement = document.getElementById('selected-stock-market');
    const priceElement = document.getElementById('selected-stock-price');
    const changeElement = document.getElementById('selected-stock-change');

    if (!stock) {
        if (nameElement) {
            nameElement.textContent = '종목 없음';
        }
        if (tickerElement) {
            tickerElement.textContent = '상장된 종목이 없습니다.';
        }
        if (marketBadgeElement) {
            marketBadgeElement.textContent = '대기';
        }
        if (priceElement) {
            priceElement.textContent = '--';
        }
        if (changeElement) {
            changeElement.textContent = '가격 정보 없음';
            changeElement.className = 'quote-price-change neutral';
        }
        renderSummaryCards(null);
        renderOrderBook(null);
        renderRecentTradeTape(null);
        renderOrderEstimate(null);
        updateChartIfOpen(null);
        return;
    }

    const priceChange = stock.price - stock.prevPrice;
    const priceChangePct = stock.prevPrice === 0 ? 0 : (priceChange / stock.prevPrice) * 100;

    if (nameElement) {
        nameElement.textContent = stock.name;
    }
    if (tickerElement) {
        tickerElement.textContent = `${formatMarketName(stock.market)} · ${getStockTicker(stock)} · ${gameState.marketStatus[stock.market]?.isOpen ? '개장중' : '폐장중'}`;
    }
    if (marketBadgeElement) {
        marketBadgeElement.textContent = stock.market === 'korea' ? '국내' : '미국';
        marketBadgeElement.className = `market-badge ${stock.market}`;
    }
    if (priceElement) {
        priceElement.textContent = formatStockPrice(stock);
    }
    if (changeElement) {
        changeElement.textContent = `${formatSignedCurrencyByMarket(stock.market, priceChange)} (${priceChangePct >= 0 ? '+' : ''}${priceChangePct.toFixed(2)}%)`;
        changeElement.className = `quote-price-change ${priceChange > 0 ? 'price-up' : priceChange < 0 ? 'price-down' : 'neutral'}`;
    }

    renderSummaryCards(stock);
    renderOrderBook(stock);
    renderRecentTradeTape(stock);
    renderOrderEstimate(stock);
    updateChartIfOpen(stock.id);
}

function renderSpotHoldings() {
    const container = document.getElementById('holdings-container');
    if (!container) {
        return;
    }

    const rows = Object.entries(gameState.holdings)
        .filter(([, holding]) => holding.quantity > 0)
        .map(([stockId, holding]) => {
            const stock = findStock(parseInt(stockId, 10));
            if (!stock) {
                return '';
            }

            const currentValue = stock.price * holding.quantity;
            const profitLoss = (stock.price - holding.avgPrice) * holding.quantity;
            const profitClass = profitLoss > 0 ? 'price-up' : profitLoss < 0 ? 'price-down' : '';

            return `
                <div class="position-row">
                    <div class="position-main">
                        <button class="position-link" onclick="window.selectStock(${stock.id})">${stock.name}</button>
                        <span class="position-sub">${holding.quantity.toLocaleString()}주 · 평균 ${formatStockPrice(stock, holding.avgPrice)}</span>
                    </div>
                    <div class="position-side">
                        <strong>${formatStockPrice(stock, currentValue)}</strong>
                        <span class="${profitClass}">${formatSignedCurrencyByMarket(stock.market, profitLoss)}</span>
                    </div>
                    <button class="inline-action danger" onclick="window.sellAllStockHandler(${stockId})">전량 매도</button>
                </div>
            `;
        })
        .filter(Boolean);

    container.innerHTML = rows.length > 0
        ? rows.join('')
        : '<p class="empty-state compact">보유 중인 현물 종목이 없습니다</p>';
}

function renderLeveragePositions() {
    const container = document.getElementById('leverage-positions-container');
    if (!container) {
        return;
    }

    if (!gameState.leveragedPositions || gameState.leveragedPositions.length === 0) {
        container.innerHTML = '<p class="empty-state compact">열린 레버리지 포지션이 없습니다</p>';
        return;
    }

    container.innerHTML = gameState.leveragedPositions.map(position => {
        const stock = findStock(position.stockId);
        if (!stock) {
            return '';
        }

        const currentValue = stock.price * position.quantity;
        const profitLoss = currentValue - position.borrowedAmount - position.ownCapital;
        const profitClass = profitLoss > 0 ? 'price-up' : profitLoss < 0 ? 'price-down' : '';

        return `
            <div class="position-row leverage">
                <div class="position-main">
                    <button class="position-link" onclick="window.selectStock(${stock.id})">${stock.name}</button>
                    <span class="position-sub">${position.quantity.toLocaleString()}주 · ${position.leverage}x · 청산가 ${formatStockPrice(stock, position.liquidationPrice)}</span>
                </div>
                <div class="position-side">
                    <strong>${formatStockPrice(stock, position.ownCapital + profitLoss)}</strong>
                    <span class="${profitClass}">${formatSignedCurrencyByMarket(stock.market, profitLoss)}</span>
                </div>
                <button class="inline-action" onclick="window.closeLeveragePositionHandler(${position.id})">청산</button>
            </div>
        `;
    }).join('');
}

function renderShortPositions() {
    const container = document.getElementById('short-positions-container');
    if (!container) {
        return;
    }

    if (!gameState.shortPositions || gameState.shortPositions.length === 0) {
        container.innerHTML = '<p class="empty-state compact">열린 숏 포지션이 없습니다</p>';
        return;
    }

    container.innerHTML = gameState.shortPositions.map(position => {
        const stock = findStock(position.stockId);
        if (!stock) {
            return '';
        }

        const profitLoss = (position.entryPrice - stock.price) * position.quantity;
        const profitClass = profitLoss > 0 ? 'price-up' : profitLoss < 0 ? 'price-down' : '';

        return `
            <div class="position-row short">
                <div class="position-main">
                    <button class="position-link" onclick="window.selectStock(${stock.id})">${stock.name}</button>
                    <span class="position-sub">${position.quantity.toLocaleString()}주 · 숏 · 청산가 ${formatStockPrice(stock, position.liquidationPrice)}</span>
                </div>
                <div class="position-side">
                    <strong>${formatStockPrice(stock, position.margin + profitLoss)}</strong>
                    <span class="${profitClass}">${formatSignedCurrencyByMarket(stock.market, profitLoss)}</span>
                </div>
                <button class="inline-action" onclick="window.coverShortPositionHandler(${position.id})">청산</button>
            </div>
        `;
    }).join('');
}

function updateExchangeRateDisplay() {
    const rateChangeElement = document.getElementById('rate-change');
    if (!rateChangeElement) {
        return;
    }

    const change = getExchangeRateChange();
    if (change === 'up') {
        rateChangeElement.textContent = '상승';
        rateChangeElement.className = 'rate-change up';
    } else if (change === 'down') {
        rateChangeElement.textContent = '하락';
        rateChangeElement.className = 'rate-change down';
    } else {
        rateChangeElement.textContent = '보합';
        rateChangeElement.className = 'rate-change';
    }
}

function renderTraderLeaderboard() {
    const container = document.getElementById('trader-leaderboard');
    if (!container) {
        return;
    }

    const leaderboard = getTraderLeaderboard(gameState.exchangeRate, 12);
    if (leaderboard.length === 0) {
        container.innerHTML = '<p class="empty-state compact">랭킹 데이터가 없습니다</p>';
        return;
    }

    container.innerHTML = leaderboard.map((entry, index) => {
        const returnClass = entry.returnPct > 0 ? 'price-up' : entry.returnPct < 0 ? 'price-down' : '';
        return `
            <div class="leaderboard-row">
                <span class="leaderboard-rank">${index + 1}</span>
                <div class="leaderboard-main">
                    <strong class="leaderboard-name">${entry.name}</strong>
                    <span class="leaderboard-strategy">${entry.strategy}</span>
                </div>
                <div class="leaderboard-value">
                    <strong>₩${Math.round(entry.totalAssets).toLocaleString()}</strong>
                    <span class="${returnClass}">${entry.returnPct >= 0 ? '+' : ''}${entry.returnPct.toFixed(2)}%</span>
                </div>
            </div>
        `;
    }).join('');
}

function bindTradingPanelEvents() {
    if (tradingPanelInitialized) {
        return;
    }

    const quantityInput = document.getElementById('selected-order-quantity');
    if (quantityInput) {
        quantityInput.addEventListener('input', () => {
            renderOrderEstimate(getSelectedStock());
        });
    }

    const leverageToggle = document.getElementById('leverage-toggle');
    const leverageRatioContainer = document.getElementById('leverage-ratio-container');
    const updateLeverageState = () => {
        if (leverageRatioContainer && leverageToggle) {
            leverageRatioContainer.style.display = leverageToggle.checked ? 'grid' : 'none';
        }
        renderOrderEstimate(getSelectedStock());
    };

    if (leverageToggle) {
        leverageToggle.addEventListener('change', updateLeverageState);
    }

    document.querySelectorAll('input[name="leverage-direction"], input[name="leverage-ratio"]').forEach(input => {
        input.addEventListener('change', () => {
            renderOrderEstimate(getSelectedStock());
        });
    });

    updateLeverageState();
    tradingPanelInitialized = true;
}

export function initializeTradingPanel() {
    bindTradingPanelEvents();
    ensureSelectedStock(activeMarketTab);
    renderSelectedStockPanel();
}

export function updateTimeDisplay(timeString) {
    const timeElement = document.getElementById('current-time');
    if (timeElement) {
        timeElement.textContent = timeString;
    }
}

export function updateMarketStatus(marketId, isOpen) {
    const statusElement = document.getElementById(`market-status-${marketId}`);
    if (!statusElement) {
        return;
    }

    statusElement.textContent = isOpen ? '개장 중' : '폐장 중';
    statusElement.className = isOpen ? 'market-open' : 'market-closed';
}

function formatMarketChange(marketId, amount) {
    return formatCurrencyByMarket(marketId, amount);
}

export function updateMarketSessionChange(marketId, changeAmount, changePct, isOpen) {
    const changeElement = document.getElementById(`market-change-${marketId}`);
    if (!changeElement) {
        return;
    }

    const prefix = isOpen ? '이번 5분 변동' : '직전 5분 변동';
    const sign = changeAmount > 0 ? '+' : changeAmount < 0 ? '-' : '';
    changeElement.textContent = `${prefix}: ${sign}${formatMarketChange(marketId, changeAmount)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)`;
    changeElement.className = `market-session-change ${changeAmount > 0 ? 'price-up' : changeAmount < 0 ? 'price-down' : 'neutral'}`;
}

export function getSelectedStockId() {
    ensureSelectedStock(activeMarketTab);
    return selectedStockId;
}

export function selectStock(stockId) {
    const stock = findStock(stockId);
    if (!stock) {
        return;
    }

    activeMarketTab = stock.market;
    selectedStockId = stock.id;
    updateTabDom();
    renderStocks();
    renderSelectedStockPanel();
}

export function refreshSelectedStockPanel() {
    renderSelectedStockPanel();
}

export function renderStocks() {
    ensureSelectedStock(activeMarketTab);

    Object.keys(markets).forEach(marketId => {
        const container = document.getElementById(`stock-list-${marketId}`);
        if (!container) {
            return;
        }

        const isOpen = Boolean(gameState.marketStatus[marketId]?.isOpen);
        const rows = markets[marketId].map(stock => {
            const priceChange = stock.price - stock.prevPrice;
            const priceChangePct = stock.prevPrice === 0 ? 0 : (priceChange / stock.prevPrice) * 100;
            const sessionChange = getStockSessionChange(stock, isOpen);
            const snapshot = getStockMarketSnapshot(stock.id, stock.market);
            const selectedClass = stock.id === selectedStockId ? 'selected' : '';
            const changeClass = priceChange > 0 ? 'price-up' : priceChange < 0 ? 'price-down' : 'neutral';

            return `
                <button class="watchlist-row ${selectedClass}" onclick="window.selectStock(${stock.id})">
                    <div class="watchlist-main">
                        <div class="watchlist-head">
                            <strong class="watchlist-name">${stock.name}</strong>
                            <span class="watchlist-code">${getStockTicker(stock)}</span>
                        </div>
                        <div class="watchlist-sub">
                            <span>5분 ${formatSignedCurrencyByMarket(stock.market, sessionChange.changeAmount)}</span>
                            <span>체결 ${Number(snapshot.lastVolume || 0).toLocaleString()}주</span>
                        </div>
                    </div>
                    <div class="watchlist-side">
                        <strong class="watchlist-price ${changeClass}">${formatStockPrice(stock)}</strong>
                        <span class="watchlist-change ${changeClass}">${priceChange >= 0 ? '+' : ''}${priceChangePct.toFixed(2)}%</span>
                    </div>
                </button>
            `;
        });

        container.innerHTML = rows.join('');
    });

    updateTabDom();
}

export function updatePlayerInfo() {
    const krwElement = document.getElementById('player-cash-krw');
    const usdElement = document.getElementById('player-cash-usd');
    const totalElement = document.getElementById('player-total');
    const exchangeRateElement = document.getElementById('exchange-rate');

    if (krwElement) {
        krwElement.textContent = `₩${Math.floor(gameState.cash.krw).toLocaleString()}`;
    }
    if (usdElement) {
        usdElement.textContent = `$${gameState.cash.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (totalElement) {
        totalElement.textContent = `₩${Math.floor(getTotalAssets()).toLocaleString()}`;
    }
    if (exchangeRateElement) {
        exchangeRateElement.textContent = `1 USD = ${gameState.exchangeRate.toFixed(2)} KRW`;
    }

    updateExchangeRateDisplay();
    renderSpotHoldings();
    renderLeveragePositions();
    renderShortPositions();
    renderTraderLeaderboard();
    renderSelectedStockPanel();
}

export function showGameOver(message) {
    document.getElementById('game-over-message').textContent = message;
    document.getElementById('game-over').classList.remove('hidden');
}

export function hideGameOver() {
    document.getElementById('game-over').classList.add('hidden');
}

export function switchTab(marketId) {
    activeMarketTab = marketId;
    ensureSelectedStock(marketId);
    updateTabDom();
    renderStocks();
    renderSelectedStockPanel();
}

export function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 2000);
}
