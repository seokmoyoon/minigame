const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'public', 'assets');

// 3x3 grid, each cell 128x128
const COLS = 3, ROWS = 3, FW = 128, FH = 128;

const itemNames = [
    'item_hp', 'item_mp', 'item_gold',
    'item_sword', 'item_shield', 'item_ring',
    'item_meat', 'item_scroll', 'item_gem',
];

async function main() {
    const img = await loadImage(path.join(assetsDir, 'item_sheet.png'));
    console.log(`📐 Sheet: ${img.width}x${img.height}\n`);

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const idx = row * COLS + col;
            const name = itemNames[idx];
            const c = createCanvas(FW, FH);
            const ctx = c.getContext('2d');
            ctx.drawImage(img, col * FW, row * FH, FW, FH, 0, 0, FW, FH);
            fs.writeFileSync(path.join(assetsDir, `${name}.png`), c.toBuffer('image/png'));
            console.log(`✅ ${name}.png (${FW}x${FH})`);
        }
    }
    console.log('\n🎮 All 9 items extracted!');
}
main().catch(e => console.error('❌', e));
