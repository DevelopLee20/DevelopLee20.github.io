// UI 렌더링 및 업데이트
import { gameState, getTotalAssets, getExchangeRateChange } from './game-state.js';
import { markets, findStock } from './stock.js';
import { getOrderBookDepth, getPlayerPendingOrders, getRecentTrades, cancelOrder } from './order-book.js';


// 현재 호가창이 열려있는 주식 ID
let currentOrderBookStockId = null;

// 시간 표시 업데이트
export function updateTimeDisplay(timeString) {
    document.getElementById('current-time').textContent = timeString;
}

// 시장 상태 표시 업데이트
export function updateMarketStatus(marketId, isOpen) {
    const statusElement = document.getElementById(`market-status-${marketId}`);
    if (!statusElement) return;

    if (isOpen) {
        statusElement.textContent = '시장 개장 중';
        statusElement.className = 'market-open';
    } else {
        statusElement.textContent = '휴장 중';
        statusElement.className = 'market-closed';
    }
}

// 주식 목록 렌더링
export function renderStocks() {
    for (const marketId in markets) {
        const container = document.getElementById(`stock-list-${marketId}`);
        if (!container) continue;

        const marketStocks = markets[marketId];
        container.innerHTML = '';

        marketStocks.forEach(stock => {
            const div = document.createElement('div');
            div.className = 'stock-item' + (stock.delisted ? ' delisted' : '');

            const priceChange = stock.price - stock.prevPrice;
            const changeClass = priceChange > 0 ? 'price-up' : priceChange < 0 ? 'price-down' : '';
            const changeSymbol = priceChange > 0 ? '▲' : priceChange < 0 ? '▼' : '';
            const isMarketOpen = gameState.marketStatus[stock.market] ? gameState.marketStatus[stock.market].isOpen : false;
            const currencySymbol = stock.market === 'korea' ? '₩' : '$';
            const price = stock.market === 'korea' ? Math.round(stock.price).toLocaleString() : stock.price.toFixed(2);
            const changeAmount = stock.market === 'korea' ? Math.round(Math.abs(priceChange)).toLocaleString() : Math.abs(priceChange).toFixed(2);

            div.innerHTML = `
                <div class="stock-info stock-info-clickable" onclick="window.showChart(${stock.id})">
                    <div class="stock-name">${stock.name} ${stock.delisted ? '(상장폐지)' : ''}</div>
                    <div class="stock-price ${priceChange < 0 ? 'negative' : ''}">
                        ${currencySymbol}${price}
                        ${changeSymbol ? `<span class="price-change ${changeClass}">${changeSymbol} ${currencySymbol}${changeAmount}</span>` : ''}
                    </div>
                </div>
                <div class="stock-actions">
                    <button class="order-book-btn" onclick="window.openOrderBook(${stock.id})" ${stock.delisted ? 'disabled' : ''}>호가</button>
                    <button class="buy-btn" onclick="window.buyStockHandler(${stock.id})" ${!isMarketOpen || stock.delisted ? 'disabled' : ''}>매수</button>
                    <button class="buy-btn" onclick="window.buyStockHandler(${stock.id}, 10)" ${!isMarketOpen || stock.delisted ? 'disabled' : ''}>10주</button>
                    <button class="buy-btn" onclick="window.buyStockHandler(${stock.id}, 100)" ${!isMarketOpen || stock.delisted ? 'disabled' : ''}>100주</button>
                </div>
            `;
            container.appendChild(div);
        });
    }
}

