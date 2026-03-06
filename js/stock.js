// 주식 데이터 관리

export let markets = {
    korea: [],
    usa: []
};
let stockIdCounter = 0;
const MIN_TOTAL_SHARES = 1000;
const MAX_TOTAL_SHARES = 10000;

// stockIdCounter를 설정하는 함수 (게임 로드 시 사용)
export function setStockIdCounter(value) {
    stockIdCounter = value;
}

const KOREAN_STOCK_NAMES = [
    '엔사', '순천향대병원', '순양그룹', '사성', '럭키은성',
    'EA 스퍼트', 'F1 레이', '클로나이 AI', '개구리다 푸드', '페이커 건설'
];

const US_STOCK_NAMES = [
    '매크로소프트', '피어 컴퓨터', '구골', '아마조니아', '테슬러',
    '페이스북', '엔비디아', '인텔', 'AMD', '오라클', '피그미'
];

const STOCK_NAMES = {
    korea: KOREAN_STOCK_NAMES,
    usa: US_STOCK_NAMES
};

function createTotalShares(minShares = MIN_TOTAL_SHARES) {
    const lowerBound = Math.max(MIN_TOTAL_SHARES, Math.floor(minShares));
    const upperBound = Math.max(MAX_TOTAL_SHARES, lowerBound);
    return Math.floor(Math.random() * (upperBound - lowerBound + 1)) + lowerBound;
}

function createStockSessionStats() {
    return {
        sessionStartPrice: null,
        lastSessionChange: 0,
        lastSessionChangePct: 0
    };
}

export function ensureStockSessionStats(stock) {
    if (!stock) {
        return null;
    }

    const defaults = createStockSessionStats();
    stock.sessionStartPrice = Number.isFinite(stock.sessionStartPrice) && stock.sessionStartPrice > 0
        ? stock.sessionStartPrice
        : null;
    stock.lastSessionChange = Number.isFinite(stock.lastSessionChange)
        ? stock.lastSessionChange
        : defaults.lastSessionChange;
    stock.lastSessionChangePct = Number.isFinite(stock.lastSessionChangePct)
        ? stock.lastSessionChangePct
        : defaults.lastSessionChangePct;

    return stock;
}

export function startStockSession(stock) {
    ensureStockSessionStats(stock);
    if (!stock) {
        return;
    }

    stock.sessionStartPrice = stock.price;
}

export function getCurrentStockSessionChange(stock) {
    ensureStockSessionStats(stock);
    if (!stock || stock.sessionStartPrice === null) {
        return {
            changeAmount: 0,
            changePct: 0
        };
    }

    const changeAmount = stock.price - stock.sessionStartPrice;
    const changePct = stock.sessionStartPrice === 0
        ? 0
        : (changeAmount / stock.sessionStartPrice) * 100;

    return {
        changeAmount,
        changePct
    };
}

export function closeStockSession(stock) {
    ensureStockSessionStats(stock);
    if (!stock) {
        return;
    }

    const { changeAmount, changePct } = getCurrentStockSessionChange(stock);
    stock.lastSessionChange = changeAmount;
    stock.lastSessionChangePct = changePct;
    stock.sessionStartPrice = null;
}

export function getStockSessionChange(stock, isOpen) {
    ensureStockSessionStats(stock);
    if (!stock) {
        return {
            changeAmount: 0,
            changePct: 0
        };
    }

    if (isOpen) {
        return getCurrentStockSessionChange(stock);
    }

    return {
        changeAmount: stock.lastSessionChange,
        changePct: stock.lastSessionChangePct
    };
}

function getCommittedLongShares(stockId, gameState) {
    const directHoldingQuantity = gameState.holdings[stockId]?.quantity || 0;
    const leveragedQuantity = gameState.leveragedPositions.reduce((total, position) => {
        return total + (position.stockId === stockId ? position.quantity : 0);
    }, 0);

    return directHoldingQuantity + leveragedQuantity;
}

