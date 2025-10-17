
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { COLLISION_GROUPS } from '../physics/initPhysics.js';

export class Cabinet {
    constructor(scene, world, onPrizeCaptured) {
        this.scene = scene;
        this.world = world;
        this.onPrizeCaptured = onPrizeCaptured;

        // 내부 크기 (m)
        const innerWidth = 1.2;
        const innerDepth = 1.2;
        const innerHeight = 1.0;
        const wallThickness = 0.05; // 유리 두께

        // 재질
        const glassMaterial = new THREE.MeshStandardMaterial({
            color: 0xeeeeff, transparent: true, opacity: 0.2, roughness: 0.1
        });
        const rugMaterial = new THREE.MeshStandardMaterial({ color: 0x5a3d30, roughness: 0.8 });
        const chuteMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5 });

        // 물리 재질 (높은 마찰)
        const highFrictionMaterial = new CANNON.Material('rug');
        const defaultMaterial = world.defaultMaterial;
        const rugContactMaterial = new CANNON.ContactMaterial(defaultMaterial, highFrictionMaterial, {
            friction: 0.9, restitution: 0.1
        });
        world.addContactMaterial(rugContactMaterial);

        this.mesh = new THREE.Group();
        this.bodies = [];
        this.mesh.position.y = innerHeight / 2 + wallThickness; // 캐비닛 바닥이 y=0 근처에 오도록 조정

        // 1. 바닥 (러그)
        const floorBody = new CANNON.Body({
            mass: 0, // Static
            shape: new CANNON.Box(new CANNON.Vec3(innerWidth / 2, wallThickness / 2, innerDepth / 2)),
            material: highFrictionMaterial,
        });
        floorBody.position.y = -innerHeight / 2 - wallThickness / 2;
        const floorMesh = this.createMeshFromShape(floorBody.shapes[0], rugMaterial);
        this.add(floorMesh, floorBody);

        // 2. 벽 (유리)
        const wallShapes = [
            { shape: new CANNON.Box(new CANNON.Vec3(innerWidth / 2, innerHeight / 2, wallThickness / 2)), pos: [0, 0, -innerDepth / 2] }, // Back
            { shape: new CANNON.Box(new CANNON.Vec3(innerWidth / 2, innerHeight / 2, wallThickness / 2)), pos: [0, 0, innerDepth / 2] },  // Front
            { shape: new CANNON.Box(new CANNON.Vec3(wallThickness / 2, innerHeight / 2, innerDepth / 2)), pos: [-innerWidth / 2, 0, 0] }, // Left
            { shape: new CANNON.Box(new CANNON.Vec3(wallThickness / 2, innerHeight / 2, innerDepth / 2)), pos: [innerWidth / 2, 0, 0] },  // Right
        ];

        wallShapes.forEach(data => {
            const wallBody = new CANNON.Body({ mass: 0, shape: data.shape });
            wallBody.position.set(...data.pos);
            const wallMesh = this.createMeshFromShape(data.shape, glassMaterial);
            this.add(wallMesh, wallBody);
        });

        // 3. 출구 (경사)
        const chuteWidth = 0.4;
        const chuteHeight = 0.3;
        const chutePos = new THREE.Vector3(-innerWidth / 2 + chuteWidth, -innerHeight / 2 + chuteHeight, innerDepth / 2);

        const rampBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(chuteWidth / 2, wallThickness / 2, 0.3)),
        });
        rampBody.position.set(chutePos.x, chutePos.y, chutePos.z - 0.3);
        rampBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -0.5);
        const rampMesh = this.createMeshFromShape(rampBody.shapes[0], chuteMaterial);
        this.add(rampMesh, rampBody);

        // 4. 출구 센서
        const sensorSize = new CANNON.Vec3(chuteWidth / 2, 0.1, 0.1);
        const sensorPos = new CANNON.Vec3(chutePos.x, chutePos.y - 0.2, chutePos.z + 0.1);
        const sensorBody = new CANNON.Body({
            isTrigger: true,
            mass: 0,
            shape: new CANNON.Box(sensorSize),
            position: sensorPos,
            collisionFilterGroup: COLLISION_GROUPS.SENSOR,
            collisionFilterMask: COLLISION_GROUPS.PRIZE
        });

        sensorBody.addEventListener('beginContact', (event) => {
            if (this.onPrizeCaptured) {
                this.onPrizeCaptured(event.body);
            }
        });
        this.bodies.push(sensorBody);
        world.addBody(sensorBody);
        
        // 센서 위치 확인용 헬퍼(주석 처리)
        // const sensorMesh = new THREE.Mesh(new THREE.BoxGeometry(sensorSize.x*2, sensorSize.y*2, sensorSize.z*2), new THREE.MeshBasicMaterial({color: 0xff0000, wireframe: true}));
        // sensorMesh.position.copy(sensorPos);
        // this.mesh.add(sensorMesh);

        scene.add(this.mesh);
    }

    add(mesh, body) {
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.mesh.add(mesh);

        body.collisionFilterGroup = COLLISION_GROUPS.ENV;
        body.collisionFilterMask = COLLISION_GROUPS.CLAW | COLLISION_GROUPS.PRIZE;
        this.world.addBody(body);
        this.bodies.push(body);
    }
    
    createMeshFromShape(shape, material) {
        if (shape instanceof CANNON.Box) {
            const { x, y, z } = shape.halfExtents;
            return new THREE.Mesh(new THREE.BoxGeometry(x * 2, y * 2, z * 2), material);
        }
        return null;
    }
}
