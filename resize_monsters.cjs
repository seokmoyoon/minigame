const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'public', 'assets');

// Target: 4 cols x 3 rows, 128 wide x 170 tall (preserves 3:4 aspect ratio)
const COLS = 4, ROWS = 3;
const FRAME_W = 128, FRAME_H = 170;
const SHEET_W = COLS * FRAME_W; // 512
const SHEET_H = ROWS * FRAME_H; // 510

const monsters = ['mob_slime', 'mob_skeleton', 'mob_orc', 'mob_darkknight', 'mob_dragon'];

async function resizeSheet(name) {
    // Try to use original backup first
    let srcPath = path.join(assetsDir, `${name}_original.png`);
    if (!fs.existsSync(srcPath)) {
        srcPath = path.join(assetsDir, `${name}.png`);
    }
    if (!fs.existsSync(srcPath)) {
        console.log(`⚠️  ${name}.png not found, skipping`);
        return;
    }

    const img = await loadImage(srcPath);
    const srcFrameW = img.width / COLS;
    const srcFrameH = img.height / ROWS;

    console.log(`📐 ${name}: ${img.width}x${img.height} (frame ${srcFrameW}x${srcFrameH}) → ${SHEET_W}x${SHEET_H} (frame ${FRAME_W}x${FRAME_H})`);

    const canvas = createCanvas(SHEET_W, SHEET_H);
    const ctx = canvas.getContext('2d');

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            ctx.drawImage(
                img,
                col * srcFrameW, row * srcFrameH, srcFrameW, srcFrameH,
                col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H
            );
        }
    }

    const outPath = path.join(assetsDir, `${name}.png`);
    fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
    console.log(`✅ ${name}.png → ${SHEET_W}x${SHEET_H}`);
}

async function main() {
    console.log(`🔧 Resize to ${FRAME_W}x${FRAME_H} per frame (aspect ratio preserved)\n`);
    for (const name of monsters) await resizeSheet(name);
    console.log('\n🎮 Done!');
}
main().catch(e => console.error('❌', e));
