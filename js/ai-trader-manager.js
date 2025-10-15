// AI 트레이더 관리 시스템

import { AITrader, AI_TRADER_TYPES } from './ai-trader.js';
import { addOrderToBook, matchOrders, initOrderBook } from './order-book.js';
import { markets, findStock } from './stock.js';

// 각 주식별 AI 트레이더 풀
export const aiTraderPool = {
    korea: {},  // {stockId: [AITrader instances]}
    usa: {}
};

// 주식당 AI 트레이더 생성
export function initializeAITraders(stockId, marketId) {
    if (!aiTraderPool[marketId][stockId]) {
        aiTraderPool[marketId][stockId] = [];
    }

    const traders = aiTraderPool[marketId][stockId];

    // 이미 AI가 있으면 생성 안함
    if (traders.length > 0) {
        return;
    }

    // 각 타입별 AI 생성 (주식당 100명의 AI)
    const traderTypes = Object.keys(AI_TRADER_TYPES);
    const numTraders = 100; // 100명 고정

    for (let i = 0; i < numTraders; i++) {
        const randomType = traderTypes[Math.floor(Math.random() * traderTypes.length)];
        const trader = new AITrader(`${stockId}_${i}`, randomType, stockId, marketId);
        traders.push(trader);
    }

    // 주문장 초기화
    initOrderBook(stockId, marketId);

    console.log(`${marketId} - Stock ${stockId}: ${numTraders}명의 AI 트레이더 생성`);
}

// 모든 AI 트레이더 업데이트 (주기적 실행)
export function updateAllAITraders(marketId) {
    markets[marketId].forEach(stock => {
        if (stock.delisted) return;

        // AI 트레이더 풀이 없으면 생성
        if (!aiTraderPool[marketId][stock.id]) {
            initializeAITraders(stock.id, marketId);
        }

        const traders = aiTraderPool[marketId][stock.id];

        traders.forEach(trader => {
            // 1. 만료된 주문 취소
            trader.cancelExpiredOrders();

            // 2. 새 주문 생성
            const newOrders = trader.generateOrders(stock);

            // 3. 주문장에 등록
            if (newOrders && newOrders.length > 0) {
                newOrders.forEach(order => {
                    addOrderToBook(order, marketId);
                });
            }
        });

        // 4. 주문 매칭 실행
        matchOrders(stock.id, marketId, stock);
    });
}

// 거래량에 따라 AI 수 조정 (선택사항)
export function adjustAITradersByVolume(stockId, marketId, volumeChange) {
    const traders = aiTraderPool[marketId][stockId];

    if (!traders) return;

    if (volumeChange > 0.5 && traders.length < 20) {
        // 거래 급증: AI 추가
        const randomType = Object.keys(AI_TRADER_TYPES)[Math.floor(Math.random() * 5)];
        const newTrader = new AITrader(`${stockId}_${traders.length}`, randomType, stockId, marketId);
        traders.push(newTrader);
        console.log(`${marketId} - Stock ${stockId}: AI 트레이더 추가 (현재 ${traders.length}명)`);
    } else if (volumeChange < -0.3 && traders.length > 3) {
        // 거래 감소: AI 제거
        traders.pop();
        console.log(`${marketId} - Stock ${stockId}: AI 트레이더 제거 (현재 ${traders.length}명)`);
    }
}

// 특정 주식의 AI 트레이더 정보 가져오기
export function getAITradersInfo(stockId, marketId) {
    const traders = aiTraderPool[marketId][stockId];
    if (!traders) return { count: 0, types: {} };

    const types = {};
    traders.forEach(trader => {
        const typeName = trader.type.name;
        if (!types[typeName]) {
            types[typeName] = 0;
        }
        types[typeName]++;
    });

    return {
        count: traders.length,
        types: types
    };
}

// AI 트레이더 풀 초기화
export function resetAITraders() {
    Object.keys(aiTraderPool.korea).forEach(stockId => {
        aiTraderPool.korea[stockId] = [];
    });
    Object.keys(aiTraderPool.usa).forEach(stockId => {
        aiTraderPool.usa[stockId] = [];
    });
}

// 시장 개장 시 모든 주식에 AI 트레이더 초기화
export function initializeMarketAITraders(marketId) {
    markets[marketId].forEach(stock => {
        if (!stock.delisted) {
            initializeAITraders(stock.id, marketId);
        }
    });
}
