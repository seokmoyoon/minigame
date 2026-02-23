const fs = require('fs');

function getDimensions(path) {
    const buffer = fs.readFileSync(path);
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        // JPEG
        let i = 2;
        while (i < buffer.length) {
            const marker = buffer.readUInt16BE(i);
            const size = buffer.readUInt16BE(i + 2);
            if (marker >= 0xFFC0 && marker <= 0xFFC3) {
                return {
                    height: buffer.readUInt16BE(i + 5),
                    width: buffer.readUInt16BE(i + 7)
                };
            }
            i += 2 + size;
        }
    } else if (buffer[0] === 0x89 && buffer[1] === 0x50) {
        // PNG
        return {
            width: buffer.readUInt32BE(16),
            height: buffer.readUInt32BE(20)
        };
    }
    return null;
}

const p = 'd:/03.기타/minigame/public/assets/knight_sheet.png';
const dim = getDimensions(p);
console.log(dim);
