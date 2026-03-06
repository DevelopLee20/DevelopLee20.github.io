// 메인 게임 로직
import { gameState, resetGameState, getTotalAssets, openMarket, closeMarket, endGame, saveGameState, loadGameState, updateExchangeRate, exchangeKrwToUsd, exchangeUsdToKrw } from './game-state.js';
import { markets, createInitialStocks, createNewStock, resetStocks, getActiveStocksCount, findStock, getMarketCap, startStockSession, closeStockSession, buyStockWithLeverage, closeLeveragePosition, checkLiquidations, shortSellStock, coverShortPosition } from './stock.js';
import { updateTimeDisplay, updateMarketStatus, updateMarketSessionChange, renderStocks, updatePlayerInfo, showGameOver, hideGameOver, switchTab, showToast, initializeTradingPanel, selectStock, getSelectedStockId, refreshSelectedStockPanel } from './ui.js';
import { showChart, closeChart, updateChartIfOpen } from './chart.js';
import { toggleDarkMode, loadDarkMode, cycleFontSize, loadFontSize } from './settings.js';
import { initializeMarketSimulation, loadMarketSimulationState, saveMarketSimulationState, resetMarketSimulation, simulateMarketTick, executePlayerMarketBuy, executePlayerMarketSell, clearMarketSimulationOrders } from './market-simulator.js';

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

function ensureMarketSessionState(marketId) {
    if (!gameState.marketSessionStats) {
        gameState.marketSessionStats = {};
    }

    if (!gameState.marketSessionStats[marketId]) {
        gameState.marketSessionStats[marketId] = {
            sessionStartValue: 0,
            currentChange: 0,
            currentChangePct: 0,
            lastChange: 0,
            lastChangePct: 0
        };
    }

    return gameState.marketSessionStats[marketId];
}

function getMarketTotalValue(marketId) {
    return markets[marketId].reduce((total, stock) => total + getMarketCap(stock), 0);
}

function startStockSessions(marketId) {
    markets[marketId].forEach(stock => {
        startStockSession(stock);
    });
}

function closeStockSessions(marketId) {
    markets[marketId].forEach(stock => {
        closeStockSession(stock);
    });
}

function refreshMarketSessionDisplay(marketId) {
    const sessionStats = ensureMarketSessionState(marketId);
    const isOpen = gameState.marketStatus[marketId].isOpen;
    const changeAmount = isOpen ? sessionStats.currentChange : sessionStats.lastChange;
    const changePct = isOpen ? sessionStats.currentChangePct : sessionStats.lastChangePct;
    updateMarketSessionChange(marketId, changeAmount, changePct, isOpen);
}

function startMarketSession(marketId) {
    const sessionStats = ensureMarketSessionState(marketId);
    sessionStats.sessionStartValue = getMarketTotalValue(marketId);
    sessionStats.currentChange = 0;
    sessionStats.currentChangePct = 0;
    refreshMarketSessionDisplay(marketId);
}

function updateMarketSessionStats(marketId) {
    const sessionStats = ensureMarketSessionState(marketId);
    const currentTotalValue = getMarketTotalValue(marketId);

    if (sessionStats.sessionStartValue <= 0) {
        sessionStats.sessionStartValue = currentTotalValue;
    }

    sessionStats.currentChange = currentTotalValue - sessionStats.sessionStartValue;
    sessionStats.currentChangePct = sessionStats.sessionStartValue === 0
        ? 0
        : (sessionStats.currentChange / sessionStats.sessionStartValue) * 100;

    refreshMarketSessionDisplay(marketId);
}

function closeMarketSession(marketId) {
    const sessionStats = ensureMarketSessionState(marketId);
    updateMarketSessionStats(marketId);
    sessionStats.lastChange = sessionStats.currentChange;
    sessionStats.lastChangePct = sessionStats.currentChangePct;
    sessionStats.sessionStartValue = 0;
    sessionStats.currentChange = 0;
    sessionStats.currentChangePct = 0;
    updateMarketSessionChange(marketId, sessionStats.lastChange, sessionStats.lastChangePct, false);
}

function getPreferredMarketTab() {
    if (gameState.marketStatus.korea.isOpen) {
        return 'korea';
    }

    if (gameState.marketStatus.usa.isOpen) {
        return 'usa';
    }

    return 'korea';
}