function getCommittedShortShares(stockId, gameState) {
    return gameState.shortPositions.reduce((total, position) => {
        return total + (position.stockId === stockId ? position.quantity : 0);
    }, 0);
}

function getAvailableShortShares(stockId, gameState) {
    const stock = findStock(stockId);
    if (!stock) {
        return 0;
    }

    return Math.max(0, stock.totalShares - getCommittedShortShares(stockId, gameState));
}

export function ensureStockMetadata(stock, minTotalShares = MIN_TOTAL_SHARES) {
    if (!stock) {
        return null;
    }

    const requiredTotalShares = Math.max(MIN_TOTAL_SHARES, Math.floor(minTotalShares));
    const currentTotalShares = Number.isFinite(stock.totalShares) ? Math.floor(stock.totalShares) : 0;

    if (currentTotalShares <= 0) {
        stock.totalShares = createTotalShares(requiredTotalShares);
    } else if (currentTotalShares < requiredTotalShares) {
        stock.totalShares = requiredTotalShares;
    } else {
        stock.totalShares = currentTotalShares;
    }

    if (!Number.isFinite(stock.prevPrice)) {
        stock.prevPrice = stock.price;
    }

    if (!Array.isArray(stock.priceHistory)) {
        stock.priceHistory = [{ time: Date.now(), price: stock.price }];
    }

    ensureStockSessionStats(stock);

    return stock;
}

export function getMarketCap(stock) {
    if (!stock) {
        return 0;
    }

    ensureStockMetadata(stock);
    return stock.price * stock.totalShares;
}

export function getAvailableShares(stockId, gameState) {
    const stock = findStock(stockId);
    if (!stock) {
        return 0;
    }

    return Math.max(0, stock.totalShares - getCommittedLongShares(stockId, gameState));
}

// 초기 주식 생성
export function createInitialStocks() {
    for (let i = 0; i < 10; i++) {
        createNewStock('korea');
        createNewStock('usa');
    }
}

// 새 주식 생성
export function createNewStock(marketId) {
    const marketStocks = markets[marketId];
    const usedNames = marketStocks.map(s => s.name);
    const availableNames = STOCK_NAMES[marketId].filter(name => !usedNames.includes(name));

    if (availableNames.length === 0) return null;

    let initialPrice;
    if (marketId === 'korea') {
        // 국내 주식: 1,000원 ~ 100,000원, 100원 단위
        const minPrice = 10; // 10 * 100 = 1,000원
        const maxPrice = 1000; // 1000 * 100 = 100,000원
        initialPrice = (Math.floor(Math.random() * (maxPrice - minPrice + 1)) + minPrice) * 100;
    } else {
        // 미국 주식: 기존과 동일 ($10 ~ $60)
        initialPrice = Math.floor(Math.random() * 50) + 10;
    }

    const stock = {
        id: stockIdCounter++,
        market: marketId, // 시장 구분
        name: availableNames[Math.floor(Math.random() * availableNames.length)],
        price: initialPrice,
        prevPrice: 0,
        totalShares: createTotalShares(),
        ...createStockSessionStats(),
        priceHistory: [] // 가격 변동 이력
    };
    stock.prevPrice = stock.price;
    stock.priceHistory.push({time: Date.now(), price: stock.price});

    marketStocks.push(stock);
    return stock;
}

// 주가 변동
export function updateStockPrices(marketId) {
    markets[marketId].forEach(stock => {
        stock.prevPrice = stock.price;
        // 현재 가격의 -5% ~ +5% 랜덤 변동
        const changePercent = (Math.random() * 0.1) - 0.05; // -5% ~ +5%
        let change = stock.price * changePercent;

        if (stock.market === 'korea') {
            // 국내 주식: 100원 단위로 반올림
            change = Math.round(change / 100) * 100;
        } else {
            // 미국 주식: $0.01 단위로 반올림
            change = Math.round(change * 100) / 100;
        }

        // 최소 가격 보장 (국내: 100원, 미국: $0.01)
        const minPrice = stock.market === 'korea' ? 100 : 0.01;
        stock.price = Math.max(minPrice, stock.price + change);

        // 가격 이력 추가 (최대 100개 유지)
        stock.priceHistory.push({time: Date.now(), price: stock.price});
        if (stock.priceHistory.length > 100) {
            stock.priceHistory.shift();
        }
    });
}

