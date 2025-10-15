// 메인 게임 로직
import { gameState, resetGameState, getTotalAssets, openMarket, closeMarket, endGame, saveGameState, loadGameState, updateExchangeRate, exchangeKrwToUsd, exchangeUsdToKrw, calculateExchangeFee, processTrades } from './game-state.js';
import { markets, createInitialStocks, createNewStock, buyStock, sellStock, sellAllStock, resetStocks, getActiveStocksCount, findStock, buyStockWithLeverage, closeLeveragePosition, checkLiquidations, updateStockStateFromOrderBook } from './stock.js';
import { updateTimeDisplay, updateMarketStatus, renderStocks, updatePlayerInfo, showGameOver, hideGameOver, switchTab, showToast, openOrderBook, closeOrderBook, switchOrderType, onOrderMethodChange, updateOrderBookIfOpen, getCurrentOrderBookStockId } from './ui.js';
import { showChart, closeChart, updateChartIfOpen } from './chart.js';
import { toggleDarkMode, loadDarkMode, cycleFontSize, loadFontSize } from './settings.js';
import { updateAllAITraders, initializeMarketAITraders, resetAITraders, aiTraderPool } from './ai-trader-manager.js';
import { createOrder, addOrderToBook, matchOrders, cancelOrder, resetOrderBook, getOrderBookDepth, getRecentTrades } from './order-book.js';

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
            handleMarketOpen(marketId);
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
    console.log(`시장 개장: ${marketId}`);
    openMarket(marketId);
    updateMarketStatus(marketId, true);

    if (getActiveStocksCount(marketId) < 10) {
        createNewStock(marketId);
    }

    // AI 트레이더 초기화
    console.log(`AI 트레이더 초기화 시작: ${marketId}`);
    initializeMarketAITraders(marketId);
    console.log(`AI 트레이더 초기화 완료: ${marketId}`);

    renderStocks();

    if (priceUpdateIntervals[marketId]) clearInterval(priceUpdateIntervals[marketId]);
    priceUpdateIntervals[marketId] = setInterval(() => {
        // 1. AI 트레이더 활동 업데이트
        updateAllAITraders(marketId);

        // 2. 모든 주식의 주문 매칭 및 거래 처리
        markets[marketId].forEach(stock => {
            if (!stock.delisted) {
                const trades = matchOrders(stock.id, marketId, stock);
                if (trades.length > 0) {
                    processTrades(trades);
                }
            }
        });

        // 3. 주가 상태 업데이트 (호가창 기반)
        markets[marketId].forEach(stock => {
            if (!stock.delisted) {
                updateStockStateFromOrderBook(stock);
            }
        });

        // 4. 레버리지 청산 체크
        const liquidatedPositions = checkLiquidations(gameState);
        liquidatedPositions.forEach(pos => {
            showToast(`${pos.stockName} ${pos.leverage}x 레버리지 포지션이 청산되었습니다!`, 'error');
        });

        // 5. UI 업데이트
        renderStocks();
        updatePlayerInfo();
        updateOrderBookIfOpen(); // 호가창이 열려있으면 업데이트
        updateChartIfOpen(); // 차트가 열려있으면 업데이트
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
        const leverage = parseInt(document.querySelector('input[name="leverage-ratio"]:checked')?.value || '2');
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
    } else {
        const result = buyStock(stockId, quantity, gameState);
        if (result.success) {
            updatePlayerInfo();
            renderStocks();
            showToast(`${result.stockName} ${quantity}주 매수 완료!`);
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

// 주식 매도 핸들러
function sellStockHandler(stockId) {
    const stock = findStock(stockId); // 매도 전에 주식 정보 가져오기
    const result = sellStock(stockId, 1, gameState);
    if (result.success) {
        updatePlayerInfo();
        renderStocks();
        const currencySymbol = stock.market === 'korea' ? '₩' : '$';
        const feeAmount = stock.market === 'korea' ? Math.floor(result.fee).toLocaleString() : result.fee.toFixed(2);
        showToast(`${result.stockName} 1주 매도 완료! (수수료: ${currencySymbol}${feeAmount})`);
    }
}

// 주식 전체 매도 핸들러
function sellAllStockHandler(stockId) {
    console.log('sellAllStockHandler 시작 - stockId:', stockId);
    const stock = findStock(stockId); // 매도 전에 주식 정보 가져오기
    console.log('stock:', stock);

    if (!stock) {
        showToast('주식을 찾을 수 없습니다.', 'error');
        return;
    }

    const result = sellAllStock(stockId, gameState);
    console.log('result:', result);
    if (result.success) {
        updatePlayerInfo();
        renderStocks();
        const currencySymbol = stock.market === 'korea' ? '₩' : '$';
        const feeAmount = stock.market === 'korea' ? Math.floor(result.fee).toLocaleString() : result.fee.toFixed(2);
        console.log('전량 매도 디버그:', {
            stockName: result.stockName,
            quantity: result.quantity,
            fee: result.fee,
            feeAmount: feeAmount,
            currencySymbol: currencySymbol,
            market: stock.market
        });
        const message = `${result.stockName} ${result.quantity}주 전량 매도 완료! (수수료: ${currencySymbol}${feeAmount})`;
        console.log('토스트 메시지:', message);
        showToast(message);
    } else {
        console.log('매도 실패');
        showToast('매도에 실패했습니다.', 'error');
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
    resetAITraders();
    resetOrderBook();
    lastStockCreationMinute = -1;
    lastExchangeRateUpdateSecond = -1;

    hideGameOver();
    createInitialStocks();
    updatePlayerInfo();
    renderStocks();
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

        // AI 트레이더 초기화
        resetAITraders();

        // 주문장 초기화
        resetOrderBook();

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

// 주문 제출 핸들러
function submitOrder() {
    if (!getCurrentOrderBookStockId()) return;

    const stock = findStock(getCurrentOrderBookStockId());
    if (!stock) return;

    const orderType = document.getElementById('buy-tab').classList.contains('active') ? 'buy' : 'sell';
    const orderMethod = document.querySelector('input[name="order-method"]:checked').value;
    const priceInput = document.getElementById('order-price');
    const quantityInput = document.getElementById('order-quantity');

    const quantity = parseInt(quantityInput.value);
    if (!quantity || quantity <= 0) {
        showToast('수량을 입력하세요.', 'error');
        return;
    }

    let price = null;
    if (orderMethod === 'limit') {
        price = parseFloat(priceInput.value);
        if (!price || price <= 0) {
            showToast('가격을 입력하세요.', 'error');
            return;
        }
    } else {
        // 시장가: 즉시 체결을 위해 극단적인 가격으로 설정
        price = orderType === 'buy' ? stock.price * 1.5 : stock.price * 0.5;
    }

    const currency = stock.market === 'korea' ? 'krw' : 'usd';
    const totalCost = price * quantity;

    // 자금 확인
    if (orderType === 'buy') {
        if (gameState.cash[currency] < totalCost) {
            const currencyName = currency === 'krw' ? '원화' : '달러';
            showToast(`${currencyName}가 부족합니다!`, 'error');
            return;
        }
    } else {
        // 매도: 보유 주식 확인
        const holding = gameState.holdings[stock.id];
        if (!holding || holding.quantity < quantity) {
            showToast('보유 주식이 부족합니다!', 'error');
            return;
        }
    }

    // 주문 생성
    const order = createOrder(stock.id, stock.market, orderType, orderMethod, price, quantity, 'player');
    addOrderToBook(order, stock.market);

    // 즉시 매칭 시도
    const trades = matchOrders(stock.id, stock.market, stock);

    // 플레이어 관련 체결 필터링
    const playerTrades = trades.filter(t => t.buyUserId === 'player' || t.sellUserId === 'player');

    // 체결 확인
    if (order.status === 'filled') {
        // 완전 체결 - 실제 체결 가격으로 계산
        if (orderType === 'buy') {
            // 매수: 자금 차감, 주식 추가
            let actualTotalCost = 0;
            playerTrades.forEach(trade => {
                if (trade.buyUserId === 'player') {
                    actualTotalCost += trade.price * trade.quantity;
                }
            });
            gameState.cash[currency] -= actualTotalCost;
            if (!gameState.holdings[stock.id]) {
                gameState.holdings[stock.id] = { quantity: 0, avgPrice: 0 };
            }
            const holding = gameState.holdings[stock.id];
            const totalPrevCost = holding.avgPrice * holding.quantity;
            holding.quantity += quantity;
            holding.avgPrice = (totalPrevCost + actualTotalCost) / holding.quantity;
        } else {
            // 매도: 주식 차감, 자금 증가
            let actualRevenue = 0;
            playerTrades.forEach(trade => {
                if (trade.sellUserId === 'player') {
                    actualRevenue += trade.price * trade.quantity * 0.99; // 1% 수수료
                }
            });
            gameState.cash[currency] += actualRevenue;
            gameState.holdings[stock.id].quantity -= quantity;
            if (gameState.holdings[stock.id].quantity === 0) {
                delete gameState.holdings[stock.id];
            }
        }
        showToast(`${orderMethod === 'limit' ? '지정가' : '시장가'} ${orderType === 'buy' ? '매수' : '매도'} ${quantity}주 체결 완료!`);
    } else if (order.status === 'partial') {
        showToast(`부분 체결: ${quantity - order.remainingQuantity}/${quantity}주`, 'warning');
    } else {
        showToast(`주문 등록 완료: ${orderMethod === 'limit' ? '지정가' : '시장가'} ${orderType === 'buy' ? '매수' : '매도'} ${quantity}주`);
    }

    // 입력 필드 초기화
    quantityInput.value = '1';
    if (orderMethod === 'limit') {
        priceInput.value = '';
    }

    // UI 업데이트
    updatePlayerInfo();
    updateOrderBookIfOpen();
}

// 주문 취소 핸들러
function cancelOrderHandler(orderId) {
    const result = cancelOrder(orderId, getCurrentOrderBookStockId() ? findStock(getCurrentOrderBookStockId()).market : 'korea');
    if (result.success) {
        showToast('주문이 취소되었습니다.');
        updateOrderBookIfOpen();
    } else {
        showToast('주문 취소에 실패했습니다.', 'error');
    }
}

// 전역 함수로 노출 (HTML에서 사용하기 위해)
window.buyStockHandler = buyStockHandler;
window.sellStockHandler = sellStockHandler;
window.sellAllStockHandler = sellAllStockHandler;
window.closeLeveragePositionHandler = closeLeveragePositionHandler;
window.restartGame = restartGameHandler;
window.showChart = showChart;
window.closeChart = closeChart;
window.toggleDarkMode = toggleDarkMode;
window.cycleFontSize = cycleFontSize;
window.switchTab = switchTab;
window.exchangeHandler = exchangeHandler;
window.resetLife = resetLife;
window.openOrderBook = openOrderBook;
window.closeOrderBook = closeOrderBook;
window.submitOrder = submitOrder;
window.switchOrderType = switchOrderType;
window.cancelOrderHandler = cancelOrderHandler;
window.onOrderMethodChange = onOrderMethodChange;

// 디버그용: AI 트레이더 풀 노출
window.aiTraderPool = aiTraderPool;

// 디버그용: 호가창 데이터 확인 함수
window.debugOrderBook = function(stockId, marketId = 'korea') {
    const stock = findStock(stockId);
    if (!stock) {
        console.error('주식을 찾을 수 없습니다. stockId:', stockId);
        return;
    }

    const depth = getOrderBookDepth(stockId, marketId, 10);
    console.log(`===== ${stock.name} (${stock.market}) 호가창 디버그 =====`);
    console.log('현재가:', stock.price);
    console.log('\n매도 호가 (높은 가격부터):');
    depth.sellOrders.slice().reverse().forEach((order, idx) => {
        console.log(`  ${5-idx}. 가격: ${order.price.toLocaleString()}, 수량: ${order.quantity}`);
    });
    console.log('\n매수 호가 (높은 가격부터):');
    depth.buyOrders.forEach((order, idx) => {
        console.log(`  ${idx+1}. 가격: ${order.price.toLocaleString()}, 수량: ${order.quantity}`);
    });

    const trades = getRecentTrades(stockId, marketId, 5);
    console.log('\n최근 체결 내역:');
    trades.forEach((trade, idx) => {
        console.log(`  ${idx+1}. 가격: ${trade.price.toLocaleString()}, 수량: ${trade.quantity}, 시간: ${new Date(trade.timestamp).toLocaleTimeString()}`);
    });
};

// 게임 시작
console.log('main.js 로드 완료');
console.log('전역 함수 확인:', {
    buyStockHandler: typeof window.buyStockHandler,
    openOrderBook: typeof window.openOrderBook,
    exchangeHandler: typeof window.exchangeHandler
});
init();
