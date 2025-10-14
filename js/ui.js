// UI 렌더링 및 업데이트
import { gameState, getTotalAssets } from './game-state.js';
import { markets, findStock } from './stock.js';

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
                    <button class="buy-btn" onclick="window.buyStockHandler(${stock.id})" ${!isMarketOpen || stock.delisted ? 'disabled' : ''}>매수</button>
                    <button class="buy-btn" onclick="window.buyStockHandler(${stock.id}, 10)" ${!isMarketOpen || stock.delisted ? 'disabled' : ''}>10주</button>
                    <button class="buy-btn" onclick="window.buyStockHandler(${stock.id}, 100)" ${!isMarketOpen || stock.delisted ? 'disabled' : ''}>100주</button>
                    <button class="sell-btn" onclick="window.sellStockHandler(${stock.id})" ${!gameState.holdings[stock.id] ? 'disabled' : ''}>매도</button>
                    <button class="sell-btn" onclick="window.sellAllStockHandler(${stock.id})" ${!gameState.holdings[stock.id] ? 'disabled' : ''}>전부 매도</button>
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
    updateHoldings();
    updateExchangeSliderDisplay();
}

// 환전 슬라이더 디스플레이 업데이트
function updateExchangeSliderDisplay() {
    const slider = document.getElementById('exchange-slider');
    const amountDisplay = document.getElementById('exchange-amount-display');
    const krwEquivalent = document.getElementById('krw-equivalent');

    if (slider && amountDisplay && krwEquivalent) {
        const usdAmount = parseInt(slider.value);
        amountDisplay.textContent = usdAmount;
        const krwAmount = Math.floor(usdAmount * gameState.exchangeRate);
        krwEquivalent.textContent = `≈ ₩${krwAmount.toLocaleString()}`;
    }
}

// 보유 주식 표시
function updateHoldings() {
    const holdingsContainer = document.getElementById('holdings-container');
    if (Object.keys(gameState.holdings).length === 0) {
        holdingsContainer.innerHTML = '<p class="empty-holdings">보유 중인 주식이 없습니다</p>';
        return;
    }
    
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
                    <div>
                        <div>${stock.name} x${holding.quantity}</div>
                        <div style="font-size: 0.85em; color: #666;">평균 단가: ${currencySymbol}${formatCurrency(holding.avgPrice)}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; color: #28a745;">${currencySymbol}${formatCurrency(value)}</div>
                        <div style="font-size: 0.85em; color: ${profitColor};">
                            ${profitSign}${currencySymbol}${formatCurrency(profitLoss)} (${profitSign}${profitPercent.toFixed(2)}%)
                        </div>
                    </div>
                `;
                holdingsContainer.appendChild(div);
            }
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