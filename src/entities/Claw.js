// TODO: 크레인(집게)의 3D 모델과 물리적 동작을 정의합니다.

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Claw {
    constructor(scene, world) {
        // TODO: 3D 모델(Mesh) 생성
        this.mesh = new THREE.Group();
        // ... (집게 파츠들 추가)
        scene.add(this.mesh);

        // TODO: 물리 엔진 바디(Body) 생성
        this.body = new CANNON.Body({ mass: 1 });
        // ...
        world.addBody(this.body);

        // TODO: 집게를 열고 닫는 메서드
    }

    update() {
        // TODO: Mesh와 Body 위치/회전 동기화
    }
}