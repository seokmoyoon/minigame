const fs = require('fs');

function getPngSize(filePath) {
    const buf = fs.readFileSync(filePath);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return { width, height };
}

const p = 'd:/03.기타/minigame/public/assets/knight_sheet.png';
try {
    const size = getPngSize(p);
    console.log(`${p}: ${size.width}x${size.height}`);
} catch (e) {
    console.log(`${p} error: ${e.message}`);
}