// 주식 매수
export function buyStock(stockId, quantity, gameState) {
    const stock = findStock(stockId);
    if (!stock || !gameState.marketStatus[stock.market].isOpen || gameState.gameOver) {
        return { success: false };
    }

    const totalCost = stock.price * quantity;
    const currency = stock.market === 'korea' ? 'krw' : 'usd';
    const currencyName = currency === 'krw' ? '원' : '달러';
    const availableShares = getAvailableShares(stockId, gameState);

    if (quantity > availableShares) {
        return {
            success: false,
            message: `매수 가능 물량이 부족합니다! (남은 수량: ${availableShares.toLocaleString()}주)`
        };
    }

    if (gameState.cash[currency] >= totalCost) {
        gameState.cash[currency] -= totalCost;

        // 평균 단가 계산
        if (!gameState.holdings[stockId]) {
            gameState.holdings[stockId] = { quantity: 0, avgPrice: 0 };
        }
        const holding = gameState.holdings[stockId];
        const totalPrevCost = holding.avgPrice * holding.quantity;
        holding.quantity += quantity;
        holding.avgPrice = (totalPrevCost + totalCost) / holding.quantity;

        return { success: true, stockName: stock.name };
    } else {
        return { success: false, message: `보유 ${currencyName}가 부족합니다!` };
    }
}

// 주식 매도
export function sellStock(stockId, gameState) {
    const stock = findStock(stockId);
    if (!stock || gameState.gameOver) {
        return { success: false };
    }

    if (gameState.holdings[stockId] && gameState.holdings[stockId].quantity > 0) {
        const currency = stock.market === 'korea' ? 'krw' : 'usd';
        const revenue = stock.price;
        const fee = revenue * 0.01; // 1% 수수료
        const finalRevenue = revenue - fee;

        gameState.cash[currency] += finalRevenue;
        gameState.holdings[stockId].quantity--;
        if (gameState.holdings[stockId].quantity === 0) {
            delete gameState.holdings[stockId];
        }
        return { success: true, stockName: stock.name, fee: fee };
    }
    return { success: false };
}

// 특정 주식 전부 매도
export function sellAllStock(stockId, gameState) {
    const stock = findStock(stockId);
    if (!stock || gameState.gameOver) {
        return { success: false };
    }

    if (gameState.holdings[stockId] && gameState.holdings[stockId].quantity > 0) {
        const quantity = gameState.holdings[stockId].quantity;
        const revenue = stock.price * quantity;
        const fee = revenue * 0.01; // 1% 수수료
        const finalRevenue = revenue - fee;
        const currency = stock.market === 'korea' ? 'krw' : 'usd';

        gameState.cash[currency] += finalRevenue;
        delete gameState.holdings[stockId];
        return { success: true, stockName: stock.name, quantity: quantity, fee: fee };
    }
    return { success: false };
}

// 주식 데이터 초기화
export function resetStocks() {
    markets.korea = [];
    markets.usa = [];
    stockIdCounter = 0;
}

// 특정 주식 찾기
export function findStock(stockId) {
    for (const marketId in markets) {
        const stock = markets[marketId].find(s => s.id === stockId);
        if (stock) return stock;
    }
    return null;
}

// 상장된 주식 수 가져오기
export function getActiveStocksCount(marketId) {
    return markets[marketId].length;
}

