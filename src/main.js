// TODO: 모든 모듈을 가져와 게임의 주요 로직을 초기화하고 실행합니다.

import { initScene } from './scene/initScene.js';
import { initPhysics, createPhysicsStepper } from './physics/initPhysics.js';
import { Cabinet } from './entities/Cabinet.js';
import { Floor } from './entities/Floor.js';

// 씬과 물리 월드 초기화
const { scene, camera, renderer } = initScene();
const physicsWorld = initPhysics();
const physicsStepper = createPhysicsStepper(physicsWorld);

// 엔티티 관리
const entities = [];

// 바닥 생성
const floor = new Floor(scene, physicsWorld);
// floor는 update가 없으므로 entities에 추가하지 않음

// 캐비닛 생성 및 콜백 정의
const onPrizeCaptured = (prizeBody) => {
    console.log("Prize captured!", prizeBody);
    // TODO: 점수 올리기, 사운드 재생 등

    // 물리 월드에서 인형 바디 제거
    physicsWorld.removeBody(prizeBody);

    // 씬에서 인형 메쉬 제거
    const capturedEntity = entities.find(e => e.body === prizeBody);
    if (capturedEntity) {
        scene.remove(capturedEntity.mesh);
        // entities 배열에서도 제거
        entities.splice(entities.indexOf(capturedEntity), 1);
    }
};
const cabinet = new Cabinet(scene, physicsWorld, onPrizeCaptured);


// TODO: 게임 엔티티(크레인, 인형 등) 생성

// TODO: 게임 시스템(입력, 상태 관리 등) 초기화

// 게임 루프 정의
function animate(time) {
    requestAnimationFrame(animate);

    // 물리 시뮬레이션 업데이트
    physicsStepper(time);

    // 3D 객체와 물리 객체 위치 동기화
    for (const entity of entities) {
        if (entity.update) {
            entity.update();
        }
    }

    // 렌더링
    renderer.render(scene, camera);
}

// 게임 시작
animate();