import { markets, setStockIdCounter } from './stock.js';

const EXCHANGE_FEE = 0.01; // 1% 환전 수수료

// 게임 상태 관리
export const gameState = {
    cash: { // 원화와 달러 분리
        krw: 1000000,
        usd: 0
    },
    exchangeRate: 1300, // 1달러당 원화
    prevExchangeRate: 1300, // 이전 환율 (변동 추적용)
    holdings: {}, // {stockId: {quantity, avgPrice}}
    leveragedPositions: [], // [{id, stockId, quantity, entryPrice, leverage, ownCapital, borrowedAmount, liquidationPrice}]
    leverageIdCounter: 0, // 레버리지 포지션 ID 카운터
    marketStatus: {
        korea: { isOpen: false },
        usa: { isOpen: false }
    },
    gameOver: false
};

// 게임 상태 초기화
export function resetGameState() {
    gameState.cash = { krw: 1000000, usd: 0 };
    gameState.exchangeRate = 1300;
    gameState.prevExchangeRate = 1300;
    gameState.holdings = {};
    gameState.leveragedPositions = [];
    gameState.leverageIdCounter = 0;
    gameState.marketStatus = {
        korea: { isOpen: false },
        usa: { isOpen: false }
    };
    gameState.gameOver = false;
}

// 총 자산 계산 (원화 기준)
export function getTotalAssets() {
    let stockKrwValue = 0;
    let stockUsdValue = 0;

    // 일반 보유 주식
    Object.entries(gameState.holdings).forEach(([stockId, holding]) => {
        let stock = null;
        for (const marketId in markets) {
            const found = markets[marketId].find(s => s.id === parseInt(stockId));
            if (found) {
                stock = found;
                break;
            }
        }

        if (stock) {
            const value = stock.price * holding.quantity;
            if (stock.market === 'korea') {
                stockKrwValue += value;
            } else if (stock.market === 'usa') {
                stockUsdValue += value;
            }
        }
    });

    // 레버리지 포지션
    gameState.leveragedPositions.forEach(position => {
        let stock = null;
        for (const marketId in markets) {
            const found = markets[marketId].find(s => s.id === position.stockId);
            if (found) {
                stock = found;
                break;
            }
        }

        if (stock) {
            const currentValue = stock.price * position.quantity;
            const profitLoss = currentValue - position.borrowedAmount - position.ownCapital;
            const positionValue = position.ownCapital + profitLoss;

            if (stock.market === 'korea') {
                stockKrwValue += positionValue;
            } else if (stock.market === 'usa') {
                stockUsdValue += positionValue;
            }
        }
    });

    const totalKrw = gameState.cash.krw + stockKrwValue;
    const totalUsdInKrw = (gameState.cash.usd + stockUsdValue) * gameState.exchangeRate;

    return totalKrw + totalUsdInKrw;
}

// 환율 변동
export function updateExchangeRate() {
    gameState.prevExchangeRate = gameState.exchangeRate;
    const change = (Math.random() - 0.49) * 0.01; // -0.5% ~ +0.5% 변동
    gameState.exchangeRate *= (1 + change);
}

// 환율 변동 방향 가져오기
export function getExchangeRateChange() {
    if (gameState.exchangeRate > gameState.prevExchangeRate) {
        return 'up'; // 환율 상승 (원화 가치 하락)
    } else if (gameState.exchangeRate < gameState.prevExchangeRate) {
        return 'down'; // 환율 하락 (원화 가치 상승)
    }
    return 'same';
}

// 환전 수수료 계산
export function calculateExchangeFee(amount, direction) {
    if (direction === 'krw_to_usd') {
        const usdAmount = amount / gameState.exchangeRate;
        const fee = usdAmount * EXCHANGE_FEE;
        return Math.floor(fee * gameState.exchangeRate); // 원화로 반환
    } else {
        const krwAmount = amount * gameState.exchangeRate;
        const fee = krwAmount * EXCHANGE_FEE;
        return Math.floor(fee); // 원화로 반환
    }
}

