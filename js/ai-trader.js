// AI 트레이더 시스템

import { createOrder, addOrderToBook, removeOrderFromBook } from './order-book.js';

// AI 트레이더 타입 정의
export const AI_TRADER_TYPES = {
    SCALPER: {
        name: '단타매매자',
        behavior: {
            orderFrequency: 2000,      // 2초마다 주문 (더 빠르게)
            orderLifetime: 8000,       // 8초 후 주문 취소
            spreadRange: 0.002,        // 현재가 대비 ±0.2%
            quantityRange: [5, 50],    // 주문 수량 증가
            aggression: 0.85           // 공격성 증가 (시장가 사용 확률)
        }
    },
    DAY_TRADER: {
        name: '데이트레이더',
        behavior: {
            orderFrequency: 8000,      // 8초마다 주문 (더 빠르게)
            orderLifetime: 40000,      // 40초 후 주문 취소
            spreadRange: 0.005,        // ±0.5%
            quantityRange: [20, 100],  // 주문 수량 증가
            aggression: 0.6            // 공격성 증가
        }
    },
    SWING_TRADER: {
        name: '스윙트레이더',
        behavior: {
            orderFrequency: 15000,     // 15초마다 주문 (더 빠르게)
            orderLifetime: 120000,     // 2분 후 주문 취소
            spreadRange: 0.01,         // ±1%
            quantityRange: [30, 150],  // 주문 수량 증가
            aggression: 0.4            // 공격성 증가
        }
    },
    INVESTOR: {
        name: '장기투자자',
        behavior: {
            orderFrequency: 30000,     // 30초마다 주문 (더 빠르게)
            orderLifetime: -1,         // 취소 안함
            spreadRange: 0.02,         // ±2%
            quantityRange: [50, 300],  // 주문 수량 증가
            aggression: 0.15           // 공격성 증가
        }
    },
    MARKET_MAKER: {
        name: '마켓메이커',
        behavior: {
            orderFrequency: 1500,      // 1.5초마다 주문 (더 빠르게)
            orderLifetime: 15000,      // 15초 후 취소
            spreadRange: 0.003,        // ±0.3%
            quantityRange: [50, 250],  // 주문 수량 증가
            aggression: 0.3,           // 공격성 증가
            alwaysBothSides: true      // 매수/매도 양쪽 동시 주문
        }
    }
};

// AI 트레이더 클래스
export class AITrader {
    constructor(id, type, stockId, marketId) {
        this.id = id;
        this.type = AI_TRADER_TYPES[type];
        this.typeName = type;
        this.stockId = stockId;
        this.marketId = marketId;
        this.activeOrders = [];
        this.lastOrderTime = 0;
    }

    // AI 주문 생성 로직
    generateOrders(stock) {
        const now = Date.now();

        // 주문 빈도 체크
        if (now - this.lastOrderTime < this.type.behavior.orderFrequency) {
            return null;
        }

        this.lastOrderTime = now;
        const currentPrice = stock.price;
        const { spreadRange, quantityRange, aggression, alwaysBothSides } = this.type.behavior;

        // 시장가로 주문할지 결정
        const useMarketOrder = Math.random() < aggression;

        const newOrders = [];

        if (alwaysBothSides) {
            // 마켓메이커: 양쪽 모두 주문
            const buyOrder = this.createBuyOrder(stock, currentPrice, spreadRange, quantityRange, false); // 마켓메이커는 항상 지정가
            const sellOrder = this.createSellOrder(stock, currentPrice, spreadRange, quantityRange, false);
            if (buyOrder) newOrders.push(buyOrder);
            if (sellOrder) newOrders.push(sellOrder);
        } else {
            // 일반 트레이더: 매수 또는 매도 중 하나
            const isBuying = Math.random() > 0.5;
            if (isBuying) {
                const buyOrder = this.createBuyOrder(stock, currentPrice, spreadRange, quantityRange, useMarketOrder);
                if (buyOrder) newOrders.push(buyOrder);
            } else {
                const sellOrder = this.createSellOrder(stock, currentPrice, spreadRange, quantityRange, useMarketOrder);
                if (sellOrder) newOrders.push(sellOrder);
            }
        }

        return newOrders;
    }

    createBuyOrder(stock, currentPrice, spreadRange, quantityRange, useMarketOrder) {
        const quantity = this.randomInRange(quantityRange[0], quantityRange[1]);
        const now = Date.now();

        let price;
        if (useMarketOrder) {
            // 시장가: 현재가로 설정 (매칭 시 최우선 매도호가와 체결됨)
            price = currentPrice * 1.01; // 현재가보다 약간 높게 설정하여 즉시 체결 유도
        } else {
            // 지정가: 현재가보다 낮은 가격으로 매수 주문
            const priceOffset = currentPrice * spreadRange * Math.random();
            price = this.roundPrice(currentPrice - priceOffset, stock.market);
        }

        const order = createOrder(
            this.stockId,
            this.marketId,
            'buy',
            useMarketOrder ? 'market' : 'limit',
            price,
            quantity,
            `ai_${this.id}`,
            this.type.name
        );

        order.expiryTime = this.type.behavior.orderLifetime === -1 ? null : now + this.type.behavior.orderLifetime;

        this.activeOrders.push(order);
        return order;
    }

    createSellOrder(stock, currentPrice, spreadRange, quantityRange, useMarketOrder) {
        const quantity = this.randomInRange(quantityRange[0], quantityRange[1]);
        const now = Date.now();

        let price;
        if (useMarketOrder) {
            // 시장가: 현재가보다 약간 낮게 설정하여 즉시 체결 유도
            price = currentPrice * 0.99;
        } else {
            // 지정가: 현재가보다 높은 가격으로 매도 주문
            const priceOffset = currentPrice * spreadRange * Math.random();
            price = this.roundPrice(currentPrice + priceOffset, stock.market);
        }

        const order = createOrder(
            this.stockId,
            this.marketId,
            'sell',
            useMarketOrder ? 'market' : 'limit',
            price,
            quantity,
            `ai_${this.id}`,
            this.type.name
        );

        order.expiryTime = this.type.behavior.orderLifetime === -1 ? null : now + this.type.behavior.orderLifetime;

        this.activeOrders.push(order);
        return order;
    }

    // 만료된 주문 취소
    cancelExpiredOrders() {
        const now = Date.now();
        const expiredOrders = [];

        this.activeOrders = this.activeOrders.filter(order => {
            if (order.expiryTime && now > order.expiryTime && order.status === 'pending') {
                // 주문장에서 제거
                removeOrderFromBook(order, this.marketId);
                order.status = 'cancelled';
                expiredOrders.push(order);
                return false;
            }
            // 체결 완료된 주문도 제거
            if (order.status === 'filled') {
                return false;
            }
            return true;
        });

        return expiredOrders;
    }

    randomInRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    roundPrice(price, market) {
        if (market === 'korea') {
            // 한국 호가 단위: 100원 단위로 통일
            return Math.round(price / 100) * 100;
        } else {
            // 미국 주식: $0.01 단위
            return Math.round(price * 100) / 100;
        }
    }
}
