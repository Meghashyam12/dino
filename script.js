'use strict';

// Persistent state
const storage = {
  getHighScore(mode) {
    try { return Number(localStorage.getItem(`sdr_high_score_${mode}`) || 0); } catch { return 0; }
  },
  setHighScore(mode, v) {
    try { localStorage.setItem(`sdr_high_score_${mode}`, String(v)); } catch {}
  }
};

// DOM elements
const startScreenEl = document.getElementById('startScreen');
const avatarListEl = document.getElementById('avatarList');
const levelButtons = Array.from(document.querySelectorAll('.level'));
const startBtn = document.getElementById('startBtn');
const gameContainerEl = document.getElementById('gameContainer');
const canvas = document.getElementById('gameCanvas');
const hudScoreEl = document.getElementById('score');
const hudHiScoreEl = document.getElementById('hiScore');
const hudLevelEl = document.getElementById('levelLabel');
const pauseOverlayEl = document.getElementById('pauseOverlay');
const gameOverEl = document.getElementById('gameOver');
const finalScoreEl = document.getElementById('finalScore');
const homeBtn = document.getElementById('homeBtn');
const restartBtn = document.getElementById('restartBtn');

const ctx = canvas.getContext('2d');

// Utility helpers
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function randRange(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(randRange(min, max + 1)); }
function choose(array) { return array[Math.floor(Math.random() * array.length)]; }

