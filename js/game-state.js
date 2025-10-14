import { markets } from './stock.js';

const EXCHANGE_FEE = 0.005; // 0.5% 환전 수수료

// 게임 상태 관리
export const gameState = {
    cash: { // 원화와 달러 분리
        krw: 1000000,
        usd: 0
    },
    exchangeRate: 1300, // 1달러당 원화
    holdings: {}, // {stockId: {quantity, avgPrice}}
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
    gameState.holdings = {};
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

    Object.entries(gameState.holdings).forEach(([stockId, holding]) => {
        let stock = null;
        for (const marketId in markets) {
            const found = markets[marketId].find(s => s.id === parseInt(stockId));
            if (found) {
                stock = found;
                break;
            }
        }
        
        if (stock && !stock.delisted) {
            const value = stock.price * holding.quantity;
            if (stock.market === 'korea') {
                stockKrwValue += value;
            } else if (stock.market === 'usa') {
                stockUsdValue += value;
            }
        }
    });

    const totalKrw = gameState.cash.krw + stockKrwValue;
    const totalUsdInKrw = (gameState.cash.usd + stockUsdValue) * gameState.exchangeRate;
    
    return totalKrw + totalUsdInKrw;
}

// 환율 변동
export function updateExchangeRate() {
    const change = (Math.random() - 0.49) * 0.01; // -0.5% ~ +0.5% 변동
    gameState.exchangeRate *= (1 + change);
}

// 원화 -> 달러 환전
export function exchangeKrwToUsd(krwAmount) {
    if (krwAmount <= 0 || gameState.cash.krw < krwAmount) {
        return { success: false, message: '원화가 부족합니다.' };
    }
    const usdToReceive = krwAmount / gameState.exchangeRate;
    const fee = usdToReceive * EXCHANGE_FEE;
    const finalUsd = usdToReceive - fee;

    gameState.cash.krw -= krwAmount;
    gameState.cash.usd += finalUsd;
    return { success: true };
}

// 달러 -> 원화 환전
export function exchangeUsdToKrw(usdAmount) {
    if (usdAmount <= 0 || gameState.cash.usd < usdAmount) {
        return { success: false, message: '달러가 부족합니다.' };
    }
    const krwToReceive = usdAmount * gameState.exchangeRate;
    const fee = krwToReceive * EXCHANGE_FEE;
    const finalKrw = krwToReceive - fee;

    gameState.cash.usd -= usdAmount;
    gameState.cash.krw += finalKrw;
    return { success: true };
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
            
            console.log('저장된 게임 상태를 불러왔습니다.');
            return true;
        }
    } catch (e) {
        console.error('게임 상태를 불러오는 데 실패했습니다:', e);
    }
    return false;
}
