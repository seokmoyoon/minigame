import Phaser from 'phaser';

class MainGame extends Phaser.Scene {
  constructor() {
    super('MainGame');
    this.player = null;
    this.moveMarker = null;
    this.isMoving = false;
    this.keys = null;
    this.lastAttackTime = 0;
  }

  preload() {
    // Knight sheet from public/assets/knight_sheet.png (640x640)
    this.load.spritesheet('knight_sheet', '/assets/knight_sheet.png', { frameWidth: 128, frameHeight: 128 });
    this.load.image('slime', '/assets/slime.png');
  }

  create() {
    // 1. Roguelike Dungeon Constants
    this.tileSize = 100;
    this.mapWidth = 25;
    this.mapHeight = 25;

    // 2. Physics & Groups
    this.monsters = this.add.group();

    // 3. Player Creation (Container)
    this.player = this.add.container(0, 0);
    const shadow = this.add.ellipse(0, 30, 60, 20, 0x000000, 0.3);
    this.playerSprite = this.add.sprite(0, 0, 'knight_sheet', 20);
    this.playerSprite.setScale(1.5);
    this.playerSprite.setOrigin(0.5, 0.85);
    this.player.add([shadow, this.playerSprite]);

    // 4. Generate & Render Dungeon
    this.generateDungeon();
    this.createIsometricGrid();
    this.createAnimations();

    // Stats
    this.hp = 100;
    this.maxHp = 100;
    this.exp = 0;
    this.level = 1;
    this.attackRating = 10;
    this.defenseRating = 5;
    this.speed = 220;

    // Click Marker
    this.moveMarker = this.add.graphics();
    this.moveMarker.lineStyle(2, 0x00ff00, 0.8);
    this.moveMarker.strokeCircle(0, 0, 15);
    this.moveMarker.setVisible(false);

    // Monsters
    this.spawnMonster(6);

    // Camera
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.1);

