// TODO: 뽑기 인형의 3D 모델과 물리적 속성을 정의합니다.

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Prize {
    constructor(scene, world, position) {
        // TODO: 3D 모델(Mesh) 생성 (예: Box, Sphere)
        this.mesh = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff })
        );
        this.mesh.position.copy(position);
        scene.add(this.mesh);

        // TODO: 물리 엔진 바디(Body) 생성
        this.body = new CANNON.Body({
            mass: 0.1,
            shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
            position: new CANNON.Vec3(position.x, position.y, position.z)
        });
        world.addBody(this.body);
    }

    update() {
        // TODO: Mesh와 Body 위치/회전 동기화
        this.mesh.position.copy(this.body.position);
        this.mesh.quaternion.copy(this.body.quaternion);
    }
}