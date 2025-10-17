// cannon-es의 World를 설정하고 물리 관련 상수와 유틸리티를 정의합니다.

import * as CANNON from 'cannon-es';

// 충돌 그룹 상수 정의 (비트마스크)
export const COLLISION_GROUPS = {
    NONE: 0,
    CLAW:   1 << 0, // 1
    PRIZE:  1 << 1, // 2
    ENV:    1 << 2, // 4
    SENSOR: 1 << 3, // 8
};

/**
 * cannon-es 물리 월드를 초기화합니다.
 * @returns {CANNON.World}
 */
export function initPhysics() {
    const world = new CANNON.World();
    
    // 중력 설정
    world.gravity.set(0, -9.82, 0);

    // 성능을 위한 Broadphase 알고리즘 설정 (SAP)
    world.broadphase = new CANNON.SAPBroadphase(world);

    // 움직이지 않는 객체는 물리 계산에서 제외하여 성능 향상
    world.allowSleep = true;

    // TODO: 센서와 다른 객체 간의 상호작용은 개별 Body에서 .collisionResponse = 0 으로 설정하여
    // 물리적 충돌 없이 접촉 이벤트만 발생하도록 만들어야 합니다. (Trigger Body)

    return world;
}

/**
 * 고정 시간 간격으로 물리 시뮬레이션을 실행하는 스텝 함수를 생성합니다.
 * 프레임 드랍 발생 시에도 안정적인 물리 계산을 보장합니다.
 * @param {CANNON.World} world 
 * @returns {(time: number) => void} 스텝 함수
 */
export function createPhysicsStepper(world) {
    const fixedTimeStep = 1 / 60; // 60 FPS
    const maxSubSteps = 3; // 프레임이 심하게 느려질 경우 최대 3번까지만 계산
    let lastTime;

    // requestAnimationFrame의 타임스탬프를 받아 사용
    return function step(time) {
        if (lastTime === undefined) {
            lastTime = time;
            return;
        }

        const dt = (time - lastTime) / 1000;
        lastTime = time;

        // world.step(fixedTimeStep, timeSinceLastCall, maxSubSteps)
        world.step(fixedTimeStep, dt, maxSubSteps);
    }
}