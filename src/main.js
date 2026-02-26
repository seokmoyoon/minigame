import Phaser from 'phaser';

// ── Persistent state (survives scene.restart) ──────────────────────────────
const persist = {
  currentWorld: 'dungeon',
  hp: 133, maxHp: 133,
  mp: 191, maxMp: 191,
  exp: 0, level: 30,
  attackRating: 15, defenseRating: 10,
  inventory: [],   // [{type:'potion'|'gold', qty:N}]
  gold: 0,
  nickname: localStorage.getItem('player_nickname') || '',
};

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
    this.load.spritesheet('knight_sheet', '/assets/knight_sheet.png', { frameWidth: 128, frameHeight: 128 });

    // Monster spritesheets (4 cols x 3 rows, 128x170 per frame = 512x510)
    this.load.spritesheet('mob_slime', '/assets/mob_slime.png', { frameWidth: 128, frameHeight: 170 });
    this.load.spritesheet('mob_skeleton', '/assets/mob_skeleton.png', { frameWidth: 128, frameHeight: 170 });
    this.load.spritesheet('mob_orc', '/assets/mob_orc.png', { frameWidth: 128, frameHeight: 170 });
    this.load.spritesheet('mob_darkknight', '/assets/mob_darkknight.png', { frameWidth: 128, frameHeight: 170 });
    this.load.spritesheet('mob_dragon', '/assets/mob_dragon.png', { frameWidth: 128, frameHeight: 170 });

    // Map tiles
    this.load.image('floor_tile', '/assets/floor_tile.png');
    this.load.image('floor_field', '/assets/floor_field.png');
    this.load.image('wall_tile', '/assets/wall_tile.png');
    this.load.image('bg_dungeon', '/assets/bg_dungeon.jpg');
    this.load.image('bg_field', '/assets/bg_field.jpg');
    this.load.image('portal', '/assets/ui_dragon_emblem.png');

    // Item icons (9 types)
    this.load.image('item_hp', '/assets/item_hp.png');
    this.load.image('item_mp', '/assets/item_mp.png');
    this.load.image('item_gold', '/assets/item_gold.png');
    this.load.image('item_sword', '/assets/item_sword.png');
    this.load.image('item_shield', '/assets/item_shield.png');
    this.load.image('item_ring', '/assets/item_ring.png');
    this.load.image('item_meat', '/assets/item_meat.png');
    this.load.image('item_scroll', '/assets/item_scroll.png');
    this.load.image('item_gem', '/assets/item_gem.png');
  }

  create() {
    // Reset portal state (scene.restart() doesn't re-run constructor!)
    this.worldSwitching = false;

    // ── Background ───────────────────────────────────────────────────────
    const bgKey = persist.currentWorld === 'dungeon' ? 'bg_dungeon' : 'bg_field';
    this.bgImage = this.add.image(0, 0, bgKey)
      .setOrigin(0, 0).setScrollFactor(0)
      .setDisplaySize(this.scale.width, this.scale.height)
      .setDepth(-9999);

    // ── Day/Night overlay ────────────────────────────────────────────────
    this.dayNightOverlay = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height, 0x000000, 0
    ).setScrollFactor(0).setDepth(9998);

    // Map
    this.tileSize = 100;
    this.mapWidth = 75;
    this.mapHeight = 75;
    this.monsters = this.add.group();
    this.items = this.add.group();

    // Player
    this.player = this.add.container(0, 0);
    const shadow = this.add.ellipse(0, 10, 60, 20, 0x000000, 0.35);
    this.playerSprite = this.add.sprite(0, 0, 'knight_sheet', 0);
    this.playerSprite.setScale(1.5).setOrigin(0.5, 0.85);

    // Nickname label above player
    if (!persist.nickname) {
      persist.nickname = prompt('닉네임을 입력하세요:') || '용사';
      localStorage.setItem('player_nickname', persist.nickname);
    }
    this.playerNameTag = this.add.text(0, -175, persist.nickname, {
      fontSize: '13px',
      fontFamily: 'Arial, sans-serif',
      fill: '#00ffcc',
      stroke: '#000',
      strokeThickness: 3,
      shadow: { offsetX: 0, offsetY: 0, color: '#00ffcc', blur: 6, fill: true }
    }).setOrigin(0.5);

    this.player.add([shadow, this.playerSprite, this.playerNameTag]);

    // Stats from persist
    this.hp = persist.hp; this.maxHp = persist.maxHp;
    this.mp = persist.mp; this.maxMp = persist.maxMp;
    this.exp = persist.exp; this.level = persist.level;
    this.attackRating = persist.attackRating;
    this.defenseRating = persist.defenseRating;
    this.speed = 220;

    // Generate world
    this.generateMap();
    this.createIsometricGrid();
    this.createAnimations();

    // Click marker
    this.moveMarker = this.add.graphics();
    this.moveMarker.lineStyle(2, 0x00ff88, 0.9);
    this.moveMarker.strokeCircle(0, 0, 15);
    this.moveMarker.setVisible(false);

    // Monsters
    this.spawnMonsters();

    // Camera
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.1);

    // Input
    this.input.on('pointerdown', (pointer) => {
      const wp = pointer.positionToCamera(this.cameras.main);
      let targetMonster = null;
      this.monsters.getChildren().forEach(m => {
        if (Phaser.Math.Distance.Between(m.x, m.y, wp.x, wp.y) < 50) targetMonster = m;
      });
      if (targetMonster) this.attackMonster(targetMonster);
      else this.moveTo(wp.x, wp.y);
    });

    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.magicKeys = this.input.keyboard.addKeys({
      F1: Phaser.Input.Keyboard.KeyCodes.F1,
      F2: Phaser.Input.Keyboard.KeyCodes.F2,
      F3: Phaser.Input.Keyboard.KeyCodes.F3,
      ONE: Phaser.Input.Keyboard.KeyCodes.ONE,
      TWO: Phaser.Input.Keyboard.KeyCodes.TWO,
      THREE: Phaser.Input.Keyboard.KeyCodes.THREE
    });

    // Prevent default F key behavior
    if (this.input.keyboard) {
      this.input.keyboard.addCapture([
        Phaser.Input.Keyboard.KeyCodes.F1,
        Phaser.Input.Keyboard.KeyCodes.F2,
        Phaser.Input.Keyboard.KeyCodes.F3
      ]);
    }

    this.updateUI();
    this.initMagicUI();
    this.updateDayNight();

    // Update day/night every 30s
    this.time.addEvent({ delay: 30000, callback: () => this.updateDayNight(), loop: true });
  }

  initMagicUI() {
    const slots = document.querySelectorAll('.slot');
    const magics = [
      { key: 'F1', icon: '✨', name: '힐', color: '#55ff55' },
      { key: 'F2', icon: '⚡', name: '볼트', color: '#55aaff' },
      { key: 'F3', icon: '🏃', name: '헤이스트', color: '#ffff55' }
    ];

    magics.forEach((m, i) => {
      if (slots[i]) {
        slots[i].innerHTML = `
          <div class="spell-container">
            <div class="spell-icon" style="color:${m.color}">${m.icon}</div>
            <div class="spell-name">${m.name}</div>
          </div>
        `;
        slots[i].style.cursor = 'pointer';
        slots[i].onclick = (e) => {
          e.preventDefault();
          this.castMagic(i + 1);
        };
      }
    });
  }

  castMagic(num) {
    if (num === 1) this.magicHeal();
    if (num === 2) this.magicEnergyBolt();
    if (num === 3) this.magicHaste();
  }

  // ── MAGIC SKILLS ──────────────────────────────────────────────────────
  magicHeal() {
    const cost = 20;
    if (this.mp < cost) { this.showFloatingText(this.player.x, this.player.y - 50, 'MP 부족!', '#ff0000'); return; }
    this.mp -= cost;
    this.hp = Math.min(this.maxHp, this.hp + 50);
    this.showFloatingText(this.player.x, this.player.y - 50, 'Heal!!', '#55ff55');
    this.updateUI();

    // Visual Effect
    const effect = this.add.graphics().setDepth(this.player.depth + 1);
    effect.fillStyle(0x55ff55, 0.4).fillCircle(this.player.x, this.player.y, 60);
    this.tweens.add({
      targets: effect, alpha: 0, scale: 1.5, duration: 600,
      onComplete: () => effect.destroy()
    });
  }

  magicEnergyBolt() {
    const cost = 10;
    if (this.mp < cost) { this.showFloatingText(this.player.x, this.player.y - 50, 'MP 부족!', '#ff0000'); return; }

    // Find nearest monster
    let nearest = null;
    let minDist = 400;
    this.monsters.getChildren().forEach(m => {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, m.x, m.y);
      if (d < minDist) { minDist = d; nearest = m; }
    });

    if (!nearest) {
      this.showFloatingText(this.player.x, this.player.y - 50, '대상이 없습니다', '#aaaaaa');
      return;
    }

    this.mp -= cost;
    this.updateUI();

    // Create Projectile
    const bolt = this.add.circle(this.player.x, this.player.y - 40, 8, 0x55ccff).setDepth(2000);

    this.tweens.add({
      targets: bolt,
      x: nearest.x, y: nearest.y - 40,
      duration: 300,
      onComplete: () => {
        bolt.destroy();
        if (nearest && nearest.active) {
          const dmg = Phaser.Math.Between(20, 35);
          this.showDamage(nearest.x, nearest.y - 40, dmg);
          nearest.hp -= dmg;

          // Hit effect
          this.cameras.main.shake(150, 0.01);
          const blast = this.add.circle(nearest.x, nearest.y - 40, 10, 0x00ffff, 0.8);
          this.tweens.add({ targets: blast, scale: 3, alpha: 0, duration: 200, onComplete: () => blast.destroy() });

          if (nearest.hp <= 0) this.killMonster(nearest);
        }
      }
    });
  }

  magicHaste() {
    const cost = 30;
    if (this.mp < cost) { this.showFloatingText(this.player.x, this.player.y - 50, 'MP 부족!', '#ff0000'); return; }
    if (this.isHasted) return;

    this.mp -= cost;
    this.isHasted = true;
    const originalSpeed = this.speed || 220;
    this.speed = 350;
    this.updateUI();

    this.showFloatingText(this.player.x, this.player.y - 80, 'HASTE!!', '#ffff55');

    // Aura effect during haste
    const hasteAura = this.add.graphics();
    hasteAura.lineStyle(2, 0xffff55, 0.4).strokeCircle(0, 0, 40);
    this.player.add(hasteAura);
    this.tweens.add({ targets: hasteAura, alpha: 0.1, duration: 500, yoyo: true, repeat: -1 });

    this.time.delayedCall(15000, () => {
      this.isHasted = false;
      this.speed = originalSpeed;
      hasteAura.destroy();
      this.showFloatingText(this.player.x, this.player.y - 80, 'Haste End', '#aaaaaa');
    });
  }

  // ── 1. DAY/NIGHT ──────────────────────────────────────────────────────
  updateDayNight() {
    if (persist.currentWorld === 'dungeon') {
      // Dungeon = always dark
      this.dayNightOverlay.setFillStyle(0x000022, 0.4);
      this.bgImage.setTint(0x556688);
      return;
    }
    const hour = new Date().getHours();
    let alpha = 0, tint = 0xffffff;
    if (hour >= 6 && hour < 8) {        // 새벽
      alpha = 0.15; tint = 0xffeedd;
    } else if (hour >= 8 && hour < 17) { // 낮
      alpha = 0; tint = 0xffffff;
    } else if (hour >= 17 && hour < 19) { // 석양
      alpha = 0.2; tint = 0xff9966;
    } else {                              // 밤
      alpha = 0.45; tint = 0x334466;
    }
    this.dayNightOverlay.setFillStyle(0x000033, alpha);
    this.bgImage.setTint(tint);
  }

  // ── 2. MAP GENERATION ─────────────────────────────────────────────────
  generateMap() {
    this.mapData = Array(this.mapHeight).fill().map(() => Array(this.mapWidth).fill(0));

    // Boundaries
    for (let y = 0; y < this.mapHeight; y++)
      for (let x = 0; x < this.mapWidth; x++)
        if (x === 0 || x === this.mapWidth - 1 || y === 0 || y === this.mapHeight - 1)
          this.mapData[y][x] = 1;

    if (persist.currentWorld === 'dungeon') {
      // Dungeon: dense obstacles, room walls
      for (let i = 0; i < 150; i++) {
        const rx = Phaser.Math.Between(3, this.mapWidth - 4);
        const ry = Phaser.Math.Between(3, this.mapHeight - 4);
        this.mapData[ry][rx] = 1;
      }
      // Some wall clusters (rooms)
      for (let r = 0; r < 8; r++) {
        const cx = Phaser.Math.Between(10, this.mapWidth - 10);
        const cy = Phaser.Math.Between(10, this.mapHeight - 10);
        const w = Phaser.Math.Between(3, 6);
        const h = Phaser.Math.Between(3, 6);
        for (let dy = 0; dy < h; dy++)
          for (let dx = 0; dx < w; dx++)
            if (dy === 0 || dy === h - 1 || dx === 0 || dx === w - 1)
              if (this.mapData[cy + dy]?.[cx + dx] !== undefined) this.mapData[cy + dy][cx + dx] = 1;
      }
    } else {
      // Field: sparse nature obstacles
      for (let i = 0; i < 40; i++) {
        const rx = Phaser.Math.Between(5, this.mapWidth - 5);
        const ry = Phaser.Math.Between(5, this.mapHeight - 5);
        this.mapData[ry][rx] = 1;
      }
    }

    // Player start (center)
    const sx = Math.floor(this.mapWidth / 2), sy = Math.floor(this.mapHeight / 2);
    // Clear area around spawn
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++)
        if (this.mapData[sy + dy]?.[sx + dx] !== undefined) this.mapData[sy + dy][sx + dx] = 0;
    this.player.setPosition(...Object.values(this.gridToWorld(sx, sy)));

    // Portal — placed on the top boundary wall
    const px = Math.floor(this.mapWidth / 2), py = 1;
    this.mapData[py][px] = 2;
    // Also mark tiles in front of the door as portal trigger floor
    this.mapData[py + 1][px] = 3;
    this.mapData[py + 2][px] = 3;
    // Store portal world position for distance check
    const portalPos = this.gridToWorld(px, py + 2);
    this.portalWorldX = portalPos.x;
    this.portalWorldY = portalPos.y;
    // Clear the tiles in front of the door so player can reach it
    for (let dy = 3; dy <= 5; dy++)
      for (let dx = -2; dx <= 2; dx++)
        if (this.mapData[py + dy]?.[px + dx] !== undefined)
          this.mapData[py + dy][px + dx] = 0;

    // Clear a path from door area down to player spawn
    const pathStartY = py + 4;
    const stepY = pathStartY < sy ? 1 : -1;
    for (let y = pathStartY; y !== sy; y += stepY) {
      if (this.mapData[y]?.[px] !== undefined) this.mapData[y][px] = 0;
      if (this.mapData[y]?.[px + 1] !== undefined) this.mapData[y][px + 1] = 0;
      if (this.mapData[y]?.[px - 1] !== undefined) this.mapData[y][px - 1] = 0;
    }
  }

  createIsometricGrid() {
    const tw = this.tileSize, th = this.tileSize / 2, wallH = 140;
    const isDungeon = persist.currentWorld === 'dungeon';
    const floorKey = isDungeon ? 'floor_tile' : 'floor_field';
    const wallTint = isDungeon ? 0x888899 : 0x887755;

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const type = this.mapData[y][x];
        const pos = this.gridToWorld(x, y);

        if (type === 1) {
          this.add.image(pos.x - tw / 4, pos.y - wallH / 2, 'wall_tile')
            .setDisplaySize(tw / 2, wallH).setTint(wallTint).setDepth(pos.y + 5);
          this.add.image(pos.x + tw / 4, pos.y - wallH / 2, 'wall_tile')
            .setDisplaySize(tw / 2, wallH).setTint(wallTint).setDepth(pos.y + 5);
        } else if (type === 2) {
          // Floor under door
          this.add.image(pos.x, pos.y, floorKey)
            .setDisplaySize(tw, th).setDepth(-1000);

          // Door embedded in wall
          const doorColor = isDungeon ? 0x00ccff : 0xff8800;
          const doorW = 40, doorH = 100;
          const doorX = pos.x, doorY = pos.y - doorH / 2;

          // Stone door frame (outer)
          const frame = this.add.graphics();
          frame.fillStyle(0x555566, 1);
          frame.fillRect(doorX - doorW / 2 - 8, doorY - doorH / 2 - 12, doorW + 16, doorH + 14);
          // Arch top
          frame.fillCircle(doorX, doorY - doorH / 2 - 4, doorW / 2 + 8);
          frame.setDepth(pos.y + 3);

          // Door interior (dark)
          const door = this.add.graphics();
          door.fillStyle(0x1a1a2e, 1);
          door.fillRect(doorX - doorW / 2, doorY - doorH / 2, doorW, doorH);
          // Arch top interior
          door.fillCircle(doorX, doorY - doorH / 2, doorW / 2);
          door.setDepth(pos.y + 4);

          // Glowing interior effect
          const glow = this.add.graphics();
          glow.fillStyle(doorColor, 0.4);
          glow.fillRect(doorX - doorW / 2 + 4, doorY - doorH / 2 + 4, doorW - 8, doorH - 6);
          glow.fillCircle(doorX, doorY - doorH / 2 + 2, doorW / 2 - 4);
          glow.setDepth(pos.y + 5);
          this.tweens.add({ targets: glow, alpha: 0.2, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

          // Door handle
          const handle = this.add.graphics();
          handle.fillStyle(0xddaa44, 1);
          handle.fillCircle(doorX + doorW / 4, doorY + 5, 3);
          handle.setDepth(pos.y + 6);

          // Label above door
          const label = isDungeon ? '🏘️ 마을로 나가기' : '⚔️ 던전 입장';
          this.add.text(doorX, doorY - doorH / 2 - 30, label, {
            fontSize: '12px', fill: '#fff', stroke: '#000', strokeThickness: 3
          }).setOrigin(0.5).setDepth(pos.y + 7);
        } else if (type === 3) {
          // Portal trigger floor — glowing floor tile in front of door
          this.add.image(pos.x, pos.y, floorKey)
            .setDisplaySize(tw, th).setDepth(-1000);
          const floorGlow = this.add.graphics();
          floorGlow.fillStyle(isDungeon ? 0x00ccff : 0xff8800, 0.15);
          floorGlow.fillRect(pos.x - tw / 2, pos.y - th / 2, tw, th);
          floorGlow.setDepth(-999);
          this.tweens.add({ targets: floorGlow, alpha: 0.05, duration: 1500, yoyo: true, repeat: -1 });
        } else {
          this.add.image(pos.x, pos.y, floorKey)
            .setDisplaySize(tw, th).setDepth(-1000);
        }
      }
    }
  }

  switchWorld() {
    // Save stats
    persist.hp = this.hp; persist.mp = this.mp;
    persist.exp = this.exp; persist.level = this.level;
    persist.currentWorld = persist.currentWorld === 'dungeon' ? 'field' : 'dungeon';
    this.scene.restart();
  }

  // ── ANIMATIONS ────────────────────────────────────────────────────────
  createAnimations() {
    this.anims.create({ key: 'walk-side', frames: this.anims.generateFrameNumbers('knight_sheet', { start: 0, end: 4 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'walk-front', frames: this.anims.generateFrameNumbers('knight_sheet', { start: 5, end: 9 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'walk-back', frames: this.anims.generateFrameNumbers('knight_sheet', { start: 10, end: 14 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'idle-side', frames: [{ key: 'knight_sheet', frame: 0 }], frameRate: 1 });
    this.anims.create({ key: 'idle-front', frames: [{ key: 'knight_sheet', frame: 5 }], frameRate: 1 });
    this.anims.create({ key: 'idle-back', frames: [{ key: 'knight_sheet', frame: 10 }], frameRate: 1 });
    this.anims.create({ key: 'attack', frames: this.anims.generateFrameNumbers('knight_sheet', { start: 15, end: 19 }), frameRate: 15, repeat: 0 });

    // Monster animations (per type)
    const mobTypes = ['mob_slime', 'mob_skeleton', 'mob_orc', 'mob_darkknight', 'mob_dragon'];
    mobTypes.forEach(key => {
      if (!this.textures.exists(key)) return;
      this.anims.create({ key: `${key}_walk`, frames: this.anims.generateFrameNumbers(key, { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
      this.anims.create({ key: `${key}_attack`, frames: this.anims.generateFrameNumbers(key, { start: 4, end: 7 }), frameRate: 10, repeat: 0 });
      this.anims.create({ key: `${key}_hit`, frames: this.anims.generateFrameNumbers(key, { start: 8, end: 9 }), frameRate: 8, repeat: 0 });
    });
  }

  // ── HELPERS ────────────────────────────────────────────────────────────
  gridToWorld(gx, gy) {
    const ox = window.innerWidth / 2, oy = 100;
    return { x: (gx - gy) * (this.tileSize / 2) + ox, y: (gx + gy) * (this.tileSize / 4) + oy };
  }
  worldToGrid(wx, wy) {
    const ox = window.innerWidth / 2, oy = 100;
    const dx = wx - ox, dy = wy - oy;
    return { gx: Math.round((dx / (this.tileSize / 2) + dy / (this.tileSize / 4)) / 2), gy: Math.round((dy / (this.tileSize / 4) - dx / (this.tileSize / 2)) / 2) };
  }
  isWalkable(wx, wy) {
    const { gx, gy } = this.worldToGrid(wx, wy);
    return gy >= 0 && gy < this.mapHeight && gx >= 0 && gx < this.mapWidth && this.mapData[gy][gx] !== 1;
  }

  // ── MONSTER TYPES ─────────────────────────────────────────────────────
  getMonsterTypes() {
    return [
      { name: 'Slime', sprite: 'mob_slime', hp: 30, atk: 3, exp: 15, scale: 0.8, speed: 60, dropRate: 0.3 },
      { name: 'Skeleton', sprite: 'mob_skeleton', hp: 60, atk: 6, exp: 30, scale: 0.85, speed: 80, dropRate: 0.4 },
      { name: 'Orc', sprite: 'mob_orc', hp: 100, atk: 10, exp: 50, scale: 0.95, speed: 70, dropRate: 0.5 },
      { name: 'Dark Knight', sprite: 'mob_darkknight', hp: 200, atk: 18, exp: 120, scale: 1.1, speed: 90, dropRate: 0.7 },
      { name: '🔥 Dragon', sprite: 'mob_dragon', hp: 500, atk: 30, exp: 300, scale: 2.0, speed: 50, dropRate: 1.0 },
    ];
  }

  spawnMonsters() {
    const isDungeon = persist.currentWorld === 'dungeon';
    const types = this.getMonsterTypes();

    // Normal mobs
    const normalCount = isDungeon ? 20 : 8;
    for (let i = 0; i < normalCount; i++) {
      const typeIdx = isDungeon
        ? Phaser.Math.Between(0, 2)   // Slime~Orc in dungeon
        : Phaser.Math.Between(0, 1);  // Slime~Skeleton in field
      this.spawnSingleMonster(types[typeIdx]);
    }

    // Mid-bosses
    const midBossCount = isDungeon ? 3 : 1;
    for (let i = 0; i < midBossCount; i++) {
      this.spawnSingleMonster(types[3]); // Dark Knight
    }

    // Boss (dungeon only)
    if (isDungeon) {
      this.spawnSingleMonster(types[4]); // Dragon
    }
  }

  spawnSingleMonster(type) {
    let gx, gy;
    do {
      gx = Phaser.Math.Between(3, this.mapWidth - 4);
      gy = Phaser.Math.Between(3, this.mapHeight - 4);
    } while (this.mapData[gy][gx] !== 0);

    const pos = this.gridToWorld(gx, gy);
    const monster = this.add.container(pos.x, pos.y);

    // Shadow + Sprite
    const shadowSize = 15 * type.scale;
    const shadow = this.add.ellipse(0, 5, shadowSize * 2, shadowSize * 0.6, 0x000000, 0.25);
    const sprite = this.add.sprite(0, 0, type.sprite).setScale(type.scale).setOrigin(0.5, 0.8);
    monster.add([shadow, sprite]);

    // HP bar
    const barW = Math.min(50, 16 + type.hp / 8);
    const barY = -30 * type.scale - 10;
    const hpBg = this.add.graphics().fillStyle(0x000000, 0.8).fillRect(-barW / 2, barY, barW, 5);
    const hpFill = this.add.graphics().fillStyle(0x00ff00, 1).fillRect(-barW / 2, barY, barW, 5);
    monster.add([hpBg, hpFill]);

    // Name tag
    const nameTxt = this.add.text(0, barY - 12, type.name, {
      fontSize: type.hp >= 200 ? '10px' : '8px',
      fill: type.hp >= 200 ? '#ff8800' : '#fff',
      stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5);
    monster.add(nameTxt);

    monster.hpBar = hpFill;
    monster.hp = type.hp; monster.maxHp = type.hp;
    monster.atk = type.atk; monster.monsterSpeed = type.speed;
    monster.expReward = type.exp; monster.dropRate = type.dropRate;
    monster.barWidth = barW;
    monster.barY = barY;
    monster.spriteKey = type.sprite; // store for animation lookup
    this.monsters.add(monster);
    monster.lastAttackTime = 0;

    // Play walk animation
    const walkKey = `${type.sprite}_walk`;
    if (this.anims.exists(walkKey)) sprite.play(walkKey);

    this.tweens.add({ targets: monster, y: pos.y + 10, duration: 1500 + Math.random() * 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  attackMonster(monster) {
    if (!monster?.active) return;
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, monster.x, monster.y);
    if (dist > 100) { this.moveTo(monster.x, monster.y); return; }
    if (this.time.now - (this.lastAttackTime || 0) < 600) return;
    this.lastAttackTime = this.time.now;
    this.playerSprite.setFlipX(monster.x < this.player.x);
    this.playerSprite.play('attack');
    // MP cost for attack
    this.mp = Math.max(0, this.mp - 3);
    this.time.delayedCall(250, () => {
      if (!monster?.active) return;
      const dmg = Math.max(1, Phaser.Math.Between(this.attackRating, this.attackRating + 5) - 2);
      this.showDamage(monster.x, monster.y - 40, dmg);
      monster.hp -= dmg;
      const pc = Math.max(0, monster.hp / monster.maxHp);
      monster.hpBar.clear().fillStyle(pc > 0.3 ? 0x00ff00 : 0xff0000, 1).fillRect(-monster.barWidth / 2, monster.barY, monster.barWidth * pc, 5);

      // Play hit animation on monster
      const hitKey = `${monster.spriteKey}_hit`;
      const mobSprite = monster.list[1];
      if (this.anims.exists(hitKey)) {
        mobSprite.play(hitKey);
        mobSprite.once('animationcomplete', () => {
          if (monster?.active) {
            const wk = `${monster.spriteKey}_walk`;
            if (this.anims.exists(wk)) mobSprite.play(wk);
          }
        });
      } else {
        mobSprite.setTint(0xff0000);
        this.time.delayedCall(100, () => { if (monster?.active) mobSprite.clearTint(); });
      }

      if (monster.hp <= 0) this.killMonster(monster);
    });
  }

  showDamage(x, y, amount) {
    const txt = this.add.text(x, y, `-${amount}`, { fontSize: '24px', fill: '#ff3d00', fontWeight: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
    this.tweens.add({ targets: txt, y: y - 60, alpha: 0, duration: 800, onComplete: () => txt.destroy() });
  }

  killMonster(monster) {
    const expGain = monster.expReward || 25;
    this.exp += expGain; if (this.exp >= 100) this.levelUp();
    this.showFloatingText(monster.x, monster.y - 70, `+${expGain} EXP`, '#ffdd00');
    const dr = monster.dropRate || 0.5;
    if (Math.random() < dr) this.dropItem(monster.x, monster.y);
    monster.destroy(); this.updateUI();
    // Respawn a random normal mob after delay
    this.time.delayedCall(5000, () => {
      const types = this.getMonsterTypes();
      const idx = Phaser.Math.Between(0, 2);
      this.spawnSingleMonster(types[idx]);
    });
  }

  // ── 3. ITEM DROP & INVENTORY ──────────────────────────────────
  getDropTable() {
    // weight: higher = more common
    return [
      { type: 'hp_potion', img: 'item_hp', name: 'HP 물약', weight: 25 },
      { type: 'mp_potion', img: 'item_mp', name: 'MP 물약', weight: 20 },
      { type: 'gold', img: 'item_gold', name: '골드', weight: 30 },
      { type: 'meat', img: 'item_meat', name: '구운 고기', weight: 10 },
      { type: 'scroll', img: 'item_scroll', name: '마법 스크롤', weight: 5 },
      { type: 'gem', img: 'item_gem', name: '보석', weight: 5 },
      { type: 'sword', img: 'item_sword', name: '강철검', weight: 3 },
      { type: 'shield', img: 'item_shield', name: '철 방패', weight: 2 },
      { type: 'ring', img: 'item_ring', name: '마법 반지', weight: 1 },
    ];
  }

  dropItem(x, y) {
    const table = this.getDropTable();
    const totalWeight = table.reduce((s, t) => s + t.weight, 0);
    let roll = Math.random() * totalWeight;
    let chosen = table[0];
    for (const entry of table) {
      roll -= entry.weight;
      if (roll <= 0) { chosen = entry; break; }
    }

    const item = this.add.container(x, y);
    const sprite = this.add.image(0, 0, chosen.img).setScale(0.45);
    item.add(sprite);
    item.type = chosen.type;
    item.imgKey = chosen.img;
    item.itemName = chosen.name;
    item.setDepth(y - 1);
    this.items.add(item);
    this.tweens.add({ targets: item, y: y - 15, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  collectItem(item) {
    const colors = {
      hp_potion: '#ff4444', mp_potion: '#4488ff', gold: '#ffd700',
      meat: '#ff8844', scroll: '#88ddff', gem: '#ff66cc',
      sword: '#ffaa00', shield: '#aaaaff', ring: '#dd88ff'
    };
    if (item.type === 'gold') {
      persist.gold += Phaser.Math.Between(5, 20);
    }
    this.addToInventory(item.type, item.imgKey, item.itemName);
    this.showFloatingText(this.player.x, this.player.y - 50, `${item.itemName} Get!`, colors[item.type] || '#fff');
    this.updateUI();
    item.destroy();
  }

  addToInventory(type, imgKey, name) {
    const existing = persist.inventory.find(i => i.type === type);
    if (existing) { existing.qty++; }
    else { persist.inventory.push({ type, imgKey, name, qty: 1 }); }
    this.renderInventory();
  }

  renderInventory() {
    const slots = document.querySelectorAll('.inv-slot');
    slots.forEach(s => { s.innerHTML = ''; s.title = ''; s.onclick = null; });
    persist.inventory.forEach((item, i) => {
      if (i < slots.length) {
        slots[i].innerHTML = `<img src="/assets/${item.imgKey}.png" class="inv-item-img" alt="${item.name}"><span class="item-qty">${item.qty}</span>`;
        slots[i].title = `${item.name} (Click to use)`;
        slots[i].onclick = () => this.useItem(i);
      }
    });
  }

  useItem(index) {
    const item = persist.inventory[index];
    if (!item) return;

    let msg = '', color = '#fff';
    switch (item.type) {
      case 'hp_potion':
        this.hp = Math.min(this.maxHp, this.hp + 30);
        msg = 'HP +30!'; color = '#00ff00';
        document.getElementById('hp-bar')?.classList.add('bar-flash');
        setTimeout(() => document.getElementById('hp-bar')?.classList.remove('bar-flash'), 500);
        break;
      case 'mp_potion':
        this.mp = Math.min(this.maxMp, this.mp + 30);
        msg = 'MP +30!'; color = '#4488ff';
        document.getElementById('mp-bar')?.classList.add('bar-flash');
        setTimeout(() => document.getElementById('mp-bar')?.classList.remove('bar-flash'), 500);
        break;
      case 'meat':
        this.hp = Math.min(this.maxHp, this.hp + 50);
        msg = 'HP +50! 맛있다!'; color = '#ff8844';
        document.getElementById('hp-bar')?.classList.add('bar-flash');
        setTimeout(() => document.getElementById('hp-bar')?.classList.remove('bar-flash'), 500);
        break;
      case 'scroll':
        this.mp = Math.min(this.maxMp, this.mp + 50);
        msg = 'MP +50! 마나 회복!'; color = '#88ddff';
        document.getElementById('mp-bar')?.classList.add('bar-flash');
        setTimeout(() => document.getElementById('mp-bar')?.classList.remove('bar-flash'), 500);
        break;
      case 'sword':
        this.attackRating += 5;
        msg = '공격력 +5!'; color = '#ffaa00';
        break;
      case 'shield':
        this.defenseRating += 5;
        msg = '방어력 +5!'; color = '#aaaaff';
        break;
      case 'ring':
        this.maxHp += 20; this.maxMp += 20;
        this.hp += 20; this.mp += 20;
        msg = 'MAX HP/MP +20!'; color = '#dd88ff';
        break;
      case 'gem':
        persist.gold += 50;
        msg = '보석 판매! Gold +50'; color = '#ff66cc';
        break;
      case 'gold':
        persist.gold += 10;
        msg = 'Gold +10'; color = '#ffd700';
        break;
      default: return;
    }

    this.showFloatingText(this.player.x, this.player.y - 50, msg, color);
    item.qty--;
    if (item.qty <= 0) persist.inventory.splice(index, 1);
    this.renderInventory();
    this.updateUI();
  }

  showFloatingText(x, y, message, color) {
    const txt = this.add.text(x, y, message, { fontSize: '20px', fill: color, fontWeight: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
    this.tweens.add({ targets: txt, y: y - 40, alpha: 0, duration: 1000, onComplete: () => txt.destroy() });
  }

  levelUp() {
    this.level++; this.exp = 0; this.hp = this.maxHp; this.mp = this.maxMp;
    const txt = this.add.text(this.player.x, this.player.y - 120, 'LEVEL UP!', { fontSize: '40px', fill: '#ffd700', fontWeight: 'bold', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5);
    this.tweens.add({ targets: txt, y: txt.y - 80, alpha: 0, duration: 2000, onComplete: () => txt.destroy() });
    this.updateUI();
  }

  moveTo(x, y) {
    if (!this.isWalkable(x, y)) return;
    this.moveMarker.setPosition(x, y).setVisible(true).setAlpha(1).scale = 0.5;
    this.tweens.add({ targets: this.moveMarker, alpha: 0, scale: 1.5, duration: 400, onComplete: () => this.moveMarker.setVisible(false) });
    this.playerSprite.setFlipX(x < this.player.x);
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
    this.tweens.killTweensOf(this.player);
    this.tweens.add({ targets: this.player, x, y, duration: (dist / (this.speed || 220)) * 1000, ease: 'Linear', onStart: () => { this.isMoving = true; }, onComplete: () => { this.isMoving = false; } });
  }

  // ── 4. UI UPDATE ──────────────────────────────────────────────────────
  updateUI() {
    const hpBar = document.getElementById('hp-bar');
    const mpBar = document.getElementById('mp-bar');
    if (hpBar) {
      hpBar.style.width = ((this.hp / this.maxHp) * 100) + '%';
      document.getElementById('hp-text').innerText = `HP: ${Math.floor(this.hp)} / ${this.maxHp}`;
    }
    if (mpBar) {
      mpBar.style.width = ((this.mp / this.maxMp) * 100) + '%';
      document.getElementById('mp-text').innerText = `MP: ${Math.floor(this.mp)} / ${this.maxMp}`;
    }
    const lvl = document.getElementById('level-text');
    if (lvl) lvl.innerText = this.level;
    const ep = document.getElementById('exp-percent');
    if (ep) ep.innerText = `${(this.exp % 100).toFixed(4)}%`;

    // World label
    const worldLabel = document.getElementById('world-label');
    if (worldLabel) worldLabel.innerText = persist.currentWorld === 'dungeon' ? '⚔️ 지하 던전' : '🏘️ 마을 평원';

    // Gold display
    const goldEl = document.getElementById('gold-display');
    if (goldEl) goldEl.innerText = persist.gold;

    // Menu listeners (once)
    if (!this.uiInitialized) {
      document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.onclick = () => {
          const win = document.getElementById('inventory-window');
          if (win) win.classList.toggle('hidden');
          this.renderInventory();
        };
      });
      document.querySelector('.close-btn')?.addEventListener('click', () => {
        document.getElementById('inventory-window')?.classList.add('hidden');
      });
      this.uiInitialized = true;
    }
  }

  // ── GAME LOOP ─────────────────────────────────────────────────────────
  update() {
    // MP Regen
    if (this.mp < this.maxMp) {
      this.mp = Math.min(this.maxMp, this.mp + 0.05);
      this.updateUI();
    }

    const vx = this.player.x - (this.prevX || this.player.x);
    const vy = this.player.y - (this.prevY || this.player.y);
    this.handleKeyboardMovement();
    this.updateMonsters();

    // Animation
    if (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1) {
      let anim = 'walk-side';
      if (Math.abs(vy) > Math.abs(vx)) anim = vy > 0 ? 'walk-front' : 'walk-back';
      else this.playerSprite.setFlipX(vx < 0);
      if (this.playerSprite.anims.currentAnim?.key !== anim) this.playerSprite.play(anim);
      this.lastDir = anim.split('-')[1];
    } else if (this.playerSprite.anims.currentAnim?.key !== 'attack') {
      const idleKey = `idle-${this.lastDir || 'side'}`;
      if (this.playerSprite.anims.currentAnim?.key !== idleKey) this.playerSprite.play(idleKey);
      this.playerSprite.y = Math.sin(this.time.now / 300) * 1.5;
    }

    this.prevX = this.player.x;
    this.prevY = this.player.y;
    this.player.setDepth(this.player.y);

    // Portal check — distance-based
    if (this.portalWorldX !== undefined && !this.worldSwitching) {
      const pDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.portalWorldX, this.portalWorldY);

      if (pDist < 120) {
        this.worldSwitching = true;
        // Save before switch
        persist.hp = this.hp; persist.mp = this.mp;
        persist.exp = this.exp; persist.level = this.level;
        this.switchWorld();
      }
    }

    // Handle Magic Keys
    if (Phaser.Input.Keyboard.JustDown(this.magicKeys.F1) || Phaser.Input.Keyboard.JustDown(this.magicKeys.ONE)) this.magicHeal();
    if (Phaser.Input.Keyboard.JustDown(this.magicKeys.F2) || Phaser.Input.Keyboard.JustDown(this.magicKeys.TWO)) this.magicEnergyBolt();
    if (Phaser.Input.Keyboard.JustDown(this.magicKeys.F3) || Phaser.Input.Keyboard.JustDown(this.magicKeys.THREE)) this.magicHaste();
  }

  handleKeyboardMovement() {
    // Don't queue new movement if already tweening from keyboard
    if (this.tweens.isTweening(this.player)) return;

    let vx = 0, vy = 0;
    if (this.keys.W.isDown) vy = -1;
    if (this.keys.S.isDown) vy = 1;
    if (this.keys.A.isDown) vx = -1;
    if (this.keys.D.isDown) vx = 1;

    if (vx !== 0 || vy !== 0) {
      // Normalize for diagonal
      const len = Math.sqrt(vx * vx + vy * vy);
      vx /= len; vy /= len;

      // Step size (half a tile feels natural)
      const stepSize = this.tileSize * 0.4;
      const nx = this.player.x + vx * stepSize;
      const ny = this.player.y + vy * stepSize;

      if (this.isWalkable(nx, ny)) {
        this.isMoving = true;
        this.tweens.add({
          targets: this.player,
          x: nx, y: ny,
          duration: (stepSize / (this.speed || 220)) * 1000,
          ease: 'Linear',
          onComplete: () => {
            // If key is still held, the next frame's update will queue another step
            if (!this.keys.W.isDown && !this.keys.S.isDown &&
              !this.keys.A.isDown && !this.keys.D.isDown) {
              this.isMoving = false;
            }
          }
        });
      }
    } else if (this.isMoving && !this.tweens.isTweening(this.player)) {
      this.isMoving = false;
    }
  }

  updateMonsters() {
    this.items.getChildren().forEach(item => {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, item.x, item.y) < 40) this.collectItem(item);
    });
    this.monsters.getChildren().forEach(monster => {
      if (!monster.active) return;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, monster.x, monster.y);
      if (dist < 300 && dist > 50) {
        const spd = (monster.monsterSpeed || 100) / 60;
        const ang = Phaser.Math.Angle.Between(monster.x, monster.y, this.player.x, this.player.y);
        monster.x += Math.cos(ang) * spd; monster.y += Math.sin(ang) * spd;
      } else if (dist < 50) {
        const atkDmg = monster.atk || 5;
        if (this.time.now - (monster.lastAttackTime || 0) > 1000) {
          this.playerHit(atkDmg);
          monster.lastAttackTime = this.time.now;
          // Play monster attack animation
          const atkKey = `${monster.spriteKey}_attack`;
          const mobSpr = monster.list[1];
          if (this.anims.exists(atkKey)) {
            mobSpr.play(atkKey);
            mobSpr.once('animationcomplete', () => {
              if (monster?.active) {
                const wk = `${monster.spriteKey}_walk`;
                if (this.anims.exists(wk)) mobSpr.play(wk);
              }
            });
          }
        }
      }
      monster.setDepth(monster.y);
    });
  }

  playerHit(damage) {
    this.hp -= Math.max(1, damage - Math.floor(this.defenseRating / 2)); this.updateUI();
    this.cameras.main.shake(100, 0.005); this.playerSprite.setTint(0xff0000);
    // HP bar damage animation
    document.getElementById('hp-bar')?.classList.add('bar-damage');
    setTimeout(() => document.getElementById('hp-bar')?.classList.remove('bar-damage'), 300);
    this.time.delayedCall(100, () => { if (this.playerSprite) this.playerSprite.clearTint(); });
    if (this.hp <= 0) this.gameOver();
  }

  gameOver() { alert("Game Over! Restarting..."); persist.hp = persist.maxHp; persist.mp = persist.maxMp; this.scene.restart(); }
}

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth, height: window.innerHeight,
  parent: 'game-container',
  backgroundColor: '#030308',
  scene: [MainGame],
  physics: { default: 'arcade', arcade: { gravity: { y: 0 } } },
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH }
};
const game = new Phaser.Game(config); window.game = game;
