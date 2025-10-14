// 차트 관련 기능
import { findStock } from './stock.js';

// 차트 모달 표시
export function showChart(stockId) {
    const stock = findStock(stockId);
    if (!stock) return;

    document.getElementById('chart-stock-name').textContent = `${stock.name} 가격 변동 차트`;
    document.getElementById('chart-modal').classList.remove('hidden');

    // 약간의 지연 후 차트 그리기 (캔버스 크기가 제대로 잡히도록)
    setTimeout(() => drawChart(stock), 50);
}

// 차트 모달 닫기
export function closeChart() {
    document.getElementById('chart-modal').classList.add('hidden');
}

// 차트 그리기
function drawChart(stock) {
    const canvas = document.getElementById('price-chart');
    const ctx = canvas.getContext('2d');

    // 캔버스 크기 설정 (고정 크기 사용)
    const containerWidth = canvas.parentElement.offsetWidth - 60; // padding 고려
    canvas.width = containerWidth;
    canvas.height = 400;

    const padding = 50;
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;

    // 캔버스 초기화
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (stock.priceHistory.length < 2) {
        ctx.fillStyle = '#999';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('가격 변동 데이터가 충분하지 않습니다', canvas.width / 2, canvas.height / 2);
        return;
    }

    // 가격 범위 계산
    const prices = stock.priceHistory.map(h => h.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    // 배경
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(padding, padding, width, height);

    // 격자선
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = padding + (height / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + width, y);
        ctx.stroke();

        // Y축 레이블
        const price = maxPrice - (priceRange / 5) * i;
        ctx.fillStyle = '#666';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`$${price.toFixed(2)}`, padding - 10, y + 4);
    }

    // 라인 차트 그리기
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 2;
    ctx.beginPath();

    stock.priceHistory.forEach((point, index) => {
        const x = padding + (width / (stock.priceHistory.length - 1)) * index;
        const y = padding + height - ((point.price - minPrice) / priceRange) * height;

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();

    // 데이터 포인트 그리기
    ctx.fillStyle = '#667eea';
    stock.priceHistory.forEach((point, index) => {
        const x = padding + (width / (stock.priceHistory.length - 1)) * index;
        const y = padding + height - ((point.price - minPrice) / priceRange) * height;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
    });

    // 현재가 표시
    ctx.fillStyle = '#28a745';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`현재가: $${stock.price.toFixed(2)}`, padding, padding - 20);

    // X축 레이블
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    const startTime = stock.priceHistory[0].time;
    const endTime = stock.priceHistory[stock.priceHistory.length - 1].time;
    const timeRange = endTime - startTime;

    for (let i = 0; i <= 4; i++) {
        const x = padding + (width / 4) * i;
        const time = new Date(startTime + (timeRange / 4) * i);
        const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
        ctx.fillText(timeStr, x, canvas.height - padding + 20);
    }

    // 축
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + height);
    ctx.lineTo(padding + width, padding + height);
    ctx.stroke();
}
