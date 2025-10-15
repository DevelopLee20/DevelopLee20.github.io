// 호가창 및 주문 매칭 시스템

// 주문장 데이터 구조 {stockId: {buyOrders: [], sellOrders: []}}
export const orderBook = {
    korea: {},
    usa: {}
};

// 체결 내역
export const tradeHistory = {
    korea: {},
    usa: {}
};

// 주문 ID 카운터
let orderIdCounter = 0;

// 주문 생성
export function createOrder(stockId, marketId, type, orderType, price, quantity, userId = 'player', traderType = null) {
    if (!orderBook[marketId][stockId]) {
        orderBook[marketId][stockId] = {
            buyOrders: [],
            sellOrders: []
        };
    }

    const order = {
        id: `order_${orderIdCounter++}`,
        stockId: stockId,
        type: type, // 'buy' or 'sell'
        orderType: orderType, // 'limit' or 'market'
        price: price, // null for market orders
        quantity: quantity,
        remainingQuantity: quantity,
        userId: userId,
        traderType: traderType,
        timestamp: Date.now(),
        status: 'pending' // 'pending', 'partial', 'filled', 'cancelled'
    };

    return order;
}

// 주문을 주문장에 추가
export function addOrderToBook(order, marketId) {
    const book = orderBook[marketId][order.stockId];
    if (!book) return false;

    if (order.type === 'buy') {
        book.buyOrders.push(order);
    } else {
        book.sellOrders.push(order);
    }

    return true;
}

// 주문장에서 주문 제거
export function removeOrderFromBook(order, marketId) {
    const book = orderBook[marketId][order.stockId];
    if (!book) return false;

    if (order.type === 'buy') {
        const index = book.buyOrders.findIndex(o => o.id === order.id);
        if (index !== -1) {
            book.buyOrders.splice(index, 1);
            return true;
        }
    } else {
        const index = book.sellOrders.findIndex(o => o.id === order.id);
        if (index !== -1) {
            book.sellOrders.splice(index, 1);
            return true;
        }
    }

    return false;
}

// 주문 매칭 엔진
export function matchOrders(stockId, marketId, stock) {
    const book = orderBook[marketId][stockId];
    if (!book) return [];

    const trades = [];

    // 가격 우선, 시간 우선 원칙으로 정렬
    book.buyOrders.sort((a, b) => {
        if (b.price !== a.price) return b.price - a.price; // 높은 가격 우선
        return a.timestamp - b.timestamp; // 시간 빠른 순
    });

    book.sellOrders.sort((a, b) => {
        if (a.price !== b.price) return a.price - b.price; // 낮은 가격 우선
        return a.timestamp - b.timestamp; // 시간 빠른 순
    });

    // 매칭 시도
    while (book.buyOrders.length > 0 && book.sellOrders.length > 0) {
        const topBuy = book.buyOrders[0];
        const topSell = book.sellOrders[0];

        // 체결 조건 확인
        if (topBuy.price >= topSell.price) {
            // 체결 가격: 먼저 제시된 주문의 가격
            const matchPrice = topBuy.timestamp < topSell.timestamp ? topBuy.price : topSell.price;
            const matchQuantity = Math.min(topBuy.remainingQuantity, topSell.remainingQuantity);

            // 체결 실행
            const trade = executeMatch(topBuy, topSell, matchPrice, matchQuantity, stock);
            trades.push(trade);

            // 체결 내역 기록
            if (!tradeHistory[marketId][stockId]) {
                tradeHistory[marketId][stockId] = [];
            }
            tradeHistory[marketId][stockId].push(trade);

            // 최근 100개만 유지
            if (tradeHistory[marketId][stockId].length > 100) {
                tradeHistory[marketId][stockId].shift();
            }

            // 완전 체결된 주문 제거
            if (topBuy.remainingQuantity === 0) {
                topBuy.status = 'filled';
                book.buyOrders.shift();
            } else {
                topBuy.status = 'partial';
            }

            if (topSell.remainingQuantity === 0) {
                topSell.status = 'filled';
                book.sellOrders.shift();
            } else {
                topSell.status = 'partial';
            }
        } else {
            // 더 이상 체결 불가
            break;
        }
    }

    return trades;
}