// Avatar drawing primitives
const AvatarDrawers = [
  // Emerald Rex
  (ctx, x, y, scale, tint = '#2df8a0', eye = '#08131f') => {
    const s = scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(-1, 1);
    // body
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.roundRect(-18*s, -10*s, 36*s, 22*s, 6*s);
    ctx.fill();
    // tail
    ctx.beginPath();
    ctx.moveTo(16*s, -6*s); ctx.lineTo(28*s, -2*s); ctx.lineTo(16*s, 2*s); ctx.closePath();
    ctx.fill();
    // legs
    ctx.fillRect(-10*s, 12*s, 9*s, 8*s);
    ctx.fillRect(3*s, 12*s, 9*s, 8*s);
    // head
    ctx.beginPath();
    ctx.roundRect(-24*s, -24*s, 24*s, 16*s, 6*s);
    ctx.fill();
    // spines
    ctx.fillStyle = '#0ce38a';
    for (let i=0;i<4;i++) {
      ctx.beginPath();
      const px = -4*s + i*8*s; const py = -12*s - i*2*s;
      ctx.moveTo(px, py); ctx.lineTo(px+4*s, py-8*s); ctx.lineTo(px+8*s, py); ctx.closePath();
      ctx.fill();
    }
    // eye
    ctx.fillStyle = eye; ctx.beginPath(); ctx.arc(-10*s, -16*s, 2.2*s, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  },
  // Crimson Blaze
  (ctx, x, y, scale) => AvatarDrawers[0](ctx, x, y, scale, '#ff5765'),
  // Azure Nova
  (ctx, x, y, scale) => AvatarDrawers[0](ctx, x, y, scale, '#52a7ff'),
  // Violet Storm
  (ctx, x, y, scale) => AvatarDrawers[0](ctx, x, y, scale, '#b16cff'),
  // Solar Gold
  (ctx, x, y, scale) => AvatarDrawers[0](ctx, x, y, scale, '#ffd166'),
  // Mint Frost
  (ctx, x, y, scale) => AvatarDrawers[0](ctx, x, y, scale, '#6ff6e8'),
];

function drawAvatarCrouch(ctx, x, y, scale) {
  // Draw a compact crouched variant facing right by reusing the base shape scaled and shifted
  const s = scale;
  ctx.save();
  ctx.translate(x, y + 6 * s);
  ctx.scale(-1, 1);
  // body squashed
  ctx.fillStyle = '#3be7a9';
  ctx.beginPath();
  ctx.roundRect(-20*s, -12*s, 40*s, 18*s, 6*s);
  ctx.fill();
  // head closer to body
  ctx.beginPath();
  ctx.roundRect(-22*s, -22*s, 20*s, 12*s, 5*s);
  ctx.fill();
  // tail shorter
  ctx.beginPath();
  ctx.moveTo(14*s, -4*s); ctx.lineTo(24*s, -1*s); ctx.lineTo(14*s, 2*s); ctx.closePath();
  ctx.fill();
  // legs tucked
  ctx.fillRect(-8*s, 6*s, 10*s, 6*s);
  ctx.fillRect(2*s, 6*s, 10*s, 6*s);
  // eye
  ctx.fillStyle = '#08131f';
  ctx.beginPath(); ctx.arc(-10*s, -16*s, 2.0*s, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

// Level configurations
const LEVELS = {
  easy: {
    label: 'Easy',
    baseSpeed: 6,
    cycleSeconds: 48,
    spawnIntervalMs: [1200, 1700],
    obstacleTypes: ['cactusSmall','cactusLarge','ptera','tumbleweed'],
    sky: { dayTop: '#bfe7ff', dayBottom: '#f6fbff', nightTop: '#0b1730', nightBottom: '#0f1d3d' },
  },
  medium: {
    label: 'Medium',
    baseSpeed: 8,
    cycleSeconds: 38,
    spawnIntervalMs: [950, 1350],
    obstacleTypes: ['cactusSmall','cactusLarge','ptera','tumbleweed','boulder','firepit'],
    sky: { dayTop: '#b1e0ff', dayBottom: '#eef8ff', nightTop: '#081427', nightBottom: '#0c1833' },
  },
  hard: {
    label: 'Hard',
    baseSpeed: 11,
    cycleSeconds: 28,
    spawnIntervalMs: [700, 1050],
    obstacleTypes: ['cactusSmall','cactusLarge','ptera','tumbleweed','boulder','firepit','spikeStack'],
    sky: { dayTop: '#a7daff', dayBottom: '#e9f5ff', nightTop: '#071022', nightBottom: '#0a152b' },
  },
};

// Canvas sizing
let devicePixelRatioCached = window.devicePixelRatio || 1;
function resizeCanvas() {
  const rect = gameContainerEl.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  devicePixelRatioCached = dpr;
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Input state
const inputState = {
  isJumpQueued: false,
  isDuckHeld: false,
  lastClickTime: 0,
};

// Game state
let currentLevelKey = 'easy';
let selectedAvatarIndex = 0;
let animationHandle = 0;

class Player {
  constructor() {
    this.x = 90; // in CSS pixels
    this.groundY = 0; // computed per layout
    this.width = 44;
    this.height = 48;
    this.duckHeight = 30;
    this.velocityY = 0;
    this.gravity = 0.95;
    this.jumpStrength = 16.5;
    this.doubleJumpStrength = 14.5;
    this.isOnGround = true;
    this.isDucking = false;
    this.doubleJumpAvailable = false;
    this.runFrame = 0;
    this.runTimer = 0;
    this.timeSinceGroundedMs = 0;
    this.coyoteMs = 120;
    this.jumpCeilingY = 20;
  }
  reset(groundY) {
    this.groundY = groundY;
    this.x = 90;
    this.y = groundY - this.height;
    this.velocityY = 0;
    this.isOnGround = true;
    this.isDucking = false;
    this.doubleJumpAvailable = false;
    this.runFrame = 0;
    this.runTimer = 0;
    this.timeSinceGroundedMs = 0;
  }
  tryJump() {
    if (this.isOnGround || this.timeSinceGroundedMs < this.coyoteMs) {
      this.velocityY = -this.jumpStrength;
      this.isOnGround = false;
      this.doubleJumpAvailable = true;
      this.timeSinceGroundedMs = this.coyoteMs; // consume coyote
    } else if (this.doubleJumpAvailable) {
      this.velocityY = -this.doubleJumpStrength;
      this.doubleJumpAvailable = false;
    }
  }
  setDuck(ducking) {
    this.isDucking = ducking && this.isOnGround;
  }
  update(delta, worldSpeed) {
    // Gravity
    this.velocityY += this.gravity * (delta / (1000/60));
    this.y += this.velocityY;

    // Prevent exiting top of screen
    if (this.y < this.jumpCeilingY) {
      this.y = this.jumpCeilingY;
      if (this.velocityY < 0) this.velocityY = 0;
    }

    const targetHeight = this.isDucking ? this.duckHeight : this.height;
    if (this.isOnGround) {
      // small bob while running (disabled while ducking)
      if (!this.isDucking) {
        this.runTimer += delta * (worldSpeed / 6);
      }
      const bob = this.isDucking ? 0 : Math.sin(this.runTimer * 0.02) * 1.2;
      this.y = this.groundY - targetHeight + bob;
      this.velocityY = 0;
    }

    if (this.y + targetHeight >= this.groundY) {
      this.y = this.groundY - targetHeight;
      if (!this.isOnGround) {
        this.isOnGround = true;
        this.timeSinceGroundedMs = 0;
      } else {
        this.isOnGround = true;
      }
    } else {
      this.isOnGround = false;
      this.timeSinceGroundedMs += delta;
    }
  }
  draw(ctx) {
    const baseY = this.y;
    const scale = 1.0;
    const drawer = this.isDucking ? drawAvatarCrouch : AvatarDrawers[selectedAvatarIndex];
    drawer(ctx, this.x, baseY + 16, scale);
    // shadow
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(this.x, this.groundY + 6, 26, 6, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
  getCollisionBox() {
    const h = this.isDucking ? this.duckHeight : this.height;
    return { x: this.x - 18, y: this.y, w: 36, h };
  }
}

class Obstacle {
  constructor(type, x, groundY, speed) {
    this.type = type;
    this.x = x;
    this.groundY = groundY;
    this.speed = speed;
    this.remove = false;

    // Type-specific sizing
    switch(type) {
      case 'cactusSmall':
        this.w = 24; this.h = 38; this.y = groundY - this.h; break;
      case 'cactusLarge':
        this.w = 32; this.h = 56; this.y = groundY - this.h; break;
      case 'ptera':
        this.w = 46; this.h = 24; this.y = groundY - choose([110, 140, 170]); this.flap = 0; break;
      case 'boulder':
        this.r = 18; this.spin = 0; this.y = groundY - this.r*2; this.w = this.h = this.r*2; break;
      case 'tumbleweed':
        this.r = 12; this.spin = 0; this.y = groundY - this.r*2; this.w = this.h = this.r*2; break;
      case 'firepit':
        this.w = 42; this.h = 14; this.y = groundY - this.h; this.flicker = 0; break;
      case 'spikeStack':
        this.w = 44; this.h = 28; this.y = groundY - this.h; break;
      default:
        this.w = 24; this.h = 32; this.y = groundY - this.h; break;
    }
  }
  update(delta) {
    const pxPerMs = this.speed / 16.6667; // calibrate to 60fps
    this.x -= pxPerMs * delta;

    if (this.type === 'ptera') {
      this.flap += delta * 0.02;
    } else if (this.type === 'boulder' || this.type === 'tumbleweed') {
      this.spin += delta * (this.type === 'boulder' ? 0.01 : 0.03);
    } else if (this.type === 'firepit') {
      this.flicker += delta * 0.045;
    }

    if (this.x + this.w < -50) this.remove = true;
  }
  draw(ctx) {
    ctx.save();
    switch(this.type) {
      case 'cactusSmall':
        drawCactus(ctx, this.x, this.y, this.w, this.h, '#2b9348');
        break;
      case 'cactusLarge':
        drawCactus(ctx, this.x, this.y, this.w, this.h, '#007f5f');
        break;
      case 'ptera':
        drawPterodactyl(ctx, this.x, this.y, this.w, this.h, this.flap);
        break;
      case 'boulder':
        drawBoulder(ctx, this.x, this.y, this.r, this.spin);
        break;
      case 'tumbleweed':
        drawTumbleweed(ctx, this.x, this.y, this.r, this.spin);
        break;
      case 'firepit':
        drawFirepit(ctx, this.x, this.y, this.w, this.h, this.flicker);
        break;
      case 'spikeStack':
        drawSpikes(ctx, this.x, this.y, this.w, this.h);
        break;
    }
    ctx.restore();
  }
  getCollisionBox() {
    if (this.type === 'boulder' || this.type === 'tumbleweed') {
      return { x: this.x - this.r, y: this.y, w: this.r*2, h: this.r*2 };
    }
    if (this.type === 'ptera') {
      return { x: this.x - this.w/2, y: this.y, w: this.w, h: this.h };
    }
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

// Background elements
class Cloud {
  constructor(x, y, speed) {
    this.x = x; this.y = y; this.speed = speed; this.remove = false;
    this.scale = randRange(0.6, 1.3);
  }
  update(delta) {
    this.x -= (this.speed * 0.2) * (delta / 16.6667);
    if (this.x < -200) this.remove = true;
  }
  draw(ctx) {
    drawCloud(ctx, this.x, this.y, this.scale);
  }
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Drawing helpers for obstacles and background
function drawGround(ctx, width, groundY, t, palette) {
  // sand line
  ctx.fillStyle = palette.ground || '#b08968';
  ctx.fillRect(0, groundY, width, 4);
  ctx.fillStyle = palette.ground2 || '#7f5539';
  // parallax strips
  const speed = 120;
  const offset = (t/1000 * speed) % 40;
  for (let x=-offset; x<width; x+=40) {
    ctx.fillRect(x, groundY+4, 20, 2);
  }
}

function drawCactus(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  // arms
  ctx.fillRect(x-6, y+8, 6, 20);
  ctx.fillRect(x+w, y+12, 6, 24);
}

function drawPterodactyl(ctx, x, y, w, h, flap) {
  const wing = Math.sin(flap) * 10;
  ctx.save();
  ctx.translate(x, y+h/2);
  ctx.fillStyle = '#5e5ce6';
  ctx.beginPath();
  ctx.moveTo(-w/2, 0);
  ctx.lineTo(0, -h/2 - wing);
  ctx.lineTo(w/2, 0);
  ctx.lineTo(0, h/2 + wing);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBoulder(ctx, x, y, r, spin) {
  ctx.save();
  ctx.translate(x, y + r);
  ctx.rotate(spin);
  ctx.fillStyle = '#8d99ae';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#6c757d';
  for (let i=0;i<5;i++) {
    ctx.beginPath();
    ctx.arc(Math.cos(i)*r*0.5, Math.sin(i*1.8)*r*0.4, r*0.18, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTumbleweed(ctx, x, y, r, spin) {
  ctx.save();
  ctx.translate(x, y + r);
  ctx.rotate(spin);
  ctx.strokeStyle = '#d4a373';
  ctx.lineWidth = 2;
  for (let i=0;i<8;i++) {
    ctx.beginPath();
    ctx.arc(0, 0, r * (0.5 + (i%3)/6), i*0.8, i*0.8 + 2.4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFirepit(ctx, x, y, w, h, flicker) {
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(x, y+h-6, w, 6);
  for (let i=0;i<3;i++) {
    const phase = flicker + i*0.8;
    const fx = x + 6 + i*(w-12)/2;
    const fh = 16 + Math.sin(phase)*4;
    const color = i === 1 ? '#ff9f1c' : '#ff5714';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(fx, y+h-6);
    ctx.quadraticCurveTo(fx+6, y- fh*0.4, fx+12, y+h-6);
    ctx.fill();
  }
}

function drawSpikes(ctx, x, y, w, h) {
  ctx.fillStyle = '#adb5bd';
  const spikes = 5;
  const step = w / spikes;
  for (let i=0;i<spikes;i++) {
    ctx.beginPath();
    ctx.moveTo(x + i*step, y+h);
    ctx.lineTo(x + i*step + step/2, y);
    ctx.lineTo(x + (i+1)*step, y+h);
    ctx.fill();
  }
}

function drawCloud(ctx, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI*2);
  ctx.arc(18, -6, 14, 0, Math.PI*2);
  ctx.arc(-16, -8, 12, 0, Math.PI*2);
  ctx.arc(2, -12, 10, 0, Math.PI*2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Day/Night sky
function drawSky(ctx, width, height, dayFactor, sky) {
  const t = dayFactor; // 0..1
  const mix = (a, b, t) => {
    const ca = hexToRgb(a), cb = hexToRgb(b);
    const cr = {
      r: Math.round(ca.r + (cb.r - ca.r) * t),
      g: Math.round(ca.g + (cb.g - ca.g) * t),
      b: Math.round(ca.b + (cb.b - ca.b) * t),
    };
    return `rgb(${cr.r},${cr.g},${cr.b})`;
  };
  const top = mix(sky.nightTop, sky.dayTop, daylightCurve(t));
  const bottom = mix(sky.nightBottom, sky.dayBottom, daylightCurve(t));
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

function daylightCurve(t) {
  // Slow transitions at day/night edges
  return 0.5 - 0.5*Math.cos(t * Math.PI*2);
}

function hexToRgb(hex) {
  const h = hex.replace('#','');
  const bigint = parseInt(h.length===3? h.split('').map(c=>c+c).join('') : h, 16);
  return { r:(bigint>>16)&255, g:(bigint>>8)&255, b:bigint&255 };
}

class Game {
  constructor() {
    this.reset();
  }
  reset() {
    this.running = false;
    this.paused = false;
    this.score = 0;
    this.hiScore = storage.getHighScore(currentLevelKey) || 0;
    this.worldSpeed = LEVELS[currentLevelKey].baseSpeed;
    this.spawnTimerMs = 0;
    this.nextSpawnInMs = randInt(...LEVELS[currentLevelKey].spawnIntervalMs);
    this.timeOfDay = Math.random(); // start at random phase
    this.clouds = [];
    this.obstacles = [];
    this.groundY = Math.floor(canvas.getBoundingClientRect().height * 0.78);
    this.player = new Player();
    this.player.reset(this.groundY);
    this._ensureClouds();
    this.lastJumpPressedMs = -9999;
    this.jumpBufferMs = 120;
  }
  start() {
    this.running = true;
    this.paused = false;
    this.lastTs = performance.now();
    cancelAnimationFrame(animationHandle);
    const loop = (ts) => {
      animationHandle = requestAnimationFrame(loop);
      const delta = clamp(ts - this.lastTs, 0, 100);
      this.lastTs = ts;
      if (!this.paused) {
        this.update(delta);
        this.draw();
      }
    };
    animationHandle = requestAnimationFrame(loop);
  }
  pauseToggle() {
    this.paused = !this.paused;
    pauseOverlayEl.classList.toggle('hidden', !this.paused);
  }
  gameOver() {
    this.running = false;
    this.paused = true;
    gameOverEl.classList.remove('hidden');
    finalScoreEl.textContent = `Score: ${String(this.score).padStart(5,'0')}`;
    const newHi = Math.max(this.hiScore, this.score);
    storage.setHighScore(currentLevelKey, newHi);
    hudHiScoreEl.textContent = `HI ${String(newHi).padStart(5,'0')}`;
  }
  restart() {
    gameOverEl.classList.add('hidden');
    this.reset();
    this.start();
  }
  _ensureClouds() {
    for (let i=0;i<6;i++) {
      this.clouds.push(new Cloud(randRange(0, canvas.width/devicePixelRatioCached), randRange(40, 180), randRange(20, 40)));
    }
  }
  _spawnCloudMaybe(delta) {
    if (Math.random() < 0.008 * (delta/16.6667)) {
      this.clouds.push(new Cloud(canvas.width/devicePixelRatioCached + 60, randRange(30, 160), randRange(20, 40)));
    }
  }
  _spawnObstacle() {
    const types = LEVELS[currentLevelKey].obstacleTypes;
    const type = choose(types);
    const speed = this.worldSpeed * randRange(0.98, 1.08);
    const x = canvas.width / devicePixelRatioCached + 40;
    const obs = new Obstacle(type, x, this.groundY, speed);
    this.obstacles.push(obs);
  }
  update(delta) {
    // Speed ramps up with score
    const speedRamp = 1 + Math.min(1.2, this.score / 5000 * 0.6);
    this.worldSpeed = LEVELS[currentLevelKey].baseSpeed * speedRamp;

    // Time of day
    const cycleMs = LEVELS[currentLevelKey].cycleSeconds * 1000;
    this.timeOfDay = (this.timeOfDay + (delta / cycleMs)) % 1;

    // Spawn obstacles
    this.spawnTimerMs += delta;
    if (this.spawnTimerMs >= this.nextSpawnInMs) {
      this._spawnObstacle();
      this.spawnTimerMs = 0;
      const [minI, maxI] = LEVELS[currentLevelKey].spawnIntervalMs;
      this.nextSpawnInMs = randInt(minI, maxI);
    }

    // Update clouds
    this._spawnCloudMaybe(delta);
    for (const cloud of this.clouds) cloud.update(delta);
    this.clouds = this.clouds.filter(c => !c.remove);

    // Update obstacles
    for (const o of this.obstacles) o.update(delta);
    this.obstacles = this.obstacles.filter(o => !o.remove);

    // Handle input
    // Jump buffer: remember recent jump inputs briefly
    if (inputState.isJumpQueued) {
      this.lastJumpPressedMs = performance.now();
      inputState.isJumpQueued = false;
    }
    if (performance.now() - this.lastJumpPressedMs <= this.jumpBufferMs) {
      this.player.tryJump();
      this.lastJumpPressedMs = -9999;
    }

    this.player.setDuck(inputState.isDuckHeld);

    // Update player
    this.player.update(delta, this.worldSpeed);

    // Score
    this.score += Math.round((delta/16.6667) * (this.worldSpeed * 0.5));
    hudScoreEl.textContent = String(this.score).padStart(5,'0');
    this.hiScore = Math.max(this.hiScore, this.score);
    hudHiScoreEl.textContent = `HI ${String(this.hiScore).padStart(5,'0')}`;

    // Collisions
    const pb = this.player.getCollisionBox();
    for (const o of this.obstacles) {
      const ob = o.getCollisionBox();
      if (rectsOverlap(pb, ob)) {
        this.gameOver();
        break;
      }
    }
  }
  draw() {
    const rect = gameContainerEl.getBoundingClientRect();
    const sky = LEVELS[currentLevelKey].sky;
    drawSky(ctx, rect.width, rect.height, this.timeOfDay, sky);

    // Sun and Moon
    drawSunAndMoon(ctx, rect.width, rect.height, this.timeOfDay);

    // Clouds
    for (const cloud of this.clouds) cloud.draw(ctx);

    // Ground and parallax dunes
    const palette = { ground: '#ccad8f', ground2: '#8d6e63' };
    drawGround(ctx, rect.width, this.groundY, performance.now(), palette);

    // Obstacles
    for (const o of this.obstacles) o.draw(ctx);

    // Player
    this.player.draw(ctx);
  }
}

function drawSunAndMoon(ctx, width, height, t) {
  // map t [0..1) around the top semicircle
  const cx = width * 0.5;
  const cy = height * 1.05; // center below horizon
  const radius = height * 0.9;
  const angle = Math.PI + t * Math.PI * 2; // day/night progression

  const sunAngle = angle;
  const moonAngle = (angle + Math.PI) % (Math.PI*2);

  const sun = { x: cx + Math.cos(sunAngle)*radius, y: cy + Math.sin(sunAngle)*radius };
  const moon = { x: cx + Math.cos(moonAngle)*radius, y: cy + Math.sin(moonAngle)*radius };

  // Sun
  ctx.save();
  ctx.globalAlpha = clamp(1 - daylightCurve(t)*0.2, 0.7, 1);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(sun.x, sun.y, 26, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // Moon
  ctx.save();
  ctx.globalAlpha = clamp(0.9 - (daylightCurve(t))*0.9, 0, 0.9);
  ctx.fillStyle = '#e6edf7';
  ctx.beginPath();
  ctx.arc(moon.x, moon.y, 18, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#cfd9e6';
  for (let i=0;i<5;i++) {
    ctx.beginPath();
    ctx.arc(moon.x + Math.cos(i*1.3)*8, moon.y + Math.sin(i*1.7)*6, 2.6, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.restore();
}

// Global game instance
const game = new Game();

// UI: Avatar thumbnails rendered into buttons
function renderAvatarThumbnails() {
  const buttons = Array.from(avatarListEl.querySelectorAll('button.avatar'));
  buttons.forEach((btn, idx) => {
    const c = btn.querySelector('canvas');
    const ctx2 = c.getContext('2d');
    ctx2.clearRect(0,0,c.width,c.height);
    // background tile
    const g = ctx2.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, 'rgba(255,255,255,0.06)');
    g.addColorStop(1, 'rgba(0,0,0,0.06)');
    ctx2.fillStyle = g;
    ctx2.fillRect(0,0,c.width,c.height);

    AvatarDrawers[idx](ctx2, c.width/2, c.height/2, 1.0);
  });
}

renderAvatarThumbnails();

// UI interactions
avatarListEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button.avatar');
  if (!btn) return;
  avatarListEl.querySelectorAll('.avatar').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedAvatarIndex = Number(btn.dataset.avatar || 0);
});

levelButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    levelButtons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    currentLevelKey = btn.dataset.level;
    hudLevelEl.textContent = LEVELS[currentLevelKey].label;
    hudHiScoreEl.textContent = `HI ${String(storage.getHighScore(currentLevelKey)).padStart(5,'0')}`;
  });
});

  startBtn.addEventListener('click', () => {
  startScreenEl.style.display = 'none';
  hudLevelEl.textContent = LEVELS[currentLevelKey].label;
  hudHiScoreEl.textContent = `HI ${String(storage.getHighScore(currentLevelKey)).padStart(5,'0')}`;
  resizeCanvas();
  game.reset();
  game.start();
});

// Controls
function handleJumpRequest() { inputState.isJumpQueued = true; } // buffered
function handleDuckDown() { inputState.isDuckHeld = true; }
function handleDuckUp() { inputState.isDuckHeld = false; }

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    handleJumpRequest();
  }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    e.preventDefault();
    handleDuckDown();
  }
  if (e.code === 'KeyP') {
    if (game.running) game.pauseToggle();
  }
  if (e.code === 'KeyR') {
    if (!game.running) game.restart();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    handleDuckUp();
  }
});

// Mouse / Pointer controls on the canvas
canvas.addEventListener('pointerdown', (e) => {
  if (!game.running && !gameOverEl.classList.contains('hidden')) {
    game.restart();
    return;
  }
  if (e.button === 0) {
    handleJumpRequest();
  } else if (e.button === 2) {
    handleDuckDown();
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (e.button === 2) {
    handleDuckUp();
  }
});
canvas.addEventListener('dblclick', (e) => {
  e.preventDefault();
  handleJumpRequest(); // second jump
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

gameContainerEl.addEventListener('click', () => {
  if (!game.running && !gameOverEl.classList.contains('hidden')) {
    game.restart();
  }
});

// Buttons in Game Over overlay
if (homeBtn) {
  homeBtn.addEventListener('click', () => {
    // Return to start screen
    cancelAnimationFrame(animationHandle);
    game.paused = true;
    game.running = false;
    gameOverEl.classList.add('hidden');
    pauseOverlayEl.classList.add('hidden');
    startScreenEl.style.display = 'grid';
    hudHiScoreEl.textContent = `HI ${String(storage.getHighScore(currentLevelKey)).padStart(5,'0')}`;
  });
}
if (restartBtn) {
  restartBtn.addEventListener('click', () => {
    if (!game.running) game.restart();
  });
}

// Visibility pause
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.running) {
    game.pauseToggle();
  }
});

// Expose for console debugging
window.__sdr = { game };