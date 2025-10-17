// TODO: 인형뽑기 기계의 외형(유리 등)을 정의합니다.

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Cabinet {
    constructor(scene, world) {
        // TODO: 3D 모델(Mesh) 생성 (투명한 벽 등)
        this.mesh = new THREE.Group();
        // ...
        scene.add(this.mesh);

        // TODO: 물리 엔진 바디(Body) 생성 (Static, 벽 역할)
        // ...
    }
}