// 체결 실행
function executeMatch(buyOrder, sellOrder, price, quantity, stock) {
    buyOrder.remainingQuantity -= quantity;
    sellOrder.remainingQuantity -= quantity;

    const trade = {
        id: `trade_${Date.now()}_${Math.random()}`,
        stockId: buyOrder.stockId,
        stockName: stock.name,
        price: price,
        quantity: quantity,
        buyOrderId: buyOrder.id,
        sellOrderId: sellOrder.id,
        buyUserId: buyOrder.userId,
        sellUserId: sellOrder.userId,
        timestamp: Date.now()
    };

    return trade;
}

// 특정 주식의 호가 정보 가져오기 (상위 5개)
export function getOrderBookDepth(stockId, marketId, depth = 5) {
    const book = orderBook[marketId][stockId];
    if (!book) return { buyOrders: [], sellOrders: [] };

    // 가격별로 수량 합산
    const buyPrices = {};
    const sellPrices = {};

    book.buyOrders.forEach(order => {
        if (!buyPrices[order.price]) {
            buyPrices[order.price] = 0;
        }
        buyPrices[order.price] += order.remainingQuantity;
    });

    book.sellOrders.forEach(order => {
        if (!sellPrices[order.price]) {
            sellPrices[order.price] = 0;
        }
        sellPrices[order.price] += order.remainingQuantity;
    });

    // 정렬 및 상위 N개 추출
    const buyOrdersSummary = Object.entries(buyPrices)
        .map(([price, quantity]) => ({ price: parseFloat(price), quantity }))
        .sort((a, b) => b.price - a.price)
        .slice(0, depth);

    const sellOrdersSummary = Object.entries(sellPrices)
        .map(([price, quantity]) => ({ price: parseFloat(price), quantity }))
        .sort((a, b) => a.price - b.price)
        .slice(0, depth);

    return {
        buyOrders: buyOrdersSummary,
        sellOrders: sellOrdersSummary
    };
}

// 플레이어의 미체결 주문 가져오기
export function getPlayerPendingOrders(marketId) {
    const pendingOrders = [];

    Object.keys(orderBook[marketId]).forEach(stockId => {
        const book = orderBook[marketId][stockId];

        book.buyOrders.forEach(order => {
            if (order.userId === 'player' && order.status === 'pending') {
                pendingOrders.push(order);
            }
        });

        book.sellOrders.forEach(order => {
            if (order.userId === 'player' && order.status === 'pending') {
                pendingOrders.push(order);
            }
        });
    });

    return pendingOrders;
}

// 주문 취소
export function cancelOrder(orderId, marketId) {
    for (const stockId in orderBook[marketId]) {
        const book = orderBook[marketId][stockId];

        let order = book.buyOrders.find(o => o.id === orderId);
        if (order && order.userId === 'player') {
            removeOrderFromBook(order, marketId);
            order.status = 'cancelled';
            return { success: true, order: order };
        }

        order = book.sellOrders.find(o => o.id === orderId);
        if (order && order.userId === 'player') {
            removeOrderFromBook(order, marketId);
            order.status = 'cancelled';
            return { success: true, order: order };
        }
    }

    return { success: false };
}

// 최근 체결 내역 가져오기
export function getRecentTrades(stockId, marketId, limit = 10) {
    if (!tradeHistory[marketId][stockId]) {
        return [];
    }

    return tradeHistory[marketId][stockId]
        .slice(-limit)
        .reverse();
}

// 주문장 초기화 (특정 주식)
export function initOrderBook(stockId, marketId) {
    orderBook[marketId][stockId] = {
        buyOrders: [],
        sellOrders: []
    };
    tradeHistory[marketId][stockId] = [];
}

// 전체 주문장 초기화
export function resetOrderBook() {
    Object.keys(orderBook.korea).forEach(stockId => {
        orderBook.korea[stockId] = { buyOrders: [], sellOrders: [] };
    });
    Object.keys(orderBook.usa).forEach(stockId => {
        orderBook.usa[stockId] = { buyOrders: [], sellOrders: [] };
    });
    Object.keys(tradeHistory.korea).forEach(stockId => {
        tradeHistory.korea[stockId] = [];
    });
    Object.keys(tradeHistory.usa).forEach(stockId => {
        tradeHistory.usa[stockId] = [];
    });
    orderIdCounter = 0;
}
