// TODO: 지정된 위치에 인형(Prize)을 생성(스폰)합니다.

import { Prize } from '../entities/Prize.js';

export class Spawner {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
    }

    spawnPrizes(count) {
        const prizes = [];
        // TODO: 지정된 개수만큼 Prize 인스턴스 생성
        for (let i = 0; i < count; i++) {
            // const position = ...;
            // prizes.push(new Prize(this.scene, this.world, position));
        }
        return prizes;
    }
}