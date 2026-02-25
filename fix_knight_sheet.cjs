const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'assets', 'knight_sheet.png');

async function fixImage() {
    try {
        const img = await loadImage(filePath);
        const targetWidth = 640;
        const targetHeight = 512; // 128 * 4 rows

        const canvas = createCanvas(targetWidth, targetHeight);
        const ctx = canvas.getContext('2d');

        // Draw original image (it might be 640x510)
        ctx.drawImage(img, 0, 0);

        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(filePath, buffer);
        console.log(`✅ knight_sheet.png fixed! New size: ${targetWidth}x${targetHeight}`);
    } catch (err) {
        console.error('❌ Error fixing image:', err);
    }
}

fixImage();
