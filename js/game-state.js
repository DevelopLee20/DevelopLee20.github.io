// 게임 상태 관리
export const gameState = {
    cash: 10000,
    loan: 0,
    holdings: {}, // {stockId: {quantity, avgPrice}}
    isMarketOpen: false,
    gameOver: false
};

// 게임 상태 초기화
export function resetGameState() {
    gameState.cash = 10000;
    gameState.loan = 0;
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
    return gameState.cash + stockValue - gameState.loan;
}

// 대출 받기
export function takeLoan() {
    if (gameState.gameOver) return false;

    gameState.cash += 10000;
    gameState.loan += 10000;
    return true;
}

// 대출 갚기
export function repayLoan() {
    if (gameState.gameOver) return { success: false, message: '게임이 종료되었습니다.' };

    const repayAmount = Math.min(10000, gameState.loan, gameState.cash);

    if (repayAmount <= 0) {
        if (gameState.loan <= 0) {
            return { success: false, message: '갚을 대출이 없습니다!' };
        } else {
            return { success: false, message: '현금이 부족합니다!' };
        }
    }

    gameState.cash -= repayAmount;
    gameState.loan -= repayAmount;
    return { success: true };
}

// 이자 부과
export function chargeInterest() {
    if (gameState.loan > 0) {
        const interest = gameState.loan * 0.1;
        gameState.cash -= interest;
        return interest;
    }
    return 0;
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
