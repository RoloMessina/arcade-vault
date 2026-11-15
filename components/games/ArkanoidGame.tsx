'use client';

import { useEffect, useRef } from 'react';

interface ArkanoidGameProps {
  paused: boolean;
  skinKey?: string;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

// ── Spritesheet data ──────────────────────────────────────────────────────────

const EXPLOSION_FRAMES: Record<
  string,
  { sx: number; sy: number; sw: number; sh: number }[]
> = {
  red: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
  cyan: [
    { sx: 256, sy: 192, sw: 32, sh: 16 },
    { sx: 288, sy: 192, sw: 32, sh: 16 },
    { sx: 320, sy: 192, sw: 32, sh: 16 },
    { sx: 352, sy: 192, sw: 32, sh: 16 },
  ],
  green: [
    { sx: 256, sy: 208, sw: 32, sh: 16 },
    { sx: 288, sy: 208, sw: 32, sh: 16 },
    { sx: 320, sy: 208, sw: 32, sh: 16 },
    { sx: 352, sy: 208, sw: 32, sh: 16 },
  ],
  magenta: [
    { sx: 256, sy: 224, sw: 32, sh: 16 },
    { sx: 288, sy: 224, sw: 32, sh: 16 },
    { sx: 320, sy: 224, sw: 32, sh: 16 },
    { sx: 352, sy: 224, sw: 32, sh: 16 },
  ],
  yellow: [
    { sx: 256, sy: 240, sw: 32, sh: 16 },
    { sx: 288, sy: 240, sw: 32, sh: 16 },
    { sx: 320, sy: 240, sw: 32, sh: 16 },
    { sx: 352, sy: 240, sw: 32, sh: 16 },
  ],
  hotpink: [
    { sx: 256, sy: 256, sw: 32, sh: 16 },
    { sx: 288, sy: 256, sw: 32, sh: 16 },
    { sx: 320, sy: 256, sw: 32, sh: 16 },
    { sx: 352, sy: 256, sw: 32, sh: 16 },
  ],
  gray: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
};

const EXPLOSION_DURATION = 150;

const SPRITES: Record<
  string,
  { sx: number; sy: number; sw: number; sh: number }
> = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
};

const BLOCK_SPRITES: Record<
  string,
  { sx: number; sy: number; sw: number; sh: number }
> = {
  gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
  red: { sx: 32, sy: 176, sw: 32, sh: 16 },
  yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
  cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
  magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
  hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
  green: { sx: 32, sy: 208, sw: 32, sh: 16 },
};

// ── Level data ────────────────────────────────────────────────────────────────

type BlockDef = { col: number; row: number; color: string };
type Level = { speed: number; blocks: BlockDef[] };

