// TODO: 게임 월드의 바닥을 정의합니다.

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Floor {
    constructor(scene, world) {
        // TODO: 3D 모델(Mesh) 생성
        this.mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100),
            new THREE.MeshStandardMaterial({ color: 0xcccccc })
        );
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.receiveShadow = true;
        scene.add(this.mesh);

        // TODO: 물리 엔진 바디(Body) 생성 (StaticPlane)
        this.body = new CANNON.Body({
            mass: 0, // static
            shape: new CANNON.Plane(),
        });
        this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        world.addBody(this.body);
    }
}