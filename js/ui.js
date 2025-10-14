// UI 렌더링 및 업데이트
import { gameState, getTotalAssets } from './game-state.js';
import { stocks, findStock } from './stock.js';

// 시간 표시 업데이트
export function updateTimeDisplay(timeString) {
    document.getElementById('current-time').textContent = timeString;
}

// 시장 상태 표시 업데이트
export function updateMarketStatus(isOpen) {
    const statusElement = document.getElementById('market-status');
    if (isOpen) {
        statusElement.textContent = '시장 개장 중';
        statusElement.className = 'market-open';
    } else {
        statusElement.textContent = '휴장 중';
        statusElement.className = 'market-closed';
    }
}

// 이자 납부 타이머 표시
export function updateInterestTimer(minutes, seconds) {
    document.getElementById('interest-timer').textContent =
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// 주식 목록 렌더링
export function renderStocks() {
    const container = document.getElementById('stock-list');
    container.innerHTML = '';

    stocks.forEach(stock => {
        const div = document.createElement('div');
        div.className = 'stock-item' + (stock.delisted ? ' delisted' : '');

        const priceChange = stock.price - stock.prevPrice;
        const changeClass = priceChange > 0 ? 'price-up' : priceChange < 0 ? 'price-down' : '';
        const changeSymbol = priceChange > 0 ? '▲' : priceChange < 0 ? '▼' : '';

        div.innerHTML = `
            <div class="stock-info stock-info-clickable" onclick="window.showChart(${stock.id})">
                <div class="stock-name">${stock.name} ${stock.delisted ? '(상장폐지)' : ''}</div>
                <div class="stock-price ${stock.price < stock.prevPrice ? 'negative' : ''}">
                    $${stock.price.toFixed(2)}
                    ${changeSymbol ? `<span class="price-change ${changeClass}">${changeSymbol} $${Math.abs(priceChange).toFixed(2)}</span>` : ''}
                </div>
            </div>
            <div class="stock-actions">
                <button class="buy-btn" onclick="window.buyStockHandler(${stock.id})"
                        ${!gameState.isMarketOpen || stock.delisted ? 'disabled' : ''}>
                    매수
                </button>
                <button class="buy-btn" onclick="window.buyStockHandler(${stock.id}, 10)"
                        ${!gameState.isMarketOpen || stock.delisted ? 'disabled' : ''}>
                    10주
                </button>
                <button class="buy-btn" onclick="window.buyStockHandler(${stock.id}, 100)"
                        ${!gameState.isMarketOpen || stock.delisted ? 'disabled' : ''}>
                    100주
                </button>
                <button class="sell-btn" onclick="window.sellStockHandler(${stock.id})"
                        ${!gameState.isMarketOpen || stock.delisted || !gameState.holdings[stock.id] ? 'disabled' : ''}>
                    매도
                </button>
                <button class="sell-btn" onclick="window.sellAllStockHandler(${stock.id})"
                        ${!gameState.isMarketOpen || stock.delisted || !gameState.holdings[stock.id] ? 'disabled' : ''}>
                    전부 매도
                </button>
            </div>
        `;

        container.appendChild(div);
    });
}

// 플레이어 정보 업데이트
export function updatePlayerInfo() {
    document.getElementById('player-cash').textContent = `$${gameState.cash.toFixed(2)}`;
    document.getElementById('player-loan').textContent = `$${gameState.loan.toFixed(2)}`;

    // 내야할 이자 표시
    const interest = gameState.loan * 0.1;
    document.getElementById('player-interest').textContent = `$${interest.toFixed(2)}`;

    const totalAssets = getTotalAssets(stocks);
    document.getElementById('player-total').textContent = `$${totalAssets.toFixed(2)}`;

    // 보유 주식 표시
    updateHoldings();
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
                    const profitPercent = ((stock.price - holding.avgPrice) / holding.avgPrice) * 100;
                    const profitColor = profitLoss >= 0 ? '#28a745' : '#dc3545';
                    const profitSign = profitLoss >= 0 ? '+' : '';
                    div.innerHTML = `
                        <div>
                            <div>${stock.name} x${holding.quantity}</div>
                            <div style="font-size: 0.85em; color: #666;">평균 단가: $${holding.avgPrice.toFixed(2)}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: bold; color: #28a745;">$${value.toFixed(2)}</div>
                            <div style="font-size: 0.85em; color: ${profitColor};">
                                ${profitSign}$${profitLoss.toFixed(2)} (${profitSign}${profitPercent.toFixed(2)}%)
                            </div>
                        </div>
                    `;
                    holdingsContainer.appendChild(div);
                }
            }
        });
    }
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
