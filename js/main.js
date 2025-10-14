// 메인 게임 로직
import { gameState, resetGameState, getTotalAssets, openMarket, closeMarket, endGame, saveGameState, loadGameState, updateExchangeRate, exchangeKrwToUsd, exchangeUsdToKrw, calculateExchangeFee } from './game-state.js';
import { markets, createInitialStocks, createNewStock, updateStockPrices, buyStock, sellStock, sellAllStock, resetStocks, getActiveStocksCount } from './stock.js';
import { updateTimeDisplay, updateMarketStatus, renderStocks, updatePlayerInfo, showGameOver, hideGameOver, switchTab, showToast } from './ui.js';
import { showChart, closeChart } from './chart.js';
import { toggleDarkMode, loadDarkMode, cycleFontSize, loadFontSize } from './settings.js';

// 타이머 관련
const priceUpdateIntervals = {
    korea: null,
    usa: null
};
let lastStockCreationMinute = -1;
let lastExchangeRateUpdateSecond = -1;

// 각 시장의 개장 시간 정의
const marketHours = {
    korea: {
        label: '🇰🇷 국내장',
        open: (min) => min % 10 < 5,
        newStockInterval: 15
    },
    usa: {
        label: '🇺🇸 미국장',
        open: (min) => min % 10 >= 5,
        newStockInterval: 20
    }
};

// 초기화
function init() {
    loadDarkMode();
    loadFontSize();

    if (!loadGameState()) {
        createInitialStocks();
        console.log('새 게임을 시작합니다.');
    }

    switchTab('korea'); // 기본 탭 설정
    updateTime();

    // 시장 상태 업데이트 및 개장 중인 시장의 가격 업데이트 시작
    Object.keys(gameState.marketStatus).forEach(marketId => {
        updateMarketStatus(marketId, gameState.marketStatus[marketId].isOpen);

        // 이미 개장 중인 시장이면 가격 업데이트 시작
        if (gameState.marketStatus[marketId].isOpen) {
            if (priceUpdateIntervals[marketId]) clearInterval(priceUpdateIntervals[marketId]);
            priceUpdateIntervals[marketId] = setInterval(() => {
                updateStockPrices(marketId);
                renderStocks();
                updatePlayerInfo();
            }, 2000);
        }
    });

    renderStocks();
    updatePlayerInfo();
    initExchangeSlider();

    setInterval(updateTime, 1000);
    window.addEventListener('beforeunload', saveGameState);
}

// 시간 업데이트 및 게임 로직
function updateTime() {
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    updateTimeDisplay(`${String(now.getHours()).padStart(2, '0')}:${minutes}:${String(seconds).padStart(2, '0')}`);
    checkAllMarketStatus(minutes);

    // 5초마다 환율 변동
    if (seconds % 5 === 0 && seconds !== lastExchangeRateUpdateSecond) {
        updateExchangeRate();
        lastExchangeRateUpdateSecond = seconds;
    }

    if (minutes !== lastStockCreationMinute) {
        Object.keys(marketHours).forEach(marketId => {
            if (minutes % marketHours[marketId].newStockInterval === 0) {
                createNewStock(marketId);
            }
        });
        renderStocks();
        lastStockCreationMinute = minutes;
    }
    
    updatePlayerInfo();
}

// 모든 시장 상태 체크
function checkAllMarketStatus(minutes) {
    const minute = parseInt(minutes);
    Object.keys(marketHours).forEach(marketId => {
        const shouldBeOpen = marketHours[marketId].open(minute);
        const isCurrentlyOpen = gameState.marketStatus[marketId].isOpen;

        if (shouldBeOpen && !isCurrentlyOpen) {
            handleMarketOpen(marketId);
        } else if (!shouldBeOpen && isCurrentlyOpen) {
            handleMarketClose(marketId);
        }
    });
}

// 시장 개장 처리
function handleMarketOpen(marketId) {
    openMarket(marketId);
    updateMarketStatus(marketId, true);

    if (getActiveStocksCount(marketId) < 10) {
        createNewStock(marketId);
    }
    renderStocks();

    if (priceUpdateIntervals[marketId]) clearInterval(priceUpdateIntervals[marketId]);
    priceUpdateIntervals[marketId] = setInterval(() => {
        updateStockPrices(marketId);
        renderStocks();
        updatePlayerInfo();
    }, 2000);
}

// 시장 휴장 처리
function handleMarketClose(marketId) {
    closeMarket(marketId);
    updateMarketStatus(marketId, false);

    if (priceUpdateIntervals[marketId]) {
        clearInterval(priceUpdateIntervals[marketId]);
        priceUpdateIntervals[marketId] = null;
    }
    renderStocks();
}

// 환전 슬라이더 초기화
function initExchangeSlider() {
    const slider = document.getElementById('exchange-slider');
    const amountDisplay = document.getElementById('exchange-amount-display');
    const krwEquivalent = document.getElementById('krw-equivalent');
    const feeAmount = document.getElementById('fee-amount');

    slider.addEventListener('input', function() {
        const usdAmount = parseInt(this.value);
        amountDisplay.textContent = usdAmount;
        const krwAmount = Math.floor(usdAmount * gameState.exchangeRate);
        krwEquivalent.textContent = `≈ ₩${krwAmount.toLocaleString()}`;

        // 수수료 표시 (기본적으로 원화→달러 수수료 표시)
        const fee = calculateExchangeFee(krwAmount, 'krw_to_usd');
        feeAmount.textContent = `₩${fee.toLocaleString()}`;
    });

    // 초기값 설정
    updateSliderMax();
}

