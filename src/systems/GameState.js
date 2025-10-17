// TODO: 게임의 상태(Ready, Playing, GameOver 등)를 관리하는 FSM(Finite State Machine)을 구현합니다.

export class GameStateManager {
    constructor() {
        // TODO: 초기 상태 설정
        this.currentState = 'Ready';
    }

    setState(newState) {
        // TODO: 상태 변경 로직
        this.currentState = newState;
        // TODO: 상태 변경에 따른 UI, 사운드 등 처리
    }
}