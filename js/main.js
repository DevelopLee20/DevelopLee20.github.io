// 메인 게임 로직
import { gameState, resetGameState, getTotalAssets, openMarket, closeMarket, endGame, saveGameState, loadGameState } from './game-state.js';
import { stocks, createInitialStocks, createNewStock, updateStockPrices, buyStock, sellStock, sellAllStock, resetStocks, getActiveStocksCount } from './stock.js';
import { updateTimeDisplay, updateMarketStatus, renderStocks, updatePlayerInfo, showGameOver, hideGameOver } from './ui.js';
import { showChart, closeChart } from './chart.js';
import { toggleDarkMode, loadDarkMode, cycleFontSize, loadFontSize } from './settings.js';

// 타이머 관련
let priceUpdateInterval = null;
let lastStockCreationMinute = -1;
let lastInterestMinute = -1;

// 초기화
function init() {
    // 1. 설정 먼저 불러오기
    loadDarkMode();
    loadFontSize();

    // 2. 저장된 게임 데이터 불러오기 또는 새 게임 시작
    if (!loadGameState()) {
        createInitialStocks();
        console.log('새 게임을 시작합니다.');
    }

    // 3. 현재 시간에 맞춰 게임 상태 동기화 (중요: 첫 렌더링 전)
    updateTime();

    // 4. 동기화된 상태로 첫 화면 렌더링
    renderStocks();
    updatePlayerInfo();

    // 5. 1초마다 게임 루프 실행
    setInterval(updateTime, 1000);

    // 6. 페이지 나가기 전 자동 저장 설정
    window.addEventListener('beforeunload', saveGameState);
}

// 시간 업데이트 및 게임 로직
function updateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    updateTimeDisplay(`${hours}:${minutes}:${seconds}`);

    // 장 상태 체크
    checkMarketStatus(minutes);

    // 새 주식 생성 체크 (15분 간격: 00, 15, 30, 45)
    if (minutes % 15 === 0 && minutes !== lastStockCreationMinute) {
        createNewStock();
        renderStocks();
        lastStockCreationMinute = minutes;
    }

    // 자산 업데이트
    updatePlayerInfo();
}

// 장 상태 체크
function checkMarketStatus(minutes) {
    const minute = parseInt(minutes);
    const shouldBeOpen = (minute >= 1 && minute <= 8) ||
                         (minute >= 11 && minute <= 18) ||
                         (minute >= 21 && minute <= 28) ||
                         (minute >= 31 && minute <= 38) ||
                         (minute >= 41 && minute <= 48) ||
                         (minute >= 51 && minute <= 58);

    if (shouldBeOpen && !gameState.isMarketOpen) {
        handleMarketOpen();
    } else if (!shouldBeOpen && gameState.isMarketOpen) {
        handleMarketClose();
    }
}

// 시장 개장 처리
function handleMarketOpen() {
    openMarket();
    updateMarketStatus(true);

    // 새로운 주식 추가 (최대 10개까지)
    if (getActiveStocksCount() < 10) {
        createNewStock();
        renderStocks();
    }

    // 2초마다 주가 변동
    if (priceUpdateInterval) clearInterval(priceUpdateInterval);
    priceUpdateInterval = setInterval(() => {
        updateStockPrices();
        renderStocks();
        updatePlayerInfo();
    }, 2000);
}

// 시장 휴장 처리
function handleMarketClose() {
    closeMarket();
    updateMarketStatus(false);

    if (priceUpdateInterval) {
        clearInterval(priceUpdateInterval);
        priceUpdateInterval = null;
    }
    renderStocks(); // 휴장 시 버튼을 비활성화하기 위해 주식 목록을 다시 렌더링
}

// 주식 매수 핸들러
function buyStockHandler(stockId, quantity = 1) {
    const result = buyStock(stockId, quantity, gameState);
    if (result.success) {
        updatePlayerInfo();
        renderStocks();
    } else if (result.message) {
        alert(result.message);
    }
}

// 주식 매도 핸들러
function sellStockHandler(stockId) {
    const result = sellStock(stockId, gameState);
    if (result.success) {
        updatePlayerInfo();
        renderStocks();
    }
}

// 주식 전체 매도 핸들러
function sellAllStockHandler(stockId) {
    const result = sellAllStock(stockId, gameState);
    if (result.success) {
        updatePlayerInfo();
        renderStocks();
    }
}

// 게임 오버 처리
function handleGameOver(message) {
    endGame();
    showGameOver(message);

    if (priceUpdateInterval) {
        clearInterval(priceUpdateInterval);
    }

    // 파산 체크도 포함
    const totalAssets = getTotalAssets(stocks);
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
    lastInterestMinute = -1;

    hideGameOver();
    createInitialStocks();
    updatePlayerInfo();
    renderStocks();
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

// 게임 시작
init();
