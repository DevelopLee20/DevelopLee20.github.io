// 주식 데이터 관리
export let markets = {
    korea: [],
    usa: []
};
let stockIdCounter = 0;

const KOREAN_STOCK_NAMES = [
    '엔사', '순천향대병원', '순양그룹', '사성', '럭키은성',
    'EA 스퍼트', 'F1 레이', '클로나이 AI', '개구리다 푸드', '페이커 건설'
];

const US_STOCK_NAMES = [
    '매크로소프트', '피어 컴퓨터', '구골', '아마조니아', '테슬러',
    '페이스북', '엔비디아', '인텔', 'AMD', '오라클'
];

const STOCK_NAMES = {
    korea: KOREAN_STOCK_NAMES,
    usa: US_STOCK_NAMES
};

// 초기 주식 생성
export function createInitialStocks() {
    for (let i = 0; i < 3; i++) {
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
        delisted: false,
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
        if (stock.delisted) return;

        stock.prevPrice = stock.price;
        // 현재 가격의 ±5% 변동
        const changePercent = (Math.random() - 0.5) * 0.1; // -5% ~ +5%
        let change = stock.price * changePercent;

        if (stock.market === 'korea') {
            // 국내 주식: 100원 단위로 반올림
            change = Math.round(change / 100) * 100;
        }

        stock.price = Math.max(0, stock.price + change);

        // 가격 이력 추가 (최대 100개 유지)
        stock.priceHistory.push({time: Date.now(), price: stock.price});
        if (stock.priceHistory.length > 100) {
            stock.priceHistory.shift();
        }

        // 상장폐지 체크 (국내: 100원 이하, 미국: $1 이하)
        const delistThreshold = stock.market === 'korea' ? 100 : 1;
        if (stock.price < delistThreshold) {
            stock.delisted = true;
            stock.price = 0;
        }
    });
}

// 주식 매수
export function buyStock(stockId, quantity, gameState) {
    const stock = findStock(stockId);
    if (!stock || stock.delisted || !gameState.marketStatus[stock.market].isOpen || gameState.gameOver) {
        return { success: false };
    }

    const totalCost = stock.price * quantity;
    const currency = stock.market === 'korea' ? 'krw' : 'usd';
    const currencyName = currency === 'krw' ? '원' : '달러';

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

        return { success: true };
    } else {
        return { success: false, message: `보유 ${currencyName}가 부족합니다!` };
    }
}

// 주식 매도
export function sellStock(stockId, gameState) {
    const stock = findStock(stockId);
    // 매도는 상장폐지되도 가능해야 할 수 있으므로 delisted 체크는 뺌
    if (!stock || gameState.gameOver) {
        return { success: false };
    }

    if (gameState.holdings[stockId] && gameState.holdings[stockId].quantity > 0) {
        const currency = stock.market === 'korea' ? 'krw' : 'usd';
        gameState.cash[currency] += stock.price;
        gameState.holdings[stockId].quantity--;
        if (gameState.holdings[stockId].quantity === 0) {
            delete gameState.holdings[stockId];
        }
        return { success: true };
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
        const currency = stock.market === 'korea' ? 'krw' : 'usd';
        gameState.cash[currency] += revenue;
        delete gameState.holdings[stockId];
        return { success: true };
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
    return markets[marketId].filter(s => !s.delisted).length;
}