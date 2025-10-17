// TODO: HUD(점수, 시간)와 모달 창 등 UI 요소를 업데이트합니다.

export class UIManager {
    constructor() {
        // TODO: UI DOM 요소 가져오기
        this.coinsEl = document.getElementById('coins');
        this.timerEl = document.getElementById('timer');
        this.scoreEl = document.getElementById('score');
        this.modalEl = document.getElementById('modal');
    }

    updateHUD(data) {
        // TODO: 코인, 시간, 점수 업데이트
    }

    showModal(type) {
        // TODO: 모달 창 표시/숨기기
    }
}