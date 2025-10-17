// TODO: cannon-es의 World를 설정하고 중력 등 물리 환경을 정의합니다.

import * as CANNON from 'cannon-es';

export function initPhysics() {
    // TODO: 물리 월드 생성
    const world = new CANNON.World();
    
    // TODO: 중력 설정
    world.gravity.set(0, -9.82, 0);

    // TODO: 바닥 충돌 감지를 위한 기본 Material 설정
    world.defaultContactMaterial.contactEquationStiffness = 1e9;
    world.defaultContactMaterial.contactEquationRelaxation = 4;

    return world;
}