// 레버리지 매수
export function buyStockWithLeverage(stockId, quantity, leverage, gameState) {
    const stock = findStock(stockId);
    if (!stock || !gameState.marketStatus[stock.market].isOpen || gameState.gameOver) {
        return { success: false };
    }

    const totalCost = stock.price * quantity;
    const currency = stock.market === 'korea' ? 'krw' : 'usd';
    const currencyName = currency === 'krw' ? '원' : '달러';
    const availableShares = getAvailableShares(stockId, gameState);

    if (quantity > availableShares) {
        return {
            success: false,
            message: `레버리지 매수 가능 물량이 부족합니다! (남은 수량: ${availableShares.toLocaleString()}주)`
        };
    }

    // 필요한 자본금 = 총 비용 / 레버리지
    const ownCapital = totalCost / leverage;
    const fee = ownCapital * 0.01; // 1% 수수료
    const totalRequired = ownCapital + fee;

    if (gameState.cash[currency] < totalRequired) {
        return { success: false, message: `보유 ${currencyName}가 부족합니다! (필요: ${Math.ceil(totalRequired).toLocaleString()}${currencyName})` };
    }

    // 차입금 = 총 비용 - 자본금
    const borrowedAmount = totalCost - ownCapital;

    // 청산가 계산: 손실이 자본금의 90%에 도달하는 가격
    // currentValue - borrowedAmount - ownCapital = -ownCapital * 0.9
    // currentValue = borrowedAmount + ownCapital * 0.1
    // price * quantity = borrowedAmount + ownCapital * 0.1
    const liquidationPrice = (borrowedAmount + ownCapital * 0.1) / quantity;

    gameState.cash[currency] -= totalRequired;

    const position = {
        id: gameState.leverageIdCounter++,
        stockId: stockId,
        quantity: quantity,
        entryPrice: stock.price,
        leverage: leverage,
        ownCapital: ownCapital,
        borrowedAmount: borrowedAmount,
        liquidationPrice: liquidationPrice
    };

    gameState.leveragedPositions.push(position);

    return { success: true, stockName: stock.name, fee: fee, liquidationPrice: liquidationPrice };
}

// 레버리지 포지션 청산
export function closeLeveragePosition(positionId, gameState) {
    const positionIndex = gameState.leveragedPositions.findIndex(p => p.id === positionId);
    if (positionIndex === -1 || gameState.gameOver) {
        return { success: false };
    }

    const position = gameState.leveragedPositions[positionIndex];
    const stock = findStock(position.stockId);

    if (!stock) {
        return { success: false };
    }

    const currency = stock.market === 'korea' ? 'krw' : 'usd';
    const currentValue = stock.price * position.quantity;

    // 수익금 = 현재 가치 - 차입금 - 자본금
    const profitLoss = currentValue - position.borrowedAmount - position.ownCapital;
    const finalAmount = position.ownCapital + profitLoss;

    gameState.cash[currency] += finalAmount;
    gameState.leveragedPositions.splice(positionIndex, 1);

    return {
        success: true,
        stockId: position.stockId,
        stockName: stock.name,
        quantity: position.quantity,
        profitLoss: profitLoss,
        leverage: position.leverage
    };
}

