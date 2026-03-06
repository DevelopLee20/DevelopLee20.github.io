import { findStock, getMarketCap } from './stock.js';
import { getStockMarketSnapshot } from './market-simulator.js';

let expandedChartStockId = null;

function formatStockCurrency(stock, amount) {
    if (amount === null || amount === undefined || Number.isNaN(amount)) {
        return '--';
    }

    if (stock.market === 'korea') {
        return `₩${Math.round(Math.abs(amount)).toLocaleString()}`;
    }

    return `$${Math.abs(amount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function formatSignedStockCurrency(stock, amount) {
    const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
    return `${sign}${formatStockCurrency(stock, amount)}`;
}

function isDarkMode() {
    return document.body.classList.contains('dark-mode');
}

function getChartPalette() {
    if (isDarkMode()) {
        return {
            frame: '#0f172a',
            surface: '#182033',
            grid: '#263042',
            axis: '#697386',
            text: '#f9fafb',
            line: '#4f8cff',
            point: '#3182f6',
            priceUp: '#f04452',
            priceDown: '#3182f6',
            border: '#2b3547'
        };
    }

    return {
        frame: '#f9fafb',
        surface: '#ffffff',
        grid: '#edf2f7',
        axis: '#8b95a1',
        text: '#191f28',
        line: '#3182f6',
        point: '#3182f6',
        priceUp: '#f04452',
        priceDown: '#3182f6',
        border: '#e5e8eb'
    };
}

function renderModalDetails(stock) {
    const container = document.getElementById('chart-stock-details');
    if (!container || !stock) {
        return;
    }

    const snapshot = getStockMarketSnapshot(stock.id, stock.market);
    const priceChange = stock.price - stock.prevPrice;
    const priceChangePercent = stock.prevPrice === 0 ? 0 : (priceChange / stock.prevPrice) * 100;
    const directionClass = priceChange > 0 ? 'price-up' : priceChange < 0 ? 'price-down' : 'neutral';
    const spreadText = snapshot.spreadPct !== null ? `${snapshot.spreadPct.toFixed(2)}%` : '--';

    container.innerHTML = `
        <div class="summary-card">
            <span class="summary-label">현재가</span>
            <strong class="summary-value">${formatStockCurrency(stock, stock.price)}</strong>
        </div>
        <div class="summary-card">
            <span class="summary-label">전일대비</span>
            <strong class="summary-value ${directionClass}">${formatSignedStockCurrency(stock, priceChange)} (${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%)</strong>
        </div>
        <div class="summary-card">
            <span class="summary-label">총 발행주식</span>
            <strong class="summary-value">${stock.totalShares.toLocaleString()}주</strong>
        </div>
        <div class="summary-card">
            <span class="summary-label">시가총액</span>
            <strong class="summary-value">${formatStockCurrency(stock, getMarketCap(stock))}</strong>
        </div>
        <div class="summary-card">
            <span class="summary-label">최우선 호가</span>
            <strong class="summary-value">${formatStockCurrency(stock, snapshot.bestBid)} / ${formatStockCurrency(stock, snapshot.bestAsk)}</strong>
        </div>
        <div class="summary-card">
            <span class="summary-label">스프레드 / 체결량</span>
            <strong class="summary-value">${spreadText} / ${(snapshot.lastVolume || 0).toLocaleString()}주</strong>
        </div>
    `;
}

function drawChartToCanvas(stock, canvasId, compact = false) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !stock) {
        return;
    }

    const ctx = canvas.getContext('2d');
    const palette = getChartPalette();
    const priceHistory = Array.isArray(stock.priceHistory) ? stock.priceHistory : [];
    const parentWidth = canvas.parentElement ? canvas.parentElement.clientWidth : 760;
    canvas.width = Math.max(320, parentWidth - (compact ? 0 : 8));
    canvas.height = compact ? 280 : 420;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = palette.surface;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (priceHistory.length < 2) {
        ctx.fillStyle = palette.axis;
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('가격 이력이 충분하지 않습니다.', canvas.width / 2, canvas.height / 2);
        return;
    }

    const padding = compact ? 36 : 48;
    const graphWidth = canvas.width - padding * 2;
    const graphHeight = canvas.height - padding * 2;
    const prices = priceHistory.map(point => point.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice || 1;
    const latestPoint = priceHistory[priceHistory.length - 1];
    const isUp = latestPoint.price >= priceHistory[0].price;

    ctx.fillStyle = palette.frame;
    ctx.fillRect(padding, padding, graphWidth, graphHeight);
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, padding, graphWidth, graphHeight);

    ctx.strokeStyle = palette.grid;
    for (let index = 0; index <= 5; index++) {
        const y = padding + (graphHeight / 5) * index;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + graphWidth, y);
        ctx.stroke();
    }

    ctx.beginPath();
    priceHistory.forEach((point, index) => {
        const x = padding + (graphWidth / (priceHistory.length - 1)) * index;
        const y = padding + graphHeight - ((point.price - minPrice) / range) * graphHeight;
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.strokeStyle = isUp ? palette.priceUp : palette.priceDown;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = palette.point;
    priceHistory.forEach((point, index) => {
        const x = padding + (graphWidth / (priceHistory.length - 1)) * index;
        const y = padding + graphHeight - ((point.price - minPrice) / range) * graphHeight;
        ctx.beginPath();
        ctx.arc(x, y, compact ? 2 : 3, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.fillStyle = palette.text;
    ctx.font = compact ? '600 13px sans-serif' : '700 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`현재가 ${formatStockCurrency(stock, stock.price)}`, padding, padding - 14);

    ctx.fillStyle = palette.axis;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    for (let index = 0; index <= 4; index++) {
        const y = padding + (graphHeight / 4) * index;
        const price = maxPrice - (range / 4) * index;
        ctx.fillText(formatStockCurrency(stock, price), padding - 10, y + 4);
    }

    ctx.textAlign = 'center';
    const startTime = priceHistory[0].time;
    const endTime = priceHistory[priceHistory.length - 1].time;
    const timeRange = endTime - startTime || 1;
    for (let index = 0; index <= 4; index++) {
        const time = new Date(startTime + (timeRange / 4) * index);
        const label = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
        const x = padding + (graphWidth / 4) * index;
        ctx.fillText(label, x, canvas.height - 12);
    }
}

export function showChart(stockId) {
    const stock = findStock(stockId);
    if (!stock) {
        return;
    }

    expandedChartStockId = stock.id;
    const modal = document.getElementById('chart-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }

    const titleElement = document.getElementById('chart-stock-name');
    if (titleElement) {
        titleElement.textContent = `${stock.name} 상세 차트`;
    }

    renderModalDetails(stock);
    drawChartToCanvas(stock, 'expanded-price-chart', false);
}

export function closeChart() {
    const modal = document.getElementById('chart-modal');
    if (modal) {
        modal.classList.add('hidden');
    }

    expandedChartStockId = null;
    const detailsContainer = document.getElementById('chart-stock-details');
    if (detailsContainer) {
        detailsContainer.innerHTML = '';
    }
}

export function updateChartIfOpen(stockId = null) {
    if (stockId !== null) {
        const selectedStock = findStock(stockId);
        if (selectedStock) {
            drawChartToCanvas(selectedStock, 'price-chart', true);
        }
    }

    if (expandedChartStockId !== null) {
        const expandedStock = findStock(expandedChartStockId);
        if (expandedStock) {
            renderModalDetails(expandedStock);
            drawChartToCanvas(expandedStock, 'expanded-price-chart', false);
        }
    }
}
