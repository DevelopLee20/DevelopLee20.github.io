import { stocks } from './stock.js';

// 게임 상태 관리
export const gameState = {
    cash: 10000,
    holdings: {}, // {stockId: {quantity, avgPrice}}
    isMarketOpen: false,
    gameOver: false
};

// 게임 상태 초기화
export function resetGameState() {
    gameState.cash = 10000;
    gameState.holdings = {};
    gameState.isMarketOpen = false;
    gameState.gameOver = false;
}

// 총 자산 계산
export function getTotalAssets(stocks) {
    let stockValue = 0;
    Object.entries(gameState.holdings).forEach(([stockId, holding]) => {
        const stock = stocks.find(s => s.id === parseInt(stockId));
        if (stock && !stock.delisted) {
            stockValue += stock.price * holding.quantity;
        }
    });
    return gameState.cash + stockValue;
}

// 시장 개장
export function openMarket() {
    gameState.isMarketOpen = true;
}

// 시장 휴장
export function closeMarket() {
    gameState.isMarketOpen = false;
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
            stocks: stocks
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

            // gameState 객체의 속성을 직접 갱신
            Object.assign(gameState, loadedData.gameState);

            // stocks 배열의 내용을 갱신 (참조를 유지하기 위해)
            stocks.length = 0;
            stocks.push(...loadedData.stocks);
            
            console.log('저장된 게임 상태를 불러왔습니다.');
            return true;
        }
    } catch (e) {
        console.error('게임 상태를 불러오는 데 실패했습니다:', e);
    }
    return false;
}