// 초기화
function init() {
    loadDarkMode();
    loadFontSize();

    if (!loadGameState()) {
        createInitialStocks();
        console.log('새 게임을 시작합니다.');
    }
    loadMarketSimulationState();
    initializeMarketSimulation(gameState.exchangeRate);

    updateTime();
    Object.keys(gameState.marketStatus).forEach(marketId => {
        updateMarketStatus(marketId, gameState.marketStatus[marketId].isOpen);
        refreshMarketSessionDisplay(marketId);
        if (gameState.marketStatus[marketId].isOpen && !priceUpdateIntervals[marketId]) {
            handleMarketOpen(marketId);
        }
    });
    switchTab(getPreferredMarketTab());
    initializeTradingPanel();

    renderStocks();
    updatePlayerInfo();
    initExchangeSlider();

    setInterval(updateTime, 1000);
    window.addEventListener('beforeunload', saveAllState);
}

function saveAllState() {
    saveGameState();
    saveMarketSimulationState();
}

// 시간 업데이트 및 게임 로직
function updateTime() {
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    updateTimeDisplay(`${String(now.getHours()).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    checkAllMarketStatus(minutes);

    // 5초마다 환율 변동
    if (seconds % 5 === 0 && seconds !== lastExchangeRateUpdateSecond) {
        updateExchangeRate();
        lastExchangeRateUpdateSecond = seconds;
    }

    if (minutes !== lastStockCreationMinute) {
        Object.keys(marketHours).forEach(marketId => {
            if (minutes % marketHours[marketId].newStockInterval === 0) {
                const newStock = createNewStock(marketId);
                if (newStock) {
                    initializeMarketSimulation(gameState.exchangeRate);
                    if (gameState.marketStatus[marketId].isOpen) {
                        startStockSession(newStock);
                        const sessionStats = ensureMarketSessionState(marketId);
                        sessionStats.sessionStartValue += getMarketCap(newStock);
                        updateMarketSessionStats(marketId);
                    }
                }
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
    console.log(`시장 개장: ${marketId}`);
    openMarket(marketId);
    updateMarketStatus(marketId, true);
    initializeMarketSimulation(gameState.exchangeRate);

    if (getActiveStocksCount(marketId) < 10) {
        createNewStock(marketId);
        initializeMarketSimulation(gameState.exchangeRate);
    }

    startMarketSession(marketId);
    startStockSessions(marketId);
    simulateMarketTick(marketId, gameState.exchangeRate);
    updateMarketSessionStats(marketId);
    renderStocks();
    updatePlayerInfo();

    // 2초마다 주문장 리빌드 및 체결
    if (priceUpdateIntervals[marketId]) clearInterval(priceUpdateIntervals[marketId]);
    priceUpdateIntervals[marketId] = setInterval(() => {
        // 1. 주문장 기반 가격 형성
        simulateMarketTick(marketId, gameState.exchangeRate);
        updateMarketSessionStats(marketId);

        // 2. 레버리지 및 숏 청산 체크
        const liquidatedPositions = checkLiquidations(gameState);
        liquidatedPositions.forEach(pos => {
            if (pos.type === 'short') {
                showToast(`${pos.stockName} 숏 포지션이 청산되었습니다!`, 'error');
            } else {
                showToast(`${pos.stockName} ${pos.leverage}x 레버리지 포지션이 청산되었습니다!`, 'error');
            }
        });

        // 3. UI 업데이트
        renderStocks();
        updatePlayerInfo();
        updateChartIfOpen(); // 차트가 열려있으면 업데이트
    }, 2000); // 2초마다 업데이트
}

// 시장 휴장 처리
function handleMarketClose(marketId) {
    closeMarketSession(marketId);
    closeStockSessions(marketId);
    closeMarket(marketId);
    updateMarketStatus(marketId, false);
    clearMarketSimulationOrders(marketId);

    if (priceUpdateIntervals[marketId]) {
        clearInterval(priceUpdateIntervals[marketId]);
        priceUpdateIntervals[marketId] = null;
    }
    renderStocks();
    updatePlayerInfo();
}

// 환전 기능 초기화 (슬라이더 제거됨)
function initExchangeSlider() {
    // 슬라이더가 제거되어 초기화 불필요
}

// 환전 핸들러 (입력 금액 사용)
function exchangeHandler(direction) {
    const inputElement = document.getElementById('exchange-amount-input');
    const usdAmount = parseInt(inputElement.value);

    if (!usdAmount || usdAmount <= 0) {
        showToast('유효한 금액을 입력하세요.', 'warning');
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
        updatePlayerInfo();
        showToast(message);
    } else {
        showToast(result.message, 'error');
    }
}

// 주식 매수 핸들러
function buyStockHandler(stockId, quantity = 1) {
    const leverageEnabled = document.getElementById('leverage-toggle')?.checked;

    if (leverageEnabled) {
        const direction = document.querySelector('input[name="leverage-direction"]:checked')?.value || 'long';
        const leverage = parseInt(document.querySelector('input[name="leverage-ratio"]:checked')?.value || '2');

        if (direction === 'short') {
            // 숏 포지션
            const result = shortSellStock(stockId, quantity, gameState);
            if (result.success) {
                updatePlayerInfo();
                renderStocks();
                const stock = findStock(stockId);
                const currencySymbol = stock.market === 'korea' ? '₩' : '$';
                const feeAmount = stock.market === 'korea' ? Math.floor(result.fee).toLocaleString() : result.fee.toFixed(2);
                const liquidationPrice = stock.market === 'korea' ? Math.floor(result.liquidationPrice).toLocaleString() : result.liquidationPrice.toFixed(2);
                showToast(`${result.stockName} ${quantity}주 숏 포지션 진입! (수수료: ${currencySymbol}${feeAmount}, 청산가: ${currencySymbol}${liquidationPrice})`);
            } else if (result.message) {
                showToast(result.message, 'error');
            }
        } else {
            // 롱 포지션 (레버리지)
            const result = buyStockWithLeverage(stockId, quantity, leverage, gameState);
            if (result.success) {
                updatePlayerInfo();
                renderStocks();
                const stock = findStock(stockId);
                const currencySymbol = stock.market === 'korea' ? '₩' : '$';
                const feeAmount = stock.market === 'korea' ? Math.floor(result.fee).toLocaleString() : result.fee.toFixed(2);
                const liquidationPrice = stock.market === 'korea' ? Math.floor(result.liquidationPrice).toLocaleString() : result.liquidationPrice.toFixed(2);
                showToast(`${result.stockName} ${quantity}주 ${leverage}x 레버리지 매수 완료! (수수료: ${currencySymbol}${feeAmount}, 청산가: ${currencySymbol}${liquidationPrice})`);
            } else if (result.message) {
                showToast(result.message, 'error');
            }
        }
    } else {
        const result = executePlayerMarketBuy(stockId, quantity);
        if (result.success) {
            updatePlayerInfo();
            renderStocks();
            const stock = findStock(stockId);
            const currencySymbol = stock.market === 'korea' ? '₩' : '$';
            const averagePrice = stock.market === 'korea'
                ? Math.round(result.averagePrice).toLocaleString()
                : result.averagePrice.toFixed(2);
            const fillText = result.partial
                ? `${result.filledQuantity}/${result.requestedQuantity}주 부분 체결`
                : `${result.filledQuantity}주 체결`;
            showToast(`${result.stockName} ${fillText} @ ${currencySymbol}${averagePrice}`);
        } else if (result.message) {
            showToast(result.message, 'error');
        }
    }
}

// 레버리지 포지션 청산 핸들러
function closeLeveragePositionHandler(positionId) {
    const result = closeLeveragePosition(positionId, gameState);
    if (result.success) {
        updatePlayerInfo();
        renderStocks();
        const stock = findStock(result.stockId || 0);
        const currencySymbol = stock?.market === 'korea' ? '₩' : '$';
        const profitLossAmount = Math.abs(result.profitLoss);
        const formattedAmount = stock?.market === 'korea' ? Math.floor(profitLossAmount).toLocaleString() : profitLossAmount.toFixed(2);
        const profitLossText = result.profitLoss >= 0 ? `+${currencySymbol}${formattedAmount}` : `-${currencySymbol}${formattedAmount}`;
        showToast(`${result.stockName} ${result.quantity}주 ${result.leverage}x 레버리지 포지션 청산 완료! (${profitLossText})`);
    }
}

// 숏 포지션 청산 핸들러
function coverShortPositionHandler(positionId) {
    const result = coverShortPosition(positionId, gameState);
    if (result.success) {
        updatePlayerInfo();
        renderStocks();
        const stock = findStock(result.stockId || 0);
        const currencySymbol = stock?.market === 'korea' ? '₩' : '$';
        const profitLossAmount = Math.abs(result.profitLoss);
        const formattedAmount = stock?.market === 'korea' ? Math.floor(profitLossAmount).toLocaleString() : profitLossAmount.toFixed(2);
        const profitLossText = result.profitLoss >= 0 ? `+${currencySymbol}${formattedAmount}` : `-${currencySymbol}${formattedAmount}`;
        showToast(`${result.stockName} ${result.quantity}주 숏 포지션 청산 완료! (${profitLossText})`);
    }
}

// 주식 매도 핸들러
function sellStockHandler(stockId) {
    const stock = findStock(stockId);
    const result = executePlayerMarketSell(stockId, 1);
    if (result.success) {
        updatePlayerInfo();
        renderStocks();
        const currencySymbol = stock.market === 'korea' ? '₩' : '$';
        const averagePrice = stock.market === 'korea'
            ? Math.round(result.averagePrice).toLocaleString()
            : result.averagePrice.toFixed(2);
        showToast(`${result.stockName} ${result.filledQuantity}주 매도 체결 @ ${currencySymbol}${averagePrice}`);
    } else if (result.message) {
        showToast(result.message, 'error');
    }
}

// 주식 전체 매도 핸들러
function sellAllStockHandler(stockId) {
    const stock = findStock(stockId);

    if (!stock) {
        showToast('주식을 찾을 수 없습니다.', 'error');
        return;
    }

    const quantity = gameState.holdings[stockId]?.quantity || 0;
    const result = executePlayerMarketSell(stockId, quantity);
    if (result.success) {
        updatePlayerInfo();
        renderStocks();
        const currencySymbol = stock.market === 'korea' ? '₩' : '$';
        const averagePrice = stock.market === 'korea'
            ? Math.round(result.averagePrice).toLocaleString()
            : result.averagePrice.toFixed(2);
        const fillText = result.partial
            ? `${result.filledQuantity}/${result.requestedQuantity}주 부분 체결`
            : `${result.filledQuantity}주 전량 체결`;
        const message = `${result.stockName} ${fillText} @ ${currencySymbol}${averagePrice}`;
        showToast(message);
    } else {
        showToast(result.message || '매도에 실패했습니다.', 'error');
    }
}

// 게임 오버 처리
function getSelectedOrderQuantity() {
    const quantityInput = document.getElementById('selected-order-quantity');
    const parsedQuantity = parseInt(quantityInput?.value || '1', 10);
    return Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;
}

function setOrderQuantity(quantity) {
    const quantityInput = document.getElementById('selected-order-quantity');
    if (!quantityInput) {
        return;
    }

    quantityInput.value = String(Math.max(1, Math.floor(quantity)));
    refreshSelectedStockPanel();
}

function setOrderToMax() {
    const stockId = getSelectedStockId();
    const stock = findStock(stockId);
    if (!stock) {
        showToast('종목을 먼저 선택하세요.', 'warning');
        return;
    }

    const quantityInput = document.getElementById('selected-order-quantity');
    const currency = stock.market === 'korea' ? 'krw' : 'usd';
    const availableHolding = gameState.holdings[stockId]?.quantity || 0;
    const affordableQuantity = Math.max(1, Math.floor(gameState.cash[currency] / Math.max(stock.price, 1)));
    const targetQuantity = availableHolding > 0 ? availableHolding : affordableQuantity;

    if (quantityInput) {
        quantityInput.value = String(Math.max(1, targetQuantity));
    }
    refreshSelectedStockPanel();
}

function submitSelectedOrder(direction) {
    const stockId = getSelectedStockId();
    const stock = findStock(stockId);
    if (!stock) {
        showToast('종목을 먼저 선택하세요.', 'warning');
        return;
    }

    const quantity = getSelectedOrderQuantity();
    if (direction === 'buy') {
        const result = executePlayerMarketBuy(stockId, quantity);
        if (result.success) {
            updatePlayerInfo();
            renderStocks();
            const averagePrice = stock.market === 'korea'
                ? Math.round(result.averagePrice).toLocaleString()
                : result.averagePrice.toFixed(2);
            const fillText = result.partial
                ? `${result.filledQuantity}/${result.requestedQuantity}주 부분 체결`
                : `${result.filledQuantity}주 체결`;
            showToast(`${result.stockName} ${fillText} @ ${stock.market === 'korea' ? '₩' : '$'}${averagePrice}`);
        } else if (result.message) {
            showToast(result.message, 'error');
        }
        return;
    }

    const result = executePlayerMarketSell(stockId, quantity);
    if (result.success) {
        updatePlayerInfo();
        renderStocks();
        const averagePrice = stock.market === 'korea'
            ? Math.round(result.averagePrice).toLocaleString()
            : result.averagePrice.toFixed(2);
        const fillText = result.partial
            ? `${result.filledQuantity}/${result.requestedQuantity}주 부분 체결`
            : `${result.filledQuantity}주 체결`;
        showToast(`${result.stockName} ${fillText} @ ${stock.market === 'korea' ? '₩' : '$'}${averagePrice}`);
    } else if (result.message) {
        showToast(result.message, 'error');
    }
}

function submitSelectedLeverageOrder() {
    const leverageEnabled = document.getElementById('leverage-toggle')?.checked;
    if (!leverageEnabled) {
        showToast('레버리지/숏 주문을 켜야 합니다.', 'warning');
        return;
    }

    const stockId = getSelectedStockId();
    const stock = findStock(stockId);
    if (!stock) {
        showToast('종목을 먼저 선택하세요.', 'warning');
        return;
    }

    const quantity = getSelectedOrderQuantity();
    const direction = document.querySelector('input[name="leverage-direction"]:checked')?.value || 'long';
    const leverage = parseInt(document.querySelector('input[name="leverage-ratio"]:checked')?.value || '2', 10);

    if (direction === 'short') {
        const result = shortSellStock(stockId, quantity, gameState);
        if (result.success) {
            updatePlayerInfo();
            renderStocks();
            const feeAmount = stock.market === 'korea' ? Math.floor(result.fee).toLocaleString() : result.fee.toFixed(2);
            const liquidationPrice = stock.market === 'korea' ? Math.floor(result.liquidationPrice).toLocaleString() : result.liquidationPrice.toFixed(2);
            showToast(`${result.stockName} ${quantity}주 숏 진입 완료 (수수료 ${stock.market === 'korea' ? '₩' : '$'}${feeAmount}, 청산가 ${stock.market === 'korea' ? '₩' : '$'}${liquidationPrice})`);
        } else if (result.message) {
            showToast(result.message, 'error');
        }
        return;
    }

    const result = buyStockWithLeverage(stockId, quantity, leverage, gameState);
    if (result.success) {
        updatePlayerInfo();
        renderStocks();
        const feeAmount = stock.market === 'korea' ? Math.floor(result.fee).toLocaleString() : result.fee.toFixed(2);
        const liquidationPrice = stock.market === 'korea' ? Math.floor(result.liquidationPrice).toLocaleString() : result.liquidationPrice.toFixed(2);
        showToast(`${result.stockName} ${quantity}주 ${leverage}x 롱 진입 완료 (수수료 ${stock.market === 'korea' ? '₩' : '$'}${feeAmount}, 청산가 ${stock.market === 'korea' ? '₩' : '$'}${liquidationPrice})`);
    } else if (result.message) {
        showToast(result.message, 'error');
    }
}

function openSelectedChart() {
    const stockId = getSelectedStockId();
    if (stockId === null || stockId === undefined) {
        showToast('차트를 볼 종목을 먼저 선택하세요.', 'warning');
        return;
    }

    showChart(stockId);
}

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
    resetMarketSimulation();
    lastStockCreationMinute = -1;
    lastExchangeRateUpdateSecond = -1;

    hideGameOver();
    createInitialStocks();
    initializeMarketSimulation(gameState.exchangeRate);
    switchTab(getPreferredMarketTab());
    updatePlayerInfo();
    renderStocks();
    refreshSelectedStockPanel();
}


// 인생 리셋 (로컬 스토리지 초기화)
function resetLife() {
    if (confirm('정말로 인생을 리셋하시겠습니까?\n모든 저장된 데이터가 삭제되고 초기 상태로 돌아갑니다.')) {
        // 로컬 스토리지 완전 초기화
        window.removeEventListener('beforeunload', saveAllState);
        localStorage.clear();

        // 페이지 새로고침하여 모든 상태를 완전히 초기화
        window.location.reload();
    }
}


// 전역 함수로 노출 (HTML에서 사용하기 위해)
window.buyStockHandler = buyStockHandler;
window.sellStockHandler = sellStockHandler;
window.sellAllStockHandler = sellAllStockHandler;
window.closeLeveragePositionHandler = closeLeveragePositionHandler;
window.coverShortPositionHandler = coverShortPositionHandler;
window.restartGame = restartGameHandler;
window.showChart = showChart;
window.openSelectedChart = openSelectedChart;
window.closeChart = closeChart;
window.toggleDarkMode = toggleDarkMode;
window.cycleFontSize = cycleFontSize;
window.switchTab = switchTab;
window.selectStock = selectStock;
window.setOrderQuantity = setOrderQuantity;
window.setOrderToMax = setOrderToMax;
window.submitSelectedOrder = submitSelectedOrder;
window.submitSelectedLeverageOrder = submitSelectedLeverageOrder;
window.exchangeHandler = exchangeHandler;
window.resetLife = resetLife;

// 게임 시작
console.log('main.js 로드 완료');
console.log('전역 함수 확인:', {
    buyStockHandler: typeof window.buyStockHandler,
    exchangeHandler: typeof window.exchangeHandler
});
init();