const LEVELS: Level[] = (() => {
  const rowColors1 = ['red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green'];
  const rowColors2 = ['gray', 'cyan', 'hotpink', 'yellow', 'magenta', 'green'];
  const rowColors4 = ['cyan', 'magenta', 'green', 'yellow', 'hotpink', 'red'];

  const l1: BlockDef[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      l1.push({ col, row, color: rowColors1[row] });

  const l2: BlockDef[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < 6; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: BlockDef[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if ((col + row) % 2 === 0)
        l3.push({ col, row, color: row < 3 ? 'yellow' : 'magenta' });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: BlockDef[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if (!gaps4[row].includes(col))
        l4.push({ col, row, color: rowColors4[row] });

  const l5: BlockDef[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({ col, row, color: isCross && !isFrame ? 'hotpink' : 'cyan' });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();

// ── Skins ─────────────────────────────────────────────────────────────────────

type Skin = {
  mode: 'sprite' | 'neon' | 'retro';
  bg: string;
  frame: string;
  text: string;
  paddle: string;
  ball: string;
  blocks: Record<string, string>;
};

const SKINS: Record<string, Skin> = {
  // Reproduce el aspecto original (spritesheet) sobre fondo azul muy oscuro
  classic: {
    mode: 'sprite',
    bg: '#0b0e1a',
    frame: '#2a3050',
    text: '#e6e9ff',
    paddle: '#e6e9ff',
    ball: '#e6e9ff',
    blocks: {},
  },
  neon: {
    mode: 'neon',
    bg: '#03030a',
    frame: '#00f0ff',
    text: '#e0faff',
    paddle: '#00f0ff',
    ball: '#ffffaa',
    blocks: {
      red: '#ff2a55',
      yellow: '#fff200',
      cyan: '#00f0ff',
      magenta: '#d400ff',
      hotpink: '#ff3df0',
      green: '#39ff14',
      gray: '#a0a8d0',
    },
  },
  retro: {
    mode: 'retro',
    bg: '#14123a',
    frame: '#5b54c8',
    text: '#f4e8a8',
    paddle: '#f4e8a8',
    ball: '#ffffff',
    blocks: {
      red: '#e8423c',
      yellow: '#f0c030',
      cyan: '#3cc0d8',
      magenta: '#a040c8',
      hotpink: '#e86aa8',
      green: '#48b848',
      gray: '#9890b0',
    },
  },
};

// ── Game constants ─────────────────────────────────────────────────────────────

const W = 800;
const H = 600;
const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;

// ── Types ──────────────────────────────────────────────────────────────────────

type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alive: boolean;
};
type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  elapsed: number;
};

export default function ArkanoidGame({
  paused,
  skinKey = 'classic',
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
}: ArkanoidGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const skinRef = useRef<Skin>(SKINS[skinKey] ?? SKINS.classic);

  useEffect(() => {
    skinRef.current = SKINS[skinKey] ?? SKINS.classic;
  }, [skinKey]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // ── Spritesheet ──────────────────────────────────────────────────────────
    let ssImg: HTMLCanvasElement | null = null;
    let ssLoaded = false;

    function drawFrame(
      frame: { sx: number; sy: number; sw: number; sh: number },
      x: number,
      y: number,
      w: number,
      h: number,
    ) {
      if (!ssLoaded || !ssImg) return;
      ctx.drawImage(ssImg, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
    }

    function drawSprite(
      name: string,
      x: number,
      y: number,
      w: number,
      h: number,
    ) {
      if (!ssLoaded || !ssImg) return;
      const sp = name.startsWith('block_')
        ? BLOCK_SPRITES[name.slice(6)]
        : SPRITES[name];
      if (!sp) return;
      ctx.drawImage(ssImg, sp.sx, sp.sy, sp.sw, sp.sh, x, y, w, h);
    }

    // ── Game state ───────────────────────────────────────────────────────────
    const paddle = { x: 0, y: 560, w: 81, h: 14 };
    const ball = {
      x: 0,
      y: 0,
      w: 16,
      h: 16,
      vx: BASE_BALL_VX,
      vy: BASE_BALL_VY,
    };

    let blocks: Block[] = [];
    let explosions: Explosion[] = [];
    let lives = 3;
    let score = 0;
    let gameState: 'playing' | 'gameover' | 'win' = 'playing';
    let currentLevel = 1;

    // Reported-value trackers so callbacks only fire on change
    let reportedScore = 0;
    let reportedLives = 3;
    let reportedLevel = 1;
    let gameOverFired = false;

    const keys: Record<string, boolean> = {
      ArrowLeft: false,
      ArrowRight: false,
    };

    // ── Audio ────────────────────────────────────────────────────────────────
    const bounceSound = new Audio('/ball-bounce.mp3');
    const breakSound = new Audio('/break-sound.mp3');

    function playBounce() {
      try {
        (bounceSound.cloneNode() as HTMLAudioElement).play().catch(() => {});
      } catch {}
    }
    function playBreak() {
      try {
        (breakSound.cloneNode() as HTMLAudioElement).play().catch(() => {});
      } catch {}
    }

    // ── Init helpers ─────────────────────────────────────────────────────────
    function initPaddle() {
      paddle.x = (W - paddle.w) / 2;
    }

    function initBall() {
      const speed = LEVELS[currentLevel - 1].speed;
      ball.x = paddle.x + (paddle.w - ball.w) / 2;
      ball.y = paddle.y - ball.h;
      ball.vx = BASE_BALL_VX * speed;
      ball.vy = BASE_BALL_VY * speed;
    }

    function loadLevel(n: number) {
      currentLevel = n;
      const level = LEVELS[n - 1];
      blocks = level.blocks.map((b) => ({
        x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
        y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
        w: BLOCK_W,
        h: BLOCK_H,
        color: b.color,
        alive: true,
      }));
      explosions = [];
      ball.x = paddle.x + (paddle.w - ball.w) / 2;
      ball.y = paddle.y - ball.h;
      ball.vx = BASE_BALL_VX * level.speed;
      ball.vy = BASE_BALL_VY * level.speed;
    }

    // ── Collision ────────────────────────────────────────────────────────────
    function collideAABB(block: Block) {
      return (
        ball.x < block.x + block.w &&
        ball.x + ball.w > block.x &&
        ball.y < block.y + block.h &&
        ball.y + ball.h > block.y
      );
    }

    // ── Update ───────────────────────────────────────────────────────────────
    function update(dt: number) {
      if (gameState !== 'playing') return;

      if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
      if (keys.ArrowRight)
        paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x <= 0) {
        ball.x = 0;
        ball.vx = Math.abs(ball.vx);
        playBounce();
      }
      if (ball.x + ball.w >= W) {
        ball.x = W - ball.w;
        ball.vx = -Math.abs(ball.vx);
        playBounce();
      }
      if (ball.y <= 0) {
        ball.y = 0;
        ball.vy = Math.abs(ball.vy);
        playBounce();
      }

      if (
        ball.vy > 0 &&
        ball.x + ball.w > paddle.x &&
        ball.x < paddle.x + paddle.w &&
        ball.y + ball.h >= paddle.y &&
        ball.y + ball.h <= paddle.y + paddle.h + 8
      ) {
        ball.y = paddle.y - ball.h;
        ball.vy = -Math.abs(ball.vy);
        playBounce();
      }

      for (const block of blocks) {
        if (!block.alive) continue;
        if (collideAABB(block)) {
          block.alive = false;
          explosions.push({
            x: block.x,
            y: block.y,
            w: block.w,
            h: block.h,
            color: block.color,
            elapsed: 0,
          });
          score += 10;
          ball.vy = -ball.vy;
          playBreak();
          if (blocks.every((b) => !b.alive)) {
            if (currentLevel < 5) loadLevel(currentLevel + 1);
            else gameState = 'win';
          }
          break;
        }
      }

      for (const exp of explosions) exp.elapsed += dt * 1000;
      explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

      if (ball.y > H) {
        lives--;
        if (lives <= 0) {
          lives = 0;
          gameState = 'gameover';
        } else {
          initBall();
        }
      }

      // ── Notify React ───────────────────────────────────────────────────────
      if (score !== reportedScore) {
        reportedScore = score;
        onScoreChange(score);
      }
      if (lives !== reportedLives) {
        reportedLives = lives;
        onLivesChange(lives);
      }
      if (currentLevel !== reportedLevel) {
        reportedLevel = currentLevel;
        onLevelChange(currentLevel);
      }

      if (!gameOverFired && (gameState === 'gameover' || gameState === 'win')) {
        gameOverFired = true;
        onLivesChange(0);
        onGameOver(score);
      }
    }

    // ── Draw ─────────────────────────────────────────────────────────────────
    function bevelRect(
      x: number,
      y: number,
      w: number,
      h: number,
      color: string,
    ) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(x, y, w, 2);
      ctx.fillRect(x, y, 2, h);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x, y + h - 2, w, 2);
      ctx.fillRect(x + w - 2, y, 2, h);
      ctx.strokeStyle = '#0a0820';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }

    function glowRect(
      x: number,
      y: number,
      w: number,
      h: number,
      color: string,
      blur: number,
    ) {
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = color;
      ctx.fillRect(x + 1.5, y + 1.5, w - 3, h - 3);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    function draw() {
      const skin = skinRef.current;
      const sprite = skin.mode === 'sprite';
      const neon = skin.mode === 'neon';
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.fillStyle = skin.bg;
      ctx.fillRect(0, 0, W, H);

      // Borde del tablero (para que el canvas no desaparezca en la página oscura)
      ctx.strokeStyle = skin.frame;
      ctx.lineWidth = neon ? 2 : 3;
      if (neon) {
        ctx.shadowColor = skin.frame;
        ctx.shadowBlur = 10;
      }
      ctx.strokeRect(1, 1, W - 2, H - 2);
      ctx.shadowBlur = 0;

      for (const block of blocks) {
        if (!block.alive) continue;
        if (sprite) {
          drawSprite(
            'block_' + block.color,
            block.x,
            block.y,
            block.w,
            block.h,
          );
        } else {
          const c = skin.blocks[block.color] ?? '#ffffff';
          if (neon) glowRect(block.x, block.y, block.w, block.h, c, 10);
          else bevelRect(block.x, block.y, block.w, block.h, c);
        }
      }

      for (const exp of explosions) {
        const t = exp.elapsed / EXPLOSION_DURATION;
        if (sprite) {
          const frameIndex = Math.min(Math.floor(t * 4), 3);
          drawFrame(
            EXPLOSION_FRAMES[exp.color][frameIndex],
            exp.x,
            exp.y,
            exp.w,
            exp.h,
          );
        } else {
          const c = skin.blocks[exp.color] ?? '#ffffff';
          ctx.globalAlpha = Math.max(0, 1 - t);
          if (neon) {
            ctx.shadowColor = c;
            ctx.shadowBlur = 16;
            ctx.fillStyle = c;
            ctx.fillRect(exp.x, exp.y, exp.w, exp.h);
            ctx.shadowBlur = 0;
          } else {
            // Parpadeo 8-bit por pasos
            ctx.fillStyle = Math.floor(t * 4) % 2 === 0 ? '#ffffff' : c;
            ctx.fillRect(exp.x + 4, exp.y + 4, exp.w - 8, exp.h - 8);
          }
          ctx.globalAlpha = 1;
        }
      }

      if (sprite) {
        drawSprite('paddle', paddle.x, paddle.y, paddle.w, paddle.h);
        drawSprite('ball', ball.x, ball.y, ball.w, ball.h);
      } else if (neon) {
        glowRect(paddle.x, paddle.y - 1, paddle.w, paddle.h + 2, skin.paddle, 14);
        ctx.shadowColor = skin.ball;
        ctx.shadowBlur = 14;
        ctx.fillStyle = skin.ball;
        ctx.beginPath();
        ctx.arc(
          ball.x + ball.w / 2,
          ball.y + ball.h / 2,
          ball.w / 2 - 2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        bevelRect(paddle.x, paddle.y, paddle.w, paddle.h, skin.paddle);
        bevelRect(
          Math.round(ball.x) + 2,
          Math.round(ball.y) + 2,
          ball.w - 4,
          ball.h - 4,
          skin.ball,
        );
      }

      // Internal HUD (score top-left, level top-center, lives top-right)
      ctx.fillStyle = skin.text;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      if (neon) {
        ctx.shadowColor = skin.frame;
        ctx.shadowBlur = 8;
      }
      ctx.fillText('Score: ' + score, 12, 12);
      ctx.textAlign = 'center';
      ctx.fillText('Nivel: ' + currentLevel, W / 2, 12);
      ctx.shadowBlur = 0;
      const ballSize = 16;
      const ballSpacing = 4;
      for (let i = 0; i < lives; i++) {
        const bx = W - 12 - (lives - i) * (ballSize + ballSpacing);
        if (sprite) drawSprite('ball', bx, 12, ballSize, ballSize);
        else if (neon) {
          ctx.shadowColor = skin.ball;
          ctx.shadowBlur = 8;
          ctx.fillStyle = skin.ball;
          ctx.beginPath();
          ctx.arc(bx + 8, 20, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else bevelRect(bx + 2, 14, 12, 12, skin.ball);
      }
    }

    // ── Loop ─────────────────────────────────────────────────────────────────
    let rafId: number;
    let lastTime: number | null = null;

    function loop(timestamp: number) {
      if (lastTime === null) lastTime = timestamp;
      const dt = (timestamp - lastTime) / 1000;
      lastTime = timestamp;

      if (!pausedRef.current) update(dt);
      draw();

      rafId = requestAnimationFrame(loop);
    }

    // ── Event handlers ────────────────────────────────────────────────────────
    function onKeyDown(e: KeyboardEvent) {
      if (e.key in keys) keys[e.key] = true;
      // P / Escape intentionally NOT handled — platform controls pause
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key in keys) keys[e.key] = false;
    }
    function onMouseMove(e: MouseEvent) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const mouseX = (e.clientX - rect.left) * scaleX;
      paddle.x = Math.max(0, Math.min(W - paddle.w, mouseX - paddle.w / 2));
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousemove', onMouseMove);

    // ── Start ─────────────────────────────────────────────────────────────────
    // Guard against React Strict Mode double-mount: if the effect is cleaned up
    // before the async image load completes, do not start the loop.
    let cleaned = false;

    const rawImg = new Image();
    rawImg.onload = () => {
      if (cleaned) return;
      const oc = document.createElement('canvas');
      oc.width = rawImg.width;
      oc.height = rawImg.height;
      oc.getContext('2d')!.drawImage(rawImg, 0, 0);
      ssImg = oc;
      ssLoaded = true;
      initPaddle();
      loadLevel(1);
      rafId = requestAnimationFrame(loop);
    };
    rawImg.onerror = () => console.error('Failed to load spritesheet');
    rawImg.src = '/spritesheet-breakout.png';

    return () => {
      cleaned = true;
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousemove', onMouseMove);
    };
  }, [onScoreChange, onLivesChange, onLevelChange, onGameOver]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
