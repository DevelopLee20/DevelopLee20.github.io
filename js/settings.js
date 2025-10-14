// 다크 모드 및 설정 관리

// 폰트 크기 관련
const fontSizes = [12, 14, 16, 18, 20];
let currentFontSizeIndex = 2; // 기본값 16px

// 폰트 크기 순환 변경
export function cycleFontSize() {
    currentFontSizeIndex = (currentFontSizeIndex + 1) % fontSizes.length;
    applyFontSize();
    updateFontSizeButton();
}

// 폰트 크기 적용
function applyFontSize() {
    const fontSize = fontSizes[currentFontSizeIndex];
    document.documentElement.style.setProperty('--base-font-size', fontSize + 'px');
    localStorage.setItem('fontSizeIndex', currentFontSizeIndex);
}

// 폰트 크기 버튼 텍스트 업데이트
function updateFontSizeButton() {
    const btn = document.getElementById('font-size-btn');
    const fontSize = fontSizes[currentFontSizeIndex];

    // 버튼 텍스트를 크기에 맞게 변경
    if (fontSize === 12) {
        btn.textContent = 'A-';
    } else if (fontSize === 14) {
        btn.textContent = 'A';
    } else if (fontSize === 16) {
        btn.textContent = 'A';
    } else if (fontSize === 18) {
        btn.textContent = 'A+';
    } else if (fontSize === 20) {
        btn.textContent = 'A++';
    }
}

// 저장된 폰트 크기 불러오기
export function loadFontSize() {
    const savedIndex = localStorage.getItem('fontSizeIndex');
    if (savedIndex !== null) {
        currentFontSizeIndex = parseInt(savedIndex);
        applyFontSize();
        updateFontSizeButton();
    }
}

// 다크 모드 토글
export function toggleDarkMode() {
    const body = document.body;
    const toggle = document.getElementById('dark-mode-toggle');

    body.classList.toggle('dark-mode');
    toggle.classList.toggle('dark-mode');

    // 다크 모드 상태 저장
    if (body.classList.contains('dark-mode')) {
        toggle.textContent = '☀️';
        localStorage.setItem('darkMode', 'enabled');
    } else {
        toggle.textContent = '🌙';
        localStorage.setItem('darkMode', 'disabled');
    }
}

// 저장된 다크 모드 불러오기
export function loadDarkMode() {
    const darkMode = localStorage.getItem('darkMode');
    const body = document.body;
    const toggle = document.getElementById('dark-mode-toggle');

    if (darkMode === 'enabled') {
        body.classList.add('dark-mode');
        toggle.classList.add('dark-mode');
        toggle.textContent = '☀️';
    }
}
