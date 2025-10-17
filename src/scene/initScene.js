// Three.js의 Scene, Camera, Renderer, Light 등을 설정하고 초기화합니다.

import * as THREE from 'three';

/**
 * Three.js 씬을 초기화합니다.
 * @param {object} [sceneOpts] - 씬 옵션 (현재 사용되지 않음).
 * @returns {{scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer}}
 */
export function initScene(sceneOpts = {}) {
    // Scene 생성
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    // Camera 생성 - 기계 내부를 비추는 사선 시점
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(2, 2.5, 2);
    camera.lookAt(0, 0.5, 0); // 캐비닛 내부의 중심을 바라보도록 조정

    // Renderer 생성
    const renderer = new THREE.WebGLRenderer({
        canvas: document.querySelector('#bg'),
        antialias: true
    });
    renderer.setPixelRatio(window.devicePixelRatio); // DPR 반영
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // 그림자 활성화
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 부드러운 그림자

    // Light 생성
    // 1. HemisphereLight: 하늘과 땅의 색을 지정하여 자연스러운 전역 조명 효과
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    scene.add(hemisphereLight);

    // 2. DirectionalLight: 그림자를 생성하는 주 광원
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 15, 5);
    directionalLight.castShadow = true; // 그림자 생성 활성화
    scene.add(directionalLight);

    // DirectionalLight 그림자 품질 및 범위 설정
    directionalLight.shadow.mapSize.width = 2048; // 성능과 품질 사이의 절충
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;

    // 창 크기 변경 시 대응
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { scene, camera, renderer };
}