    // Input
    this.input.on('pointerdown', (pointer) => {
      const worldPoint = pointer.positionToCamera(this.cameras.main);
      let targetMonster = null;
      this.monsters.getChildren().forEach(m => {
        const dist = Phaser.Math.Distance.Between(m.x, m.y, worldPoint.x, worldPoint.y);
        if (dist < 50) targetMonster = m;
      });
      if (targetMonster) this.attackMonster(targetMonster);
      else this.moveTo(worldPoint.x, worldPoint.y);
    });

    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.updateUI();
  }

  generateDungeon() {
    this.mapData = Array(this.mapHeight).fill().map(() => Array(this.mapWidth).fill(1));
    const rooms = [];
    const maxRooms = 10;
    for (let i = 0; i < maxRooms; i++) {
      const w = Phaser.Math.Between(4, 8);
      const h = Phaser.Math.Between(4, 8);
      const x = Phaser.Math.Between(1, this.mapWidth - w - 1);
      const y = Phaser.Math.Between(1, this.mapHeight - h - 1);
      let intersects = rooms.some(r => x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y);
      if (!intersects) {
        for (let ry = y; ry < y + h; ry++) for (let rx = x; rx < x + w; rx++) this.mapData[ry][rx] = 0;
        if (rooms.length > 0) {
          const prev = rooms[rooms.length - 1];
          this.hTunnel(prev.centerX, Math.floor(x + w / 2), prev.centerY);
          this.vTunnel(prev.centerY, Math.floor(y + h / 2), Math.floor(x + w / 2));
        }
        rooms.push({ x, y, w, h, centerX: Math.floor(x + w / 2), centerY: Math.floor(y + h / 2) });
      }
    }
    if (rooms.length > 0) {
      const start = rooms[0];
      const pos = this.gridToWorld(start.centerX, start.centerY);
      this.player.setPosition(pos.x, pos.y);
    }
  }

  hTunnel(x1, x2, y) { for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) this.mapData[y][x] = 0; }
  vTunnel(y1, y2, x) { for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) this.mapData[y][x] = 0; }

  gridToWorld(gx, gy) {
    const offsetX = window.innerWidth / 2;
    const offsetY = 100;
    return { x: (gx - gy) * (this.tileSize / 2) + offsetX, y: (gx + gy) * (this.tileSize / 4) + offsetY };
  }

  worldToGrid(wx, wy) {
    const offsetX = window.innerWidth / 2;
    const offsetY = 100;
    const dx = wx - offsetX; const dy = wy - offsetY;
    const gx = Math.round((dx / (this.tileSize / 2) + dy / (this.tileSize / 4)) / 2);
    const gy = Math.round((dy / (this.tileSize / 4) - dx / (this.tileSize / 2)) / 2);
    return { gx, gy };
  }

  createIsometricGrid() {
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const isWall = this.mapData[y][x] === 1;
        const pos = this.gridToWorld(x, y);
        const tile = this.add.graphics();
        if (isWall) {
          // Dungeon Walls
          tile.fillStyle(0x222222, 1);
          tile.fillRect(pos.x - this.tileSize / 2, pos.y - 120, this.tileSize, 120);
          tile.fillStyle(0x333333, 1);
          tile.fillPoints([
            new Phaser.Geom.Point(pos.x, pos.y - 120 - this.tileSize / 4),
            new Phaser.Geom.Point(pos.x + this.tileSize / 2, pos.y - 120),
            new Phaser.Geom.Point(pos.x, pos.y - 120 + this.tileSize / 4),
            new Phaser.Geom.Point(pos.x - this.tileSize / 2, pos.y - 120)
          ], true);
          tile.setDepth(pos.y);
        } else {
          // Stone Floor
          tile.fillStyle((x + y) % 2 === 0 ? 0x181818 : 0x121212, 1);
          tile.lineStyle(1, 0x000000, 0.4);
          const pts = [
            new Phaser.Geom.Point(pos.x, pos.y - this.tileSize / 4),
            new Phaser.Geom.Point(pos.x + this.tileSize / 2, pos.y),
            new Phaser.Geom.Point(pos.x, pos.y + this.tileSize / 4),
            new Phaser.Geom.Point(pos.x - this.tileSize / 2, pos.y)
          ];
          tile.fillPoints(pts, true);
          tile.strokePoints(pts, true);
          tile.setDepth(-1000);
        }
      }
    }
  }

  createAnimations() {
    this.anims.create({ key: 'idle', frames: [{ key: 'knight_sheet', frame: 20 }], frameRate: 1 });
    this.anims.create({ key: 'walk', frames: this.anims.generateFrameNumbers('knight_sheet', { start: 5, end: 9 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'attack', frames: this.anims.generateFrameNumbers('knight_sheet', { start: 10, end: 14 }), frameRate: 15, repeat: 0 });
  }

  spawnMonster(count = 1) {
    for (let i = 0; i < count; i++) {
      let gx, gy;
      do { gx = Phaser.Math.Between(1, this.mapWidth - 2); gy = Phaser.Math.Between(1, this.mapHeight - 2); } while (this.mapData[gy][gx] !== 0);
      const pos = this.gridToWorld(gx, gy);
      const monster = this.add.container(pos.x, pos.y);
      monster.add([this.add.ellipse(0, 15, 40, 12, 0x000000, 0.2), this.add.sprite(0, 0, 'slime').setScale(1.5).setOrigin(0.5, 0.8)]);

      const hpBg = this.add.graphics().fillStyle(0x000000, 0.8).fillRect(-20, -45, 40, 6);
      const hpFill = this.add.graphics().fillStyle(0x00ff00, 1).fillRect(-20, -45, 40, 6);
      monster.add([hpBg, hpFill]);
      monster.hpBar = hpFill;
      monster.hp = 30; monster.maxHp = 30;
      this.monsters.add(monster);
      monster.lastAttackTime = 0;
      this.tweens.add({ targets: monster, y: pos.y + 15, duration: 1500 + Math.random() * 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  attackMonster(monster) {
    if (!monster || !monster.active) return;
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, monster.x, monster.y);
    if (dist > 100) { this.moveTo(monster.x, monster.y); return; }
    if (this.time.now - (this.lastAttackTime || 0) < 600) return;
    this.lastAttackTime = this.time.now;
    this.playerSprite.setFlipX(monster.x < this.player.x);
    this.playerSprite.play('attack');
    this.time.delayedCall(250, () => {
      if (!monster || !monster.active) return;
      const dmg = Math.max(1, Phaser.Math.Between(this.attackRating, this.attackRating + 5) - 2);
      this.showDamage(monster.x, monster.y - 40, dmg);
      monster.hp -= dmg;
      const pc = Math.max(0, monster.hp / monster.maxHp);
      monster.hpBar.clear().fillStyle(pc > 0.3 ? 0x00ff00 : 0xff0000, 1).fillRect(-20, -45, 40 * pc, 6);
      monster.list[1].setTint(0xff0000);
      this.time.delayedCall(100, () => { if (monster && monster.active) monster.list[1].clearTint(); });
      if (monster.hp <= 0) this.killMonster(monster);
    });
  }

  showDamage(x, y, amount) {
    const txt = this.add.text(x, y, `-${amount}`, { fontSize: '24px', fill: '#ff3d00', fontWeight: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
    this.tweens.add({ targets: txt, y: y - 60, alpha: 0, duration: 800, onComplete: () => txt.destroy() });
  }

  killMonster(monster) {
    this.exp += 25; if (this.exp >= 100) this.levelUp();
    monster.destroy(); this.updateUI();
    this.time.delayedCall(2000, () => this.spawnMonster(1));
  }

  levelUp() {
    this.level++; this.exp = 0; this.hp = 100;
    const txt = this.add.text(this.player.x, this.player.y - 120, 'LEVEL UP!', { fontSize: '40px', fill: '#ffd700', fontWeight: 'bold', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5);
    this.tweens.add({ targets: txt, y: txt.y - 80, alpha: 0, duration: 2000, onComplete: () => txt.destroy() });
    this.updateUI();
  }

  isWalkable(wx, wy) {
    const { gx, gy } = this.worldToGrid(wx, wy);
    return gy >= 0 && gy < this.mapHeight && gx >= 0 && gx < this.mapWidth && this.mapData[gy][gx] === 0;
  }

  moveTo(x, y) {
    if (!this.isWalkable(x, y)) return;
    this.moveMarker.setPosition(x, y).setVisible(true).setAlpha(1).scale = 0.5;
    this.tweens.add({ targets: this.moveMarker, alpha: 0, scale: 1.5, duration: 400, onComplete: () => this.moveMarker.setVisible(false) });
    this.playerSprite.setFlipX(x < this.player.x);
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
    this.tweens.killTweensOf(this.player);
    this.tweens.add({ targets: this.player, x, y, duration: (dist / 220) * 1000, ease: 'Linear', onStart: () => { this.isMoving = true; }, onComplete: () => { this.isMoving = false; } });
  }

  updateUI() {
    const hpBar = document.getElementById('hp-bar'), expBar = document.getElementById('exp-bar');
    if (hpBar) hpBar.style.width = (this.hp / this.maxHp * 100) + '%';
    if (expBar) expBar.style.width = (this.exp % 100) + '%';
    document.getElementById('hp-text').innerText = `${Math.floor(this.hp)} / ${this.maxHp}`;
    document.getElementById('exp-text').innerText = `${this.exp % 100} / 100`;
    document.querySelector('.name').innerText = `Knight (Level ${this.level})`;
  }

  update() {
    this.handleKeyboardMovement(); this.updateMonsters();
    if (!this.isMoving && this.playerSprite.anims.currentAnim?.key !== 'attack') {
      if (this.playerSprite.anims.currentAnim?.key !== 'idle') this.playerSprite.play('idle');
      this.playerSprite.y = Math.sin(this.time.now / 300) * 2;
    }
    this.player.setDepth(this.player.y); // Sorting
  }

  handleKeyboardMovement() {
    let vx = 0, vy = 0;
    if (this.keys.W.isDown) vy = -1; if (this.keys.S.isDown) vy = 1;
    if (this.keys.A.isDown) vx = -1; if (this.keys.D.isDown) vx = 1;
    if (vx !== 0 || vy !== 0) {
      const len = Math.sqrt(vx * vx + vy * vy); vx /= len; vy /= len;
      const nx = this.player.x + vx * (this.speed / 60), ny = this.player.y + vy * (this.speed / 60);
      if (this.isWalkable(nx, ny)) { this.player.x = nx; this.player.y = ny; }
      this.isMoving = true; this.playerSprite.setFlipX(vx < 0);
      if (this.playerSprite.anims.currentAnim?.key !== 'walk') this.playerSprite.play('walk');
      this.tweens.killTweensOf(this.player);
    } else if (this.isMoving && !this.tweens.isTweening(this.player)) {
      this.isMoving = false; this.playerSprite.play('idle');
    }
  }

  updateMonsters() {
    this.monsters.getChildren().forEach(monster => {
      if (!monster.active) return;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, monster.x, monster.y);
      if (dist < 300 && dist > 50) {
        const ang = Phaser.Math.Angle.Between(monster.x, monster.y, this.player.x, this.player.y);
        monster.x += Math.cos(ang) * (100 / 60); monster.y += Math.sin(ang) * (100 / 60);
      } else if (dist < 50) {
        if (this.time.now - (monster.lastAttackTime || 0) > 1000) { this.playerHit(5); monster.lastAttackTime = this.time.now; }
      }
      monster.setDepth(monster.y);
    });
  }

  playerHit(damage) {
    this.hp -= Math.max(1, damage - Math.floor(this.defenseRating / 2)); this.updateUI();
    this.cameras.main.shake(100, 0.005); this.playerSprite.setTint(0xff0000);
    this.time.delayedCall(100, () => { if (this.playerSprite) this.playerSprite.clearTint(); });
    if (this.hp <= 0) this.gameOver();
  }

  gameOver() { alert("Game Over! Restarting..."); this.scene.restart(); }
}

const config = {
  type: Phaser.AUTO, width: window.innerWidth, height: window.innerHeight, parent: 'game-container', backgroundColor: '#050505',
  scene: [MainGame], physics: { default: 'arcade', arcade: { gravity: { y: 0 } } },
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH }
};
const game = new Phaser.Game(config); window.game = game;