// 플레이어 정보 업데이트
export function updatePlayerInfo() {
    document.getElementById('player-cash-krw').textContent = `₩${Math.floor(gameState.cash.krw).toLocaleString()}`;
    document.getElementById('player-cash-usd').textContent = `$${gameState.cash.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('player-total').textContent = `₩${Math.floor(getTotalAssets()).toLocaleString()}`;
    document.getElementById('exchange-rate').textContent = `1 USD = ${gameState.exchangeRate.toFixed(2)} KRW`;
    updateExchangeRateDisplay();
    updateHoldings();
}

// 환율 변동 표시 업데이트
function updateExchangeRateDisplay() {
    const rateChangeElement = document.getElementById('rate-change');
    const change = getExchangeRateChange();

    if (change === 'up') {
        rateChangeElement.textContent = '▲';
        rateChangeElement.className = 'rate-change up';
    } else if (change === 'down') {
        rateChangeElement.textContent = '▼';
        rateChangeElement.className = 'rate-change down';
    } else {
        rateChangeElement.textContent = '';
        rateChangeElement.className = 'rate-change';
    }
}


// 보유 주식 표시
function updateHoldings() {
    const holdingsContainer = document.getElementById('holdings-container');
    if (Object.keys(gameState.holdings).length === 0) {
        holdingsContainer.innerHTML = '<p class="empty-holdings">보유 중인 주식이 없습니다</p>';
    } else {
        holdingsContainer.innerHTML = '';
        Object.entries(gameState.holdings).forEach(([stockId, holding]) => {
            if (holding.quantity > 0) {
                const stock = findStock(parseInt(stockId));
                if (stock) {
                    const div = document.createElement('div');
                    div.className = 'holding-item';
                    const value = stock.price * holding.quantity;
                    const profitLoss = (stock.price - holding.avgPrice) * holding.quantity;
                    const profitPercent = holding.avgPrice > 0 ? ((stock.price - holding.avgPrice) / holding.avgPrice) * 100 : 0;
                    const profitColor = profitLoss >= 0 ? '#28a745' : '#dc3545';
                    const profitSign = profitLoss >= 0 ? '+' : '';
                    const currencySymbol = stock.market === 'korea' ? '₩' : '$';

                    const formatCurrency = (amount) => stock.market === 'korea' ? Math.round(amount).toLocaleString() : amount.toFixed(2);

                    div.innerHTML = `
                        <div class="holding-info">
                            <div>${stock.name} x${holding.quantity}</div>
                            <div style="font-size: 0.85em; color: #666;">평균 단가: ${currencySymbol}${formatCurrency(holding.avgPrice)}</div>
                        </div>
                        <div class="holding-value">
                            <div style="font-weight: bold; color: #28a745;">${currencySymbol}${formatCurrency(value)}</div>
                            <div style="font-size: 0.85em; color: ${profitColor};">
                                ${profitSign}${currencySymbol}${formatCurrency(profitLoss)} (${profitSign}${profitPercent.toFixed(2)}%)
                            </div>
                        </div>
                        <div class="holding-actions">
                            <button class="sell-btn sell-btn-small" onclick="window.sellStockHandler(${stockId})">매도</button>
                            <button class="sell-btn sell-btn-small" onclick="window.sellAllStockHandler(${stockId})">전부</button>
                        </div>
                    `;
                    holdingsContainer.appendChild(div);
                }
            }
        });
    }

    // 레버리지 포지션 표시
    updateLeveragePositions();
}

// 레버리지 포지션 표시
function updateLeveragePositions() {
    const leverageContainer = document.getElementById('leverage-positions-container');
    if (!gameState.leveragedPositions || gameState.leveragedPositions.length === 0) {
        leverageContainer.innerHTML = '<p class="empty-holdings">레버리지 포지션이 없습니다</p>';
        return;
    }

    leverageContainer.innerHTML = '';
    gameState.leveragedPositions.forEach(position => {
        const stock = findStock(position.stockId);
        if (stock) {
            const div = document.createElement('div');
            div.className = 'holding-item leverage-position';
            const currentValue = stock.price * position.quantity;
            const profitLoss = currentValue - position.borrowedAmount - position.ownCapital;
            const profitPercent = position.ownCapital > 0 ? (profitLoss / position.ownCapital) * 100 : 0;
            const profitColor = profitLoss >= 0 ? '#28a745' : '#dc3545';
            const profitSign = profitLoss >= 0 ? '+' : '';
            const currencySymbol = stock.market === 'korea' ? '₩' : '$';

            const formatCurrency = (amount) => stock.market === 'korea' ? Math.round(amount).toLocaleString() : amount.toFixed(2);

            // 청산가까지의 거리 계산
            const distanceToLiquidation = ((stock.price - position.liquidationPrice) / position.liquidationPrice) * 100;
            const liquidationWarning = distanceToLiquidation < 10 ? 'liquidation-warning' : '';

            div.innerHTML = `
                <div class="holding-info">
                    <div>${stock.name} x${position.quantity} <span class="leverage-badge">${position.leverage}x</span></div>
                    <div style="font-size: 0.85em; color: #666;">진입가: ${currencySymbol}${formatCurrency(position.entryPrice)}</div>
                    <div style="font-size: 0.85em; color: #ff6b6b;">청산가: ${currencySymbol}${formatCurrency(position.liquidationPrice)}</div>
                </div>
                <div class="holding-value">
                    <div style="font-weight: bold; color: #28a745;">${currencySymbol}${formatCurrency(position.ownCapital + profitLoss)}</div>
                    <div style="font-size: 0.85em; color: ${profitColor};">
                        ${profitSign}${currencySymbol}${formatCurrency(profitLoss)} (${profitSign}${profitPercent.toFixed(2)}%)
                    </div>
                </div>
                <div class="holding-actions">
                    <button class="sell-btn sell-btn-small" onclick="window.closeLeveragePositionHandler(${position.id})">청산</button>
                </div>
            `;
            leverageContainer.appendChild(div);
        }
    });
}

// 게임 오버 화면 표시
export function showGameOver(message) {
    document.getElementById('game-over-message').textContent = message;
    document.getElementById('game-over').classList.remove('hidden');
}

// 게임 오버 화면 숨기기
export function hideGameOver() {
    document.getElementById('game-over').classList.add('hidden');
}

export function switchTab(marketId) {
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    document.getElementById(`tab-${marketId}`).classList.add('active');
    document.getElementById(`${marketId}-market`).classList.add('active');
}

// 알림 토스트 표시
export function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // 2초 후 제거 (0.4초 슬라이드 다운 + 1.2초 유지 + 0.4초 페이드 아웃)
    setTimeout(() => {
        toast.remove();
    }, 2000);
}

// 호가창 열기
export function openOrderBook(stockId) {
    const stock = findStock(stockId);
    if (!stock || stock.delisted) return;

    currentOrderBookStockId = stockId;

    // 모달 표시
    const modal = document.getElementById('order-book-modal');
    modal.classList.remove('hidden');

    // 주식 이름 설정
    const marketStatus = gameState.marketStatus[stock.market]?.isOpen ? '개장 중' : '휴장 중';
    document.getElementById('order-book-stock-name').textContent = `${stock.name} - 호가창 (${marketStatus})`;

    const orderPriceInput = document.getElementById('order-price');
    if (stock.market === 'korea') {
        orderPriceInput.step = '100';
    } else {
        orderPriceInput.step = '0.01';
    }

    // 초기 렌더링
    renderOrderBook();

    // 주문 타입 초기화 (매수)
    switchOrderType('buy');

    // 가격 입력 필드 활성화 (지정가 기본)
    document.querySelector('input[name="order-method"][value="limit"]').checked = true;
    document.getElementById('order-price').disabled = false;

    // 휴장 중이면 주문 버튼 비활성화
    const isMarketOpen = gameState.marketStatus[stock.market]?.isOpen;
    const submitBtn = document.getElementById('order-submit-btn');
    if (!isMarketOpen) {
        submitBtn.disabled = true;
        submitBtn.title = '시장이 휴장 중입니다';
    } else {
        submitBtn.disabled = false;
        submitBtn.title = '';
    }
}

// 호가창 닫기
export function closeOrderBook() {
    const modal = document.getElementById('order-book-modal');
    modal.classList.add('hidden');
    currentOrderBookStockId = null;
}

// 호가창 렌더링
export function renderOrderBook() {
    if (!currentOrderBookStockId) return;

    const stock = findStock(currentOrderBookStockId);
    if (!stock) return;

    const marketId = stock.market;
    const currencySymbol = stock.market === 'korea' ? '₩' : '$';
    const formatPrice = (price) => stock.market === 'korea' ? (Math.round(price / 100) * 100).toLocaleString() : price.toFixed(2);

    // 현재가 표시
    document.getElementById('order-book-current-price').textContent = `${currencySymbol}${formatPrice(stock.price)}`;

    const priceChange = stock.price - stock.prevPrice;
    const changePercent = stock.prevPrice > 0 ? ((priceChange / stock.prevPrice) * 100).toFixed(2) : 0;
    const changeElement = document.getElementById('order-book-price-change');
    if (priceChange > 0) {
        changeElement.textContent = `▲ ${changePercent}%`;
        changeElement.style.color = '#dc3545';
    } else if (priceChange < 0) {
        changeElement.textContent = `▼ ${Math.abs(changePercent)}%`;
        changeElement.style.color = '#0066ff';
    } else {
        changeElement.textContent = '0%';
        changeElement.style.color = '#666';
    }

    // 호가 정보 가져오기
    const orderBookDepth = getOrderBookDepth(currentOrderBookStockId, marketId, 5);

    // 매도 호가 렌더링 (높은 가격부터)
    const sellOrdersList = document.getElementById('sell-orders-list');
    sellOrdersList.innerHTML = '';

    if (orderBookDepth.sellOrders.length === 0) {
        sellOrdersList.innerHTML = '<div class="no-orders" style="padding: 10px; text-align: center; color: #999;">매도 호가 없음</div>';
    } else {
        // 역순으로 표시 (높은 가격이 위로)
        orderBookDepth.sellOrders.slice().reverse().forEach(order => {
            const div = document.createElement('div');
            div.className = 'order-row sell';
            div.innerHTML = `
                <span>${currencySymbol}${formatPrice(order.price)}</span>
                <span>${order.quantity}</span>
            `;
            sellOrdersList.appendChild(div);
        });
    }

    // 매수 호가 렌더링 (높은 가격부터)
    const buyOrdersList = document.getElementById('buy-orders-list');
    buyOrdersList.innerHTML = '';

    if (orderBookDepth.buyOrders.length === 0) {
        buyOrdersList.innerHTML = '<div class="no-orders" style="padding: 10px; text-align: center; color: #999;">매수 호가 없음</div>';
    } else {
        orderBookDepth.buyOrders.forEach(order => {
            const div = document.createElement('div');
            div.className = 'order-row buy';
            div.innerHTML = `
                <span>${currencySymbol}${formatPrice(order.price)}</span>
                <span>${order.quantity}</span>
            `;
            buyOrdersList.appendChild(div);
        });
    }

    // 미체결 주문 렌더링
    renderPendingOrders(marketId, currencySymbol, formatPrice);

    // 최근 체결 내역 렌더링
    renderRecentTrades(marketId, currencySymbol, formatPrice);
}

// 미체결 주문 렌더링
function renderPendingOrders(marketId, currencySymbol, formatPrice) {
    const pendingOrdersList = document.getElementById('pending-orders-list');
    const pendingOrders = getPlayerPendingOrders(marketId).filter(order => order.stockId === currentOrderBookStockId);

    if (pendingOrders.length === 0) {
        pendingOrdersList.innerHTML = '<p class="no-orders">미체결 주문이 없습니다</p>';
    } else {
        pendingOrdersList.innerHTML = '';
        pendingOrders.forEach(order => {
            const stock = findStock(order.stockId);
            const div = document.createElement('div');
            div.className = `pending-order-item ${order.type}`;
            div.innerHTML = `
                <div>
                    <strong>${order.type === 'buy' ? '매수' : '매도'}</strong>
                    ${order.orderType === 'limit' ? '지정가' : '시장가'}
                    ${order.orderType === 'limit' ? `${currencySymbol}${formatPrice(order.price)}` : ''}
                    × ${order.remainingQuantity}주
                </div>
                <button class="cancel-order-btn" onclick="window.cancelOrderHandler('${order.id}')">취소</button>
            `;
            pendingOrdersList.appendChild(div);
        });
    }
}

// 최근 체결 내역 렌더링
function renderRecentTrades(marketId, currencySymbol, formatPrice) {
    const recentTradesList = document.getElementById('recent-trades-list');
    const recentTrades = getRecentTrades(currentOrderBookStockId, marketId, 5);

    if (recentTrades.length === 0) {
        recentTradesList.innerHTML = '<p class="no-trades">체결 내역이 없습니다</p>';
    } else {
        recentTradesList.innerHTML = '';
        recentTrades.forEach(trade => {
            const div = document.createElement('div');
            const isBuy = trade.buyUserId === 'player';
            const isSell = trade.sellUserId === 'player';
            const tradeType = isBuy ? 'buy' : isSell ? 'sell' : '';

            div.className = `trade-item ${tradeType}`;
            div.innerHTML = `
                <div>
                    <strong>${isBuy ? '매수' : isSell ? '매도' : 'AI'}</strong>
                    ${currencySymbol}${formatPrice(trade.price)} × ${trade.quantity}주
                </div>
                <div style="font-size: 0.8em; color: #999;">
                    ${new Date(trade.timestamp).toLocaleTimeString()}
                </div>
            `;
            recentTradesList.appendChild(div);
        });
    }
}

// 주문 타입 전환 (매수/매도)
export function switchOrderType(type) {
    const buyTab = document.getElementById('buy-tab');
    const sellTab = document.getElementById('sell-tab');
    const submitBtn = document.getElementById('order-submit-btn');

    if (type === 'buy') {
        buyTab.classList.add('active');
        sellTab.classList.remove('active');
        submitBtn.textContent = '매수 주문';
        submitBtn.classList.remove('sell-mode');
    } else {
        buyTab.classList.remove('active');
        sellTab.classList.add('active');
        submitBtn.textContent = '매도 주문';
        submitBtn.classList.add('sell-mode');
    }
}

// 주문 방식 변경 시 가격 입력 필드 활성화/비활성화
export function onOrderMethodChange() {
    const orderMethod = document.querySelector('input[name="order-method"]:checked').value;
    const priceInput = document.getElementById('order-price');

    if (orderMethod === 'market') {
        priceInput.disabled = true;
        priceInput.value = '';
    } else {
        priceInput.disabled = false;
    }
}

// 호가창 실시간 업데이트 (main.js에서 호출)
export function updateOrderBookIfOpen() {
    if (currentOrderBookStockId !== null) {
        renderOrderBook();
    }
}

// 현재 호가창 주식 ID getter
export function getCurrentOrderBookStockId() {
    return currentOrderBookStockId;
}