// 자동 청산 체크 (주가 업데이트 시 호출)
export function checkLiquidations(gameState) {
    const liquidatedPositions = [];

    // 레버리지 포지션 청산 체크
    for (let i = gameState.leveragedPositions.length - 1; i >= 0; i--) {
        const position = gameState.leveragedPositions[i];
        const stock = findStock(position.stockId);

        if (!stock) continue;

        // 청산 조건: 현재 가격이 청산가 이하
        if (stock.price <= position.liquidationPrice) {
            const currency = stock.market === 'korea' ? 'krw' : 'usd';
            const currentValue = stock.price * position.quantity;
            const profitLoss = currentValue - position.borrowedAmount - position.ownCapital;
            const finalAmount = Math.max(0, position.ownCapital + profitLoss); // 음수 방지

            gameState.cash[currency] += finalAmount;

            liquidatedPositions.push({
                type: 'leverage',
                stockName: stock.name,
                quantity: position.quantity,
                leverage: position.leverage,
                loss: -profitLoss
            });

            gameState.leveragedPositions.splice(i, 1);
        }
    }

    // 숏 포지션 청산 체크
    for (let i = gameState.shortPositions.length - 1; i >= 0; i--) {
        const position = gameState.shortPositions[i];
        const stock = findStock(position.stockId);

        if (!stock) continue;

        // 청산 조건: 현재 가격이 청산가 이상 (가격이 올라가면 손실)
        if (stock.price >= position.liquidationPrice) {
            const currency = stock.market === 'korea' ? 'krw' : 'usd';
            const profitLoss = (position.entryPrice - stock.price) * position.quantity;
            const finalAmount = Math.max(0, position.margin + profitLoss); // 음수 방지

            gameState.cash[currency] += finalAmount;

            liquidatedPositions.push({
                type: 'short',
                stockName: stock.name,
                quantity: position.quantity,
                loss: -profitLoss
            });

            gameState.shortPositions.splice(i, 1);
        }
    }

    return liquidatedPositions;
}

// 숏 매도
export function shortSellStock(stockId, quantity, gameState) {
    const stock = findStock(stockId);
    if (!stock || !gameState.marketStatus[stock.market].isOpen || gameState.gameOver) {
        return { success: false };
    }

    const totalValue = stock.price * quantity;
    const currency = stock.market === 'korea' ? 'krw' : 'usd';
    const currencyName = currency === 'krw' ? '원' : '달러';
    const availableShortShares = getAvailableShortShares(stockId, gameState);

    if (quantity > availableShortShares) {
        return {
            success: false,
            message: `숏 포지션 가능 물량이 부족합니다! (남은 수량: ${availableShortShares.toLocaleString()}주)`
        };
    }

    // 필요한 증거금 = 주식 가치의 50%
    const margin = totalValue * 0.5;
    const fee = margin * 0.01; // 1% 수수료
    const totalRequired = margin + fee;

    if (gameState.cash[currency] < totalRequired) {
        return { success: false, message: `보유 ${currencyName}가 부족합니다! (필요: ${Math.ceil(totalRequired).toLocaleString()}${currencyName})` };
    }

    // 청산가 계산: 증거금의 90%를 잃을 때
    // (entryPrice - liquidationPrice) * quantity = -margin * 0.9
    // liquidationPrice = entryPrice + (margin * 0.9) / quantity
    const liquidationPrice = stock.price + (margin * 0.9) / quantity;

    gameState.cash[currency] -= totalRequired;

    const position = {
        id: gameState.shortIdCounter++,
        stockId: stockId,
        quantity: quantity,
        entryPrice: stock.price,
        margin: margin,
        liquidationPrice: liquidationPrice
    };

    gameState.shortPositions.push(position);

    return { success: true, stockName: stock.name, fee: fee, liquidationPrice: liquidationPrice };
}

// 숏 포지션 청산 (커버)
export function coverShortPosition(positionId, gameState) {
    const positionIndex = gameState.shortPositions.findIndex(p => p.id === positionId);
    if (positionIndex === -1 || gameState.gameOver) {
        return { success: false };
    }

    const position = gameState.shortPositions[positionIndex];
    const stock = findStock(position.stockId);

    if (!stock) {
        return { success: false };
    }

    const currency = stock.market === 'korea' ? 'krw' : 'usd';

    // 손익 = (진입가 - 현재가) × 수량
    const profitLoss = (position.entryPrice - stock.price) * position.quantity;
    const finalAmount = position.margin + profitLoss;

    gameState.cash[currency] += finalAmount;
    gameState.shortPositions.splice(positionIndex, 1);

    return {
        success: true,
        stockId: position.stockId,
        stockName: stock.name,
        quantity: position.quantity,
        profitLoss: profitLoss
    };
}
