// 주식 데이터 관리
export let stocks = [];
let stockIdCounter = 0;

const STOCK_NAMES = [
    '엔사', '순천향대병원', '순양그룹', '사성', '럭키은성',
    'EA 스퍼트', 'F1 레이', '클로나이 AI', '개구리다 푸드', '페이커 건설'
];

// 초기 주식 생성
export function createInitialStocks() {
    createNewStock();
    createNewStock();
    createNewStock();
}

// 새 주식 생성
export function createNewStock() {
    const usedNames = stocks.map(s => s.name);
    const availableNames = STOCK_NAMES.filter(name => !usedNames.includes(name));

    if (availableNames.length === 0) return null;

    const stock = {
        id: stockIdCounter++,
        name: availableNames[Math.floor(Math.random() * availableNames.length)],
        price: Math.floor(Math.random() * 50) + 10, // 10~60
        prevPrice: 0,
        delisted: false,
        priceHistory: [] // 가격 변동 이력
    };
    stock.prevPrice = stock.price;
    stock.priceHistory.push({time: Date.now(), price: stock.price});

    stocks.push(stock);
    return stock;
}

// 주가 변동
export function updateStockPrices() {
    stocks.forEach(stock => {
        if (stock.delisted) return;

        stock.prevPrice = stock.price;
        // 현재 가격의 ±5% 변동
        const changePercent = (Math.random() - 0.5) * 0.1; // -5% ~ +5%
        const change = stock.price * changePercent;
        stock.price = Math.max(0, stock.price + change);

        // 가격 이력 추가 (최대 100개 유지)
        stock.priceHistory.push({time: Date.now(), price: stock.price});
        if (stock.priceHistory.length > 100) {
            stock.priceHistory.shift();
        }

        // 상장폐지 체크 ($1 이하)
        if (stock.price < 1) {
            stock.delisted = true;
            stock.price = 0;
        }
    });
}

// 주식 매수
export function buyStock(stockId, quantity, gameState) {
    if (!gameState.isMarketOpen || gameState.gameOver) return { success: false };

    const stock = stocks.find(s => s.id === stockId);
    if (!stock || stock.delisted) return { success: false };

    const totalCost = stock.price * quantity;

    if (gameState.cash >= totalCost) {
        gameState.cash -= totalCost;

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
        return { success: false, message: '현금이 부족합니다!' };
    }
}

// 주식 매도
export function sellStock(stockId, gameState) {
    if (!gameState.isMarketOpen || gameState.gameOver) return { success: false };

    const stock = stocks.find(s => s.id === stockId);
    if (!stock || stock.delisted) return { success: false };

    if (gameState.holdings[stockId] && gameState.holdings[stockId].quantity > 0) {
        gameState.cash += stock.price;
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
    if (!gameState.isMarketOpen || gameState.gameOver) return { success: false };

    const stock = stocks.find(s => s.id === stockId);
    if (!stock || stock.delisted) return { success: false };

    if (gameState.holdings[stockId] && gameState.holdings[stockId].quantity > 0) {
        const quantity = gameState.holdings[stockId].quantity;
        const revenue = stock.price * quantity;
        gameState.cash += revenue;
        delete gameState.holdings[stockId];
        return { success: true };
    }
    return { success: false };
}

// 주식 데이터 초기화
export function resetStocks() {
    stocks = [];
    stockIdCounter = 0;
}

// 특정 주식 찾기
export function findStock(stockId) {
    return stocks.find(s => s.id === stockId);
}

// 상장된 주식 수 가져오기
export function getActiveStocksCount() {
    return stocks.filter(s => !s.delisted).length;
}