// 슬라이더 최댓값 업데이트
function updateSliderMax() {
    const slider = document.getElementById('exchange-slider');
    const maxUsd = Math.floor(gameState.cash.krw / gameState.exchangeRate) + Math.floor(gameState.cash.usd);
    slider.max = Math.max(maxUsd, 1000);

    // 현재 값이 최댓값을 초과하면 조정
    if (parseInt(slider.value) > slider.max) {
        slider.value = slider.max;
        slider.dispatchEvent(new Event('input'));
    }
}

// 환전 핸들러
function exchangeHandler(direction) {
    const slider = document.getElementById('exchange-slider');
    const usdAmount = parseInt(slider.value);

    if (usdAmount <= 0) {
        showToast('환전할 금액을 선택하세요.', 'warning');
        return;
    }

    let result;
    let message;
    if (direction === 'krw_to_usd') {
        // 원화를 달러로: 필요한 원화 = usdAmount * 환율
        const krwNeeded = usdAmount * gameState.exchangeRate;
        result = exchangeKrwToUsd(krwNeeded);
        message = `$${usdAmount} 환전 완료! (원화→달러)`;
    } else {
        // 달러를 원화로
        result = exchangeUsdToKrw(usdAmount);
        const krwReceived = Math.floor(usdAmount * gameState.exchangeRate * 0.995);
        message = `₩${krwReceived.toLocaleString()} 환전 완료! (달러→원화)`;
    }

    if (result.success) {
        slider.value = 0;
        slider.dispatchEvent(new Event('input'));
        updatePlayerInfo();
        updateSliderMax();
        showToast(message);
    } else {
        showToast(result.message, 'error');
    }
}

// 주식 매수 핸들러
function buyStockHandler(stockId, quantity = 1) {
    const result = buyStock(stockId, quantity, gameState);
    if (result.success) {
        updatePlayerInfo();
        renderStocks();
        showToast(`${result.stockName} ${quantity}주 매수 완료!`);
    } else if (result.message) {
        showToast(result.message, 'error');
    }
}

// 주식 매도 핸들러
function sellStockHandler(stockId) {
    const result = sellStock(stockId, gameState);
    if (result.success) {
        updatePlayerInfo();
        renderStocks();
        showToast(`${result.stockName} 1주 매도 완료!`);
    }
}

// 주식 전체 매도 핸들러
function sellAllStockHandler(stockId) {
    const result = sellAllStock(stockId, gameState);
    if (result.success) {
        updatePlayerInfo();
        renderStocks();
        showToast(`${result.stockName} ${result.quantity}주 전량 매도 완료!`);
    }
}

// 게임 오버 처리
function handleGameOver(message) {
    endGame();
    showGameOver(message);

    Object.keys(priceUpdateIntervals).forEach(marketId => {
        if (priceUpdateIntervals[marketId]) {
            clearInterval(priceUpdateIntervals[marketId]);
        }
    });

    const totalAssets = getTotalAssets();
    if (totalAssets <= 0 && !gameState.gameOver) {
        endGame();
        showGameOver('자산이 0 이하가 되었습니다!');
    }
}

// 게임 재시작
function restartGameHandler() {
    resetGameState();
    resetStocks();
    lastStockCreationMinute = -1;
    lastExchangeRateUpdateSecond = -1;

    hideGameOver();
    createInitialStocks();
    updatePlayerInfo();
    renderStocks();
}

// 빠른 금액 선택 버튼
function setQuickAmount(percentage) {
    const slider = document.getElementById('exchange-slider');
    const maxValue = parseInt(slider.max);
    const quickAmount = Math.floor(maxValue * percentage);
    slider.value = quickAmount;
    slider.dispatchEvent(new Event('input'));
}

// 인생 리셋 (로컬 스토리지 초기화)
function resetLife() {
    if (confirm('정말로 인생을 리셋하시겠습니까?\n모든 저장된 데이터가 삭제되고 초기 상태로 돌아갑니다.')) {
        // 로컬 스토리지 완전 초기화
        localStorage.clear();

        // 게임 상태 초기화
        resetGameState();

        // 주식 초기화
        resetStocks();

        // 타이머 변수 초기화
        lastStockCreationMinute = -1;
        lastExchangeRateUpdateSecond = -1;

        // 게임 오버 상태면 해제
        if (gameState.gameOver) {
            hideGameOver();
        }

        // 초기 주식 생성
        createInitialStocks();

        // UI 업데이트
        renderStocks();
        updatePlayerInfo();

        showToast('인생이 리셋되었습니다! 초기 자산: ₩1,000,000');
    }
}

// 전역 함수로 노출 (HTML에서 사용하기 위해)
window.buyStockHandler = buyStockHandler;
window.sellStockHandler = sellStockHandler;
window.sellAllStockHandler = sellAllStockHandler;
window.restartGame = restartGameHandler;
window.showChart = showChart;
window.closeChart = closeChart;
window.toggleDarkMode = toggleDarkMode;
window.cycleFontSize = cycleFontSize;
window.switchTab = switchTab;
window.exchangeHandler = exchangeHandler;
window.setQuickAmount = setQuickAmount;
window.resetLife = resetLife;

// 게임 시작
init();
