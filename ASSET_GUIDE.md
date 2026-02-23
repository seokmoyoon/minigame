# Phaser 3 이미지/스프라이트 적용 가이드

이 문서는 게임에 새로운 이미지나 스프라이트 시트를 다시 적용하는 방법을 설명합니다.

## 1. 이미지 파일 준비
이미지 파일들을 `public/assets/` 폴더에 넣습니다. (또는 `public/` 루트 폴더)
- 예: `public/assets/knight_sheet.png`, `public/assets/slime.png`, `public/Tiles.png`

## 2. 코드 수정 (`src/main.js`)

### A. 이미지 불러오기 (Preload)
`preload()` 함수 내에 사용할 이미지를 등록합니다.

```javascript
preload() {
  // 스프라이트 시트 (애니메이션용)
  this.load.spritesheet('knight_sheet', '/assets/knight_sheet.png', { 
    frameWidth: 92,   // 한 프레임의 가로 크기
    frameHeight: 92   // 한 프레임의 세로 크기
  });

  // 단일 이미지
  this.load.image('slime', '/assets/slime.png');
  
  // 타일셋
  this.load.spritesheet('tiles', '/Tiles.png', { 
    frameWidth: 32, 
    frameHeight: 32 
  });
}
```

### B. 캐릭터 생성 (Create)
도형(Rectangle) 대신 스프라이트 객체를 생성합니다.

```javascript
// 기존 코드 (도형):
this.playerSprite = this.add.container(0, 0); // 등등..

// 이미지로 변경:
this.playerSprite = this.add.sprite(0, 0, 'knight_sheet', 0);
this.playerSprite.setScale(2.0);
this.playerSprite.setOrigin(0.5, 0.85); 
```

### C. 애니메이션 설정
이미지를 불러온 후 `createAnimations()`에서 애니메이션을 정의합니다.

```javascript
createAnimations() {
  this.anims.create({
    key: 'walk',
    frames: this.anims.generateFrameNumbers('knight_sheet', { start: 0, end: 3 }),
    frameRate: 8,
    repeat: -1
  });
}
```

### D. 타일맵 적용
`createIsometricGrid()`에서 `graphics` 대신 `image`를 배치합니다.

```javascript
const tileSprite = this.add.image(worldX + size/2, worldY + size/2, 'tiles', tileIndex);
tileSprite.setDisplaySize(size, size);
```

## 3. 주의사항
- **경로**: `/assets/`로 시작하는 경로는 `public/assets/` 폴더를 가리킵니다.
- **프레임 크기**: 스프라이트 시트의 `frameWidth`, `frameHeight`가 실제 이미지와 맞지 않으면 이미지가 깨져 보일 수 있습니다.