// 원화 -> 달러 환전
export function exchangeKrwToUsd(krwAmount) {
    if (krwAmount <= 0 || gameState.cash.krw < krwAmount) {
        return { success: false, message: '원화가 부족합니다.' };
    }
    const usdToReceive = krwAmount / gameState.exchangeRate;
    const fee = usdToReceive * EXCHANGE_FEE;
    const finalUsd = usdToReceive - fee;
    const feeInKrw = Math.floor(fee * gameState.exchangeRate);

    gameState.cash.krw -= krwAmount;
    gameState.cash.usd += finalUsd;

    return { success: true, fee: feeInKrw };
}

// 달러 -> 원화 환전
export function exchangeUsdToKrw(usdAmount) {
    if (usdAmount <= 0 || gameState.cash.usd < usdAmount) {
        return { success: false, message: '달러가 부족합니다.' };
    }
    const krwToReceive = usdAmount * gameState.exchangeRate;
    const fee = krwToReceive * EXCHANGE_FEE;
    const finalKrw = krwToReceive - fee;
    const feeInKrw = Math.floor(fee);

    gameState.cash.usd -= usdAmount;
    gameState.cash.krw += finalKrw;

    return { success: true, fee: feeInKrw };
}


// 시장 개장
export function openMarket(marketId) {
    if (gameState.marketStatus[marketId]) {
        gameState.marketStatus[marketId].isOpen = true;
    }
}

// 시장 휴장
export function closeMarket(marketId) {
    if (gameState.marketStatus[marketId]) {
        gameState.marketStatus[marketId].isOpen = false;
    }
}

// 게임 종료
export function endGame() {
    gameState.gameOver = true;
}

// 게임 상태 저장
export function saveGameState() {
    try {
        const saveData = {
            gameState: gameState,
            markets: markets
        };
        localStorage.setItem('stockGameState', JSON.stringify(saveData));
        console.log('게임 상태가 저장되었습니다.');
    } catch (e) {
        console.error('게임 상태를 저장하는 데 실패했습니다:', e);
    }
}

// 거래 체결 처리
export function processTrades(trades) {
    // 호가창 시스템에서 주문 매칭은 order-book.js에서 처리되므로
    // 여기서는 빈 함수로 유지 (향후 체결 로그 등 추가 기능 구현 가능)
}

// 게임 상태 불러오기
export function loadGameState() {
    try {
        const savedData = localStorage.getItem('stockGameState');
        if (savedData) {
            const loadedData = JSON.parse(savedData);

            // 이전 버전의 cash가 숫자인 경우 객체로 변환
            if (typeof loadedData.gameState.cash === 'number') {
                loadedData.gameState.cash = { krw: loadedData.gameState.cash, usd: 10000 };
                loadedData.gameState.exchangeRate = 1300;
            }

            Object.assign(gameState, loadedData.gameState);

            if (loadedData.markets) {
                Object.keys(markets).forEach(marketId => {
                    markets[marketId].length = 0;
                    if(loadedData.markets[marketId]) {
                        markets[marketId].push(...loadedData.markets[marketId]);
                    }
                });
            } else if (loadedData.stocks) {
                markets.korea.length = 0;
                markets.korea.push(...loadedData.stocks);
                markets.usa.length = 0;
            }

            // stockIdCounter 복원 (가장 큰 ID + 1로 설정)
            let maxId = -1;
            Object.keys(markets).forEach(marketId => {
                markets[marketId].forEach(stock => {
                    if (stock.id > maxId) {
                        maxId = stock.id;
                    }
                });
            });
            if (maxId >= 0) {
                setStockIdCounter(maxId + 1);
            }

            console.log('저장된 게임 상태를 불러왔습니다.');
            return true;
        }
    } catch (e) {
        console.error('게임 상태를 불러오는 데 실패했습니다:', e);
    }
    return false;
}
