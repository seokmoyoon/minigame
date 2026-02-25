/**
 * generate_assets.cjs
 * 던전 게임용 텍스처 이미지를 캔버스로 생성한 뒤 public/assets/에 저장합니다.
 * 실행: node generate_assets.cjs
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'public', 'assets');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
// 1) 바닥 타일 (floor_tile.png)  256×256
// ─────────────────────────────────────────────────────────────────────────────
function makeFloorTile() {
    const size = 256;
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');

    // 기본 돌 베이스
    ctx.fillStyle = '#1a1a1c';
    ctx.fillRect(0, 0, size, size);

    // 돌 결 — 단색(회색 계열) 노이즈 레이어
    for (let i = 0; i < 1400; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = Math.random() * 2.5 + 0.3;
        const alpha = Math.random() * 0.09 + 0.01;
        const shade = Math.floor(Math.random() * 55 + 15); // 15~70 grey
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${shade},${shade},${shade + 3},${alpha})`;
        ctx.fill();
    }

    // 타일 줄눈 (grout lines)
    const grout = 64;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2.5;
    for (let g = grout; g < size; g += grout) {
        ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(size, g); ctx.stroke();
    }

    // 크랙 (금)
    for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        const sx = Math.random() * size, sy = Math.random() * size;
        ctx.moveTo(sx, sy);
        for (let s = 0; s < 5; s++) {
            ctx.lineTo(sx + (Math.random() - 0.5) * 30, sy + (Math.random() - 0.5) * 30);
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
    }

    // 가장자리 어두운 미세 베벨
    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    fs.writeFileSync(path.join(outDir, 'floor_tile.png'), c.toBuffer('image/png'));
    console.log('✅  floor_tile.png 생성 완료');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) 벽 타일 (wall_tile.png)  256×256
// ─────────────────────────────────────────────────────────────────────────────
function makeWallTile() {
    const size = 256;
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');

    // 거친 돌 베이스 (바닥보다 좀 더 밝은 회색)
    ctx.fillStyle = '#4a4a4d';
    ctx.fillRect(0, 0, size, size);

    // 1. 거친 돌 질감 (노이즈)
    for (let i = 0; i < 2000; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = Math.random() * 3 + 1;
        const shade = Math.floor(Math.random() * 60 + 30); // 30~90 range
        ctx.fillStyle = `rgba(${shade},${shade},${shade + 5},${Math.random() * 0.15})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // 2. 유기적인 바위 덩어리 효과
    for (let i = 0; i < 8; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = Math.random() * 60 + 40;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, 'rgba(255,255,255,0.05)');
        grad.addColorStop(1, 'rgba(0,0,0,0.1)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // 3. 깊은 균열 (Cracks)
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 12; k++) {
        ctx.beginPath();
        let sx = Math.random() * size, sy = Math.random() * size;
        ctx.moveTo(sx, sy);
        for (let s = 0; s < 6; s++) {
            sx += (Math.random() - 0.5) * 40;
            sy += (Math.random() - 0.5) * 40;
            ctx.lineTo(sx, sy);
        }
        ctx.stroke();
    }

    // 4. 하이라이트 (날카로운 돌 모서리)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 10; k++) {
        ctx.beginPath();
        let sx = Math.random() * size, sy = Math.random() * size;
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 20, sy - 20);
        ctx.stroke();
    }

    fs.writeFileSync(path.join(outDir, 'wall_tile.png'), c.toBuffer('image/png'));
    console.log('✅  wall_tile.png (거친 돌 버전) 생성 완료');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3a) 던전 배경 (bg_dungeon.png)  1920×1080
// ─────────────────────────────────────────────────────────────────────────────
function makeDungeonBackground() {
    const w = 1920, h = 1080;
    const c = createCanvas(w, h);
    const ctx = c.getContext('2d');

    // 매우 어두운 밤 하늘 그라디언트
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#01010a');
    skyGrad.addColorStop(0.5, '#05050f');
    skyGrad.addColorStop(1, '#0a0a18');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // 별 (stars)
    for (let i = 0; i < 600; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h * 0.8, Math.random() * 1.5 + 0.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,220,255,${Math.random() * 0.6 + 0.2})`;
        ctx.fill();
    }

    // 달
    const moonX = w * 0.15, moonY = h * 0.15, moonR = 70;
    const moonGlow = ctx.createRadialGradient(moonX, moonY, moonR * 0.3, moonX, moonY, moonR * 3);
    moonGlow.addColorStop(0, 'rgba(200,210,255,0.15)');
    moonGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = moonGlow;
    ctx.fillRect(0, 0, w, h);
    ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fillStyle = '#d8e0ff'; ctx.fill();

    // 원거리 산 실루엣
    function drawMountain(baseY, hScale, color) {
        ctx.beginPath(); ctx.moveTo(0, h); let cx2 = 0;
        while (cx2 < w) { const pw = 80 + Math.random() * 120; const ph = hScale * (0.5 + Math.random() * 0.5); ctx.lineTo(cx2 + pw / 2, baseY - ph); ctx.lineTo(cx2 + pw, baseY); cx2 += pw; }
        ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    }
    drawMountain(h * 0.6, 180, '#0d0c14');
    drawMountain(h * 0.7, 130, '#0f0d18');
    drawMountain(h * 0.78, 90, '#11101c');

    fs.writeFileSync(path.join(outDir, 'bg_dungeon.png'), c.toBuffer('image/png'));
    console.log('✅  bg_dungeon.png 생성 완료');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3b) 마을/지상 배경 (bg_field.png)  1920×1080
// ─────────────────────────────────────────────────────────────────────────────
function makeFieldBackground() {
    const w = 1920, h = 1080;
    const c = createCanvas(w, h);
    const ctx = c.getContext('2d');

    // 밝은 하늘
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#6EB5FF');
    skyGrad.addColorStop(0.4, '#A3D5FF');
    skyGrad.addColorStop(0.65, '#E8F4E0');
    skyGrad.addColorStop(1, '#7BBF5C');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // 구름
    for (let i = 0; i < 12; i++) {
        const cx = Math.random() * w;
        const cy = Math.random() * h * 0.35 + 30;
        const rx = 60 + Math.random() * 100;
        const ry = 20 + Math.random() * 25;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.4 + Math.random() * 0.3})`;
        ctx.fill();
    }

    // 원거리 초록 언덕
    function drawHill(baseY, hScale, color) {
        ctx.beginPath(); ctx.moveTo(0, h); let cx2 = 0;
        while (cx2 < w) { const pw = 100 + Math.random() * 200; const ph = hScale * (0.3 + Math.random() * 0.7); ctx.quadraticCurveTo(cx2 + pw / 2, baseY - ph, cx2 + pw, baseY); cx2 += pw; }
        ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    }
    drawHill(h * 0.55, 120, '#4a8a30');
    drawHill(h * 0.65, 80, '#5a9a40');
    drawHill(h * 0.75, 50, '#6aaa50');

    // 나무 실루엣
    for (let i = 0; i < 20; i++) {
        const tx = Math.random() * w;
        const ty = h * 0.5 + Math.random() * h * 0.2;
        const ts = 15 + Math.random() * 30;
        ctx.fillStyle = '#3a7020';
        ctx.beginPath(); ctx.arc(tx, ty - ts, ts, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#553322';
        ctx.fillRect(tx - 3, ty - ts + 5, 6, ts);
    }

    // 잔디 질감
    for (let i = 0; i < 3000; i++) {
        ctx.fillStyle = `rgba(${40 + Math.random() * 30},${100 + Math.random() * 60},${20 + Math.random() * 20},${Math.random() * 0.1})`;
        ctx.fillRect(Math.random() * w, h * 0.6 + Math.random() * h * 0.4, 3, 2);
    }

    fs.writeFileSync(path.join(outDir, 'bg_field.png'), c.toBuffer('image/png'));
    console.log('✅  bg_field.png 생성 완료');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3c) 지상 바닥 타일 (floor_field.png)  256×256
// ─────────────────────────────────────────────────────────────────────────────
function makeFieldFloor() {
    const size = 256;
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');

    // 초록빛 흙/풀 기본 색
    ctx.fillStyle = '#4a7a2e';
    ctx.fillRect(0, 0, size, size);

    // 풀 텍스처
    for (let i = 0; i < 2000; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const shade = Math.floor(50 + Math.random() * 60);
        ctx.fillStyle = `rgba(${shade - 10},${shade + 30},${shade - 20},${Math.random() * 0.12})`;
        ctx.fillRect(x, y, 2 + Math.random() * 3, 1);
    }

    // 흙 패치
    for (let i = 0; i < 5; i++) {
        const px = Math.random() * size;
        const py = Math.random() * size;
        const pr = 15 + Math.random() * 20;
        ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(90,70,40,0.15)';
        ctx.fill();
    }

    // 비네트
    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    fs.writeFileSync(path.join(outDir, 'floor_field.png'), c.toBuffer('image/png'));
    console.log('✅  floor_field.png 생성 완료');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3d) 아이템 아이콘 (item_hp.png, item_mp.png, item_gold.png)  64×64
// ─────────────────────────────────────────────────────────────────────────────
function makeItemIcons() {
    // HP Potion (Red)
    let c = createCanvas(64, 64), ctx = c.getContext('2d');
    // Bottle
    ctx.fillStyle = '#cc1111';
    ctx.beginPath(); ctx.moveTo(22, 20); ctx.lineTo(20, 50); ctx.quadraticCurveTo(32, 58, 44, 50); ctx.lineTo(42, 20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#882222';
    ctx.fillRect(26, 10, 12, 12);
    ctx.fillStyle = '#aa8833';
    ctx.fillRect(24, 18, 16, 4);
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(26, 24, 5, 18);
    fs.writeFileSync(path.join(outDir, 'item_hp.png'), c.toBuffer('image/png'));
    console.log('✅  item_hp.png 생성 완료');

    // MP Potion (Blue)
    c = createCanvas(64, 64); ctx = c.getContext('2d');
    ctx.fillStyle = '#2244cc';
    ctx.beginPath(); ctx.moveTo(22, 20); ctx.lineTo(20, 50); ctx.quadraticCurveTo(32, 58, 44, 50); ctx.lineTo(42, 20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#223388';
    ctx.fillRect(26, 10, 12, 12);
    ctx.fillStyle = '#aa8833';
    ctx.fillRect(24, 18, 16, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(26, 24, 5, 18);
    fs.writeFileSync(path.join(outDir, 'item_mp.png'), c.toBuffer('image/png'));
    console.log('✅  item_mp.png 생성 완료');

    // Gold Coin
    c = createCanvas(64, 64); ctx = c.getContext('2d');
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(32, 32, 22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#aa8800'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(32, 32, 22, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#aa8800'; ctx.font = 'bold 22px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('G', 32, 33);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.arc(28, 26, 12, 0, Math.PI * 2); ctx.fill();
    fs.writeFileSync(path.join(outDir, 'item_gold.png'), c.toBuffer('image/png'));
    console.log('✅  item_gold.png 생성 완료');
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) UI Bottom Bar (ui_bottom_bar.png)
// ─────────────────────────────────────────────────────────────────────────────
function makeUIBottomBar() {
    const w = 1200, h = 120;
    const c = createCanvas(w, h);
    const ctx = c.getContext('2d');

    // Dark metallic base
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1a1a1a');
    grad.addColorStop(0.5, '#0a0a0a');
    grad.addColorStop(1, '#000000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Ornament texture (brushed metal)
    for (let i = 0; i < 5000; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 1);
    }

    // Gold borders
    ctx.strokeStyle = '#c5a059';
    ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, w - 2, h - 2);

    // Internal decorative lines
    ctx.strokeStyle = '#8a6d3b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 10); ctx.lineTo(w, 10);
    ctx.moveTo(0, h - 10); ctx.lineTo(w, h - 10);
    ctx.stroke();

    fs.writeFileSync(path.join(outDir, 'ui_bottom_bar.png'), c.toBuffer('image/png'));
    console.log('✅  ui_bottom_bar.png 생성 완료');
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) UI Dragon Emblem (ui_dragon_emblem.png)
// ─────────────────────────────────────────────────────────────────────────────
function makeUIDragonEmblem() {
    const size = 128;
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');

    // Glow
    const glow = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    glow.addColorStop(0, 'rgba(197, 160, 89, 0.4)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    // Golden frame
    ctx.fillStyle = '#c5a059';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 45, 0, Math.PI * 2);
    ctx.fill();

    // Darker center
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 40, 0, Math.PI * 2);
    ctx.fill();

    // Shield/Dragon sketch (symbolic)
    ctx.strokeStyle = '#c5a059';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(size / 2, size / 2 - 25);
    ctx.lineTo(size / 2 + 20, size / 2);
    ctx.lineTo(size / 2, size / 2 + 30);
    ctx.lineTo(size / 2 - 20, size / 2);
    ctx.closePath();
    ctx.stroke();

    fs.writeFileSync(path.join(outDir, 'ui_dragon_emblem.png'), c.toBuffer('image/png'));
    console.log('✅  ui_dragon_emblem.png 생성 완료');
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) UI Slot (ui_slot_bg.png)
// ─────────────────────────────────────────────────────────────────────────────
function makeUISlot() {
    const size = 64;
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');

    // Dark recessed area
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, size, size);

    // Bevel
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, size - 4, size - 4);

    ctx.strokeStyle = '#c5a059';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, size, size);

    fs.writeFileSync(path.join(outDir, 'ui_slot_bg.png'), c.toBuffer('image/png'));
    console.log('✅  ui_slot_bg.png 생성 완료');
}

// ─────────────────────────────────────────────────────────────────────────────
// 7) UI Window Panel (ui_window_panel.png)
// ─────────────────────────────────────────────────────────────────────────────
function makeUIWindowPanel() {
    const size = 256;
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');

    // Stone pattern
    ctx.fillStyle = '#121215';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 1000; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.02})`;
        ctx.fillRect(Math.random() * size, Math.random() * size, 3, 3);
    }

    // Gold ornate border
    ctx.strokeStyle = '#c5a059';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, size - 6, size - 6);

    ctx.strokeStyle = '#8a6d3b';
    ctx.lineWidth = 1;
    ctx.strokeRect(8, 8, size - 16, size - 16);

    fs.writeFileSync(path.join(outDir, 'ui_window_panel.png'), c.toBuffer('image/png'));
    console.log('✅  ui_window_panel.png 생성 완료');
}

// ─────────────────────────────────────────────────────────────────────────────
// 실행
// ─────────────────────────────────────────────────────────────────────────────
try {
    makeFloorTile();
    makeFieldFloor();
    makeWallTile();
    makeDungeonBackground();
    makeFieldBackground();
    makeItemIcons();
    makeUIBottomBar();
    makeUIDragonEmblem();
    makeUISlot();
    makeUIWindowPanel();
    console.log('\n🎮  모든 에셋(맵+아이템+UI) 생성 완료!');
} catch (e) {
    console.error('❌ 오류:', e.message);
    console.log('\n💡 canvas 모듈 설치 필요: npm install canvas');
}
