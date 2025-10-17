// TODO: 모든 모듈을 가져와 게임의 주요 로직을 초기화하고 실행합니다.

import { initScene } from './scene/initScene.js';
import { initPhysics, createPhysicsStepper } from './physics/initPhysics.js';
// ... import other modules

// TODO: 씬과 물리 월드 초기화
const { scene, camera, renderer } = initScene();
const physicsWorld = initPhysics();
const physicsStepper = createPhysicsStepper(physicsWorld); // 스텝퍼 생성

// TODO: 게임 엔티티(크레인, 인형 등) 생성

// TODO: 게임 시스템(입력, 상태 관리 등) 초기화

// TODO: 게임 루프 정의
function animate(time) {
    requestAnimationFrame(animate);

    // 물리 시뮬레이션 업데이트
    physicsStepper(time);

    // TODO: 게임 로직 업데이트 (상태, 충돌 등)

    // TODO: 3D 객체와 물리 객체 위치 동기화

    // TODO: 렌더링
    renderer.render(scene, camera);
}

// TODO: 게임 시작
animate();