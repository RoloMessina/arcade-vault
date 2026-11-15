'use client';

import { useEffect, useRef } from 'react';

// ── Constantes ────────────────────────────────────────────────
const COLS = 16;
const ROWS = 14;
const CELL = 40; // px
const CANVAS_W = COLS * CELL; // 640 — se escala con CSS al contenedor
const CANVAS_H = ROWS * CELL; // 560

// Zonas (índice de fila, 0 = arriba)
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;

// ── Tipos locales (no exportados) ─────────────────────────────
type Direction = 'up' | 'down' | 'left' | 'right';

interface Entity {
  col: number;
  width: number;
  type: 'car' | 'truck' | 'log' | 'turtle';
  submerged?: boolean;
}

interface Lane {
  row: number;
  speed: number;
  dir: 1 | -1;
  entities: Entity[];
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
}

export interface FroggerGameProps {
  paused: boolean;
  skinKey?: string;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

// ── Carriles ──────────────────────────────────────────────────
// Cada carril es un bucle de LOOP_LEN celdas; las entidades viven en
// [-MAX_W, COLS) y al salirse se reintroducen sumando/restando LOOP_LEN,
// así los huecos entre entidades se conservan siempre.
const MAX_W = 4;
const LOOP_LEN = COLS + MAX_W; // 20
const LEVEL_SPEED_STEP = 0.15; // +15 % por nivel

interface LaneConfig {
  row: number;
  speed: number; // px/frame (nivel 1)
  dir: 1 | -1;
  kind: 'road' | 'log' | 'turtle';
  offset: number; // desfase del patrón dentro del bucle
  pattern: [width: number, gap: number][]; // suma de (width + gap) = LOOP_LEN
}

const LANE_CONFIGS: LaneConfig[] = [
  // Río (filas 1–6): troncos de 2–4, tortugas de 2–3, huecos ≥ 1
  { row: 1, speed: 1.0, dir: 1, kind: 'log', offset: 0, pattern: [[4, 4], [4, 4], [2, 2]] },
  { row: 2, speed: 1.5, dir: -1, kind: 'turtle', offset: 5, pattern: [[3, 3], [2, 3], [3, 3], [2, 1]] },
  { row: 3, speed: 2.0, dir: 1, kind: 'log', offset: 8, pattern: [[4, 3], [3, 3], [2, 5]] },
  { row: 4, speed: 1.2, dir: -1, kind: 'log', offset: 3, pattern: [[4, 5], [4, 3], [2, 2]] },
  { row: 5, speed: 2.5, dir: 1, kind: 'turtle', offset: 11, pattern: [[2, 3], [3, 3], [2, 3], [2, 2]] },
  { row: 6, speed: 3.0, dir: -1, kind: 'log', offset: 6, pattern: [[3, 4], [4, 5], [2, 2]] },
  // Carretera (filas 8–12): coches de 1–2 y camiones de 3
  { row: 8, speed: 1.5, dir: 1, kind: 'road', offset: 2, pattern: [[1, 4], [1, 4], [1, 4], [1, 4]] },
  { row: 9, speed: 2.0, dir: -1, kind: 'road', offset: 7, pattern: [[3, 7], [3, 7]] },
  { row: 10, speed: 2.5, dir: 1, kind: 'road', offset: 4, pattern: [[2, 3], [2, 3], [2, 3], [2, 3]] },
  { row: 11, speed: 3.0, dir: -1, kind: 'road', offset: 9, pattern: [[1, 5], [2, 4], [1, 7]] },
  { row: 12, speed: 4.0, dir: 1, kind: 'road', offset: 1, pattern: [[3, 7], [2, 8]] },
];

function buildLanes(level: number): Lane[] {
  const factor = 1 + LEVEL_SPEED_STEP * (level - 1);
  return LANE_CONFIGS.map((cfg) => {
    const entities: Entity[] = [];
    let pos = 0;
    for (const [width, gap] of cfg.pattern) {
      const col = ((pos + cfg.offset) % LOOP_LEN) - MAX_W;
      const type: Entity['type'] =
        cfg.kind === 'road' ? (width >= 3 ? 'truck' : 'car') : cfg.kind;
      entities.push(
        type === 'turtle'
          ? { col, width, type, submerged: false }
          : { col, width, type },
      );
      pos += width + gap;
    }
    return {
      row: cfg.row,
      // Se guarda en celdas por frame (px/frame ÷ CELL) porque col va en celdas
      speed: (cfg.speed * factor) / CELL,
      dir: cfg.dir,
      entities,
    };
  });
}

// ── Estado del juego ──────────────────────────────────────────
const JUMP_MS = 120;
const TURTLE_VISIBLE_MS = 3000;
const TURTLE_UNDER_MS = 1500;
const TURTLE_CYCLE_MS = TURTLE_VISIBLE_MS + TURTLE_UNDER_MS;
const START_COL = Math.floor(COLS / 2);
// Bocas destino: 5 bocas de 2 columnas en la fila 0
const GOAL_COLS = [1, 4, 7, 10, 13];

const DIRS: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

const KEY_TO_DIR: Record<string, Direction> = {
  arrowup: 'up',
  w: 'up',
  arrowdown: 'down',
  s: 'down',
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right',
};

// 15 s en el nivel 1, -1 s por nivel, mínimo 8 s
function roundTime(level: number): number {
  return Math.max(8000, 15000 - (level - 1) * 1000);
}

interface GameState {
  lanes: Lane[];
  frog: Frog;
  facing: Direction;
  score: number;
  lives: number;
  level: number;
  timeLeft: number; // ms
  clock: number; // ms acumulados (ciclo de las tortugas)
  goals: boolean[]; // bocas ocupadas
  pendingDir: Direction | null;
  maxRow: number; // fila más alta alcanzada en este intento (puntos por avance)
  over: boolean; // sin vidas: el loop se detiene tras avisar a onGameOver
}

function initialFrog(): Frog {
  return {
    col: START_COL,
    row: ROW_START,
    animating: false,
    animT: 0,
    targetCol: START_COL,
    targetRow: ROW_START,
  };
}

function initialState(): GameState {
  return {
    lanes: buildLanes(1),
    frog: initialFrog(),
    facing: 'up',
    score: 0,
    lives: 3,
    level: 1,
    timeLeft: roundTime(1),
    clock: 0,
    goals: GOAL_COLS.map(() => false),
    pendingDir: null,
    maxRow: ROW_START,
    over: false,
  };
}

// Devuelve la rana a la base de inicio con el tiempo de ronda completo
function respawn(s: GameState): void {
  s.frog = initialFrog();
  s.facing = 'up';
  s.pendingDir = null;
  s.timeLeft = roundTime(s.level);
  s.maxRow = ROW_START;
}

// ── Colisiones y soporte (Paso 5) ─────────────────────────────
// Centro horizontal de la rana en coordenadas de celda
function frogCenter(frog: Frog): number {
  return frog.col + 0.5;
}

// Carretera: la rana (hitbox algo más pequeña que la celda) solapa un vehículo
function checkRoadCollision(frog: Frog, lanes: Lane[]): boolean {
  if (frog.row < ROW_ROAD_TOP || frog.row > ROW_ROAD_BOT) return false;
  const lane = lanes.find((l) => l.row === frog.row);
  if (!lane) return false;
  const left = frog.col + 0.15;
  const right = frog.col + 0.85;
  return lane.entities.some(
    (e) => right > e.col && left < e.col + e.width,
  );
}

// Río: tronco o tortuga visible bajo el centro de la rana, o null
function getSupport(frog: Frog, lanes: Lane[]): Entity | null {
  if (frog.row < ROW_RIVER_TOP || frog.row > ROW_RIVER_BOT) return null;
  const lane = lanes.find((l) => l.row === frog.row);
  if (!lane) return null;
  const cx = frogCenter(frog);
  return (
    lane.entities.find(
      (e) =>
        cx >= e.col && cx < e.col + e.width && !(e.type === 'turtle' && e.submerged),
    ) ?? null
  );
}

type GoalResult = 'dead' | 'goal' | 'round';

// Fila de metas: ocupa la boca libre bajo la rana y suma puntos
function checkGoal(s: GameState): GoalResult {
  const cx = Math.round(s.frog.col) + 0.5;
  const i = GOAL_COLS.findIndex((c) => cx >= c && cx < c + 2);
  if (i < 0 || s.goals[i]) return 'dead'; // pared entre bocas o boca ya ocupada
  s.goals[i] = true;
  s.score += 50 + Math.floor(s.timeLeft / 1000) * 10; // boca + bonus de tiempo
  return s.goals.every(Boolean) ? 'round' : 'goal';
}

// Peligros continuos (se comprueban cada frame con la rana en reposo)
function checkHazards(s: GameState): boolean {
  const f = s.frog;
  if (f.animating) return false;
  if (checkRoadCollision(f, s.lanes)) return true;
  if (f.row >= ROW_RIVER_TOP && f.row <= ROW_RIVER_BOT) {
    if (!getSupport(f, s.lanes)) return true; // agua o tortuga sumergida
    if (f.col < -0.5 || f.col > COLS - 0.5) return true; // arrastrada fuera
  }
  return false;
}

// Se llama al completar cada salto: metas y puntos por avance
function resolveLanding(s: GameState): void {
  const f = s.frog;
  if (f.row === ROW_GOALS) {
    const result = checkGoal(s);
    if (result === 'dead') killFrog(s);
    else if (result === 'round') completeRound(s);
    else respawn(s);
    return;
  }
  if (f.row < s.maxRow) {
    s.score += (s.maxRow - f.row) * 10;
    s.maxRow = f.row;
  }
}

// ── Ronda completada (Paso 6) ─────────────────────────────────
// Las 5 bocas llenas: +200, siguiente nivel con carriles más rápidos.
// onLevelChange lo dispara el loop (emitChanges) al detectar el cambio de level.
function completeRound(s: GameState): void {
  s.score += 200;
  s.level += 1;
  s.goals = GOAL_COLS.map(() => false);
  s.lanes = buildLanes(s.level);
  respawn(s); // rana al inicio, temporizador del nuevo nivel
}

// ── Muerte de la rana (Paso 7) ────────────────────────────────
// Resta una vida. Con vidas restantes reaparece; si llega a 0 marca `over`
// y el loop avisa a onLivesChange(0) y luego a onGameOver(score).
function killFrog(s: GameState): void {
  if (s.over) return;
  s.lives -= 1;
  if (s.lives <= 0) {
    s.lives = 0;
    s.over = true;
    s.pendingDir = null;
    return;
  }
  respawn(s);
}

// ── Lógica de actualización ───────────────────────────────────
function updateEntities(s: GameState, dt: number) {
  s.clock += dt;
  s.lanes.forEach((lane, li) => {
    const delta = (lane.speed * lane.dir * dt) / 16;
    lane.entities.forEach((e, ei) => {
      e.col += delta;
      if (lane.dir === 1 && e.col >= COLS) e.col -= LOOP_LEN;
      if (lane.dir === -1 && e.col < -MAX_W) e.col += LOOP_LEN;
      if (e.type === 'turtle') {
        e.submerged =
          (s.clock + li * 700 + ei * 1100) % TURTLE_CYCLE_MS >=
          TURTLE_VISIBLE_MS;
      }
    });
  });
}

function updateFrog(s: GameState, dt: number) {
  const frog = s.frog;

  if (!frog.animating) {
    if (s.pendingDir) {
      const dir = s.pendingDir;
      s.pendingDir = null;
      const [dx, dy] = DIRS[dir];
      const targetCol = Math.round(frog.col) + dx;
      const targetRow = frog.row + dy;
      s.facing = dir;
      // No salir por los bordes laterales ni por arriba/abajo del mapa
      if (
        targetCol >= 0 &&
        targetCol <= COLS - 1 &&
        targetRow >= 0 &&
        targetRow <= ROWS - 1
      ) {
        frog.animating = true;
        frog.animT = 0;
        frog.targetCol = targetCol;
        frog.targetRow = targetRow;
      }
    }
  } else {
    frog.animT += dt;
    if (frog.animT >= JUMP_MS) {
      frog.col = frog.targetCol;
      frog.row = frog.targetRow;
      frog.animating = false;
      frog.animT = 0;
      resolveLanding(s);
    }
  }

  // En el río, la rana viaja con el tronco/tortuga que la soporta
  if (
    !frog.animating &&
    frog.row >= ROW_RIVER_TOP &&
    frog.row <= ROW_RIVER_BOT &&
    getSupport(frog, s.lanes)
  ) {
    const lane = s.lanes.find((l) => l.row === frog.row);
    if (lane) frog.col += (lane.speed * lane.dir * dt) / 16;
  }
}

function update(s: GameState, dt: number) {
  if (s.over) return;
  updateEntities(s, dt);
  updateFrog(s, dt);
  if (checkHazards(s)) killFrog(s);
  s.timeLeft -= dt;
  if (s.timeLeft <= 0) killFrog(s);
}

// ── Dibujo y skins ────────────────────────────────────────────
// La skin solo cambia colores y estilo de trazo; nunca geometría de colisión.
type Skin = {
  road: string;
  goalRow: string;
  river: string;
  safe: string;
  laneLine: string;
  cars: string[];
  wheel: string;
  truckBody: string;
  truckCab: string;
  log: string;
  logGrain: string;
  turtle: string;
  turtleDetail: string;
  turtleSub: string;
  frog: string;
  eyeWhite: string;
  pupil: string;
  goalSlot: string;
  goalBorder: string;
  timeHigh: string;
  timeMid: string;
  timeLow: string;
  text: string;
  life: string;
  glow: number; // shadowBlur de entidades (0 = sin glow)
  outline: boolean; // relleno tenue + trazo fino luminoso
  bevel: boolean; // bisel 8-bit de 2 px
  blocky: boolean; // formas rectangulares en vez de círculos
};

const SKINS: Record<string, Skin> = {
  classic: {
    road: '#14141c',
    goalRow: '#0d2a14',
    river: '#0a2a4a',
    safe: '#1a4a1f',
    laneLine: 'rgba(230,233,255,0.25)',
    cars: ['#ff3b3b', '#f5d000', '#3b8bff', '#ff8a1f'],
    wheel: '#111',
    truckBody: '#8a8f98',
    truckCab: '#c8302c',
    log: '#7a4a1e',
    logGrain: '#4a2a0e',
    turtle: '#2e9e4f',
    turtleDetail: '#1c6e34',
    turtleSub: 'rgba(80,200,120,0.35)',
    frog: '#7dff3a',
    eyeWhite: '#e6e9ff',
    pupil: '#000',
    goalSlot: '#06260f',
    goalBorder: '#ffd24a',
    timeHigh: '#3dff6a',
    timeMid: '#ffd24a',
    timeLow: '#ff3b3b',
    text: '#e6e9ff',
    life: '#7dff3a',
    glow: 0,
    outline: false,
    bevel: false,
    blocky: false,
  },
  neon: {
    road: '#05050a',
    goalRow: '#02100a',
    river: '#041638',
    safe: '#05200f',
    laneLine: 'rgba(0,229,255,0.4)',
    cars: ['#ff2d6f', '#ffe600', '#00e5ff', '#ff8a00'],
    wheel: '#2a2a44',
    truckBody: '#b388ff',
    truckCab: '#ff2d6f',
    log: '#ff9a3c',
    logGrain: 'rgba(255,154,60,0.6)',
    turtle: '#39ff88',
    turtleDetail: 'rgba(57,255,136,0.7)',
    turtleSub: 'rgba(57,255,136,0.35)',
    frog: '#b6ff00',
    eyeWhite: '#e6e9ff',
    pupil: '#05050a',
    goalSlot: '#000',
    goalBorder: '#ffe600',
    timeHigh: '#39ff88',
    timeMid: '#ffe600',
    timeLow: '#ff2d6f',
    text: '#e6e9ff',
    life: '#b6ff00',
    glow: 12,
    outline: true,
    bevel: false,
    blocky: false,
  },
  retro: {
    road: '#1a1446',
    goalRow: '#143d2b',
    river: '#1c3aa0',
    safe: '#2a7a2a',
    laneLine: '#8a86c8',
    cars: ['#e83a3a', '#f8d838', '#38a8f8', '#f88838'],
    wheel: '#0c0820',
    truckBody: '#b8b8d8',
    truckCab: '#e83a3a',
    log: '#a05a20',
    logGrain: '#5c3010',
    turtle: '#38c868',
    turtleDetail: '#146a38',
    turtleSub: 'rgba(56,200,104,0.4)',
    frog: '#a8f838',
    eyeWhite: '#f0f0ff',
    pupil: '#0c0820',
    goalSlot: '#0a1f14',
    goalBorder: '#f8d838',
    timeHigh: '#38e868',
    timeMid: '#f8d838',
    timeLow: '#f83838',
    text: '#f0f0ff',
    life: '#a8f838',
    glow: 0,
    outline: false,
    bevel: true,
    blocky: true,
  },
};

// Rectángulo de entidad según el estilo de la skin (plano, bisel o contorno neón)
function fillShape(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (skin.outline) {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = skin.glow;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.shadowBlur = 0;
    return;
  }
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  if (skin.bevel) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(x, y, w, 2);
    ctx.fillRect(x, y, 2, h);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x, y + h - 2, w, 2);
    ctx.fillRect(x + w - 2, y, 2, h);
  }
}

// Rueda: círculo (classic/neon) o cuadrado (retro)
function drawWheel(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  cx: number,
  cy: number,
) {
  ctx.fillStyle = skin.wheel;
  if (skin.blocky) {
    ctx.fillRect(cx - 4, cy - 4, 8, 8);
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, skin: Skin) {
  for (let r = 0; r < ROWS; r++) {
    let color = skin.road;
    if (r === ROW_GOALS) color = skin.goalRow;
    else if (r >= ROW_RIVER_TOP && r <= ROW_RIVER_BOT) color = skin.river;
    else if (r === ROW_SAFE_MID || r === ROW_START) color = skin.safe;
    ctx.fillStyle = color;
    ctx.fillRect(0, r * CELL, CANVAS_W, CELL);
  }
  // Líneas discontinuas entre carriles de carretera
  ctx.strokeStyle = skin.laneLine;
  ctx.lineWidth = 2;
  ctx.setLineDash(skin.blocky ? [16, 16] : [16, 14]);
  for (let r = ROW_ROAD_TOP + 1; r <= ROW_ROAD_BOT; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(CANVAS_W, r * CELL);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawEntity(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  e: Entity,
  row: number,
  dir: 1 | -1,
  idx: number,
) {
  const x = e.col * CELL;
  const y = row * CELL;
  const w = e.width * CELL;

  if (e.type === 'car') {
    fillShape(ctx, skin, skin.cars[idx % skin.cars.length], x + 3, y + 8, w - 6, CELL - 16);
    drawWheel(ctx, skin, x + 11, y + CELL - 8);
    drawWheel(ctx, skin, x + w - 11, y + CELL - 8);
    drawWheel(ctx, skin, x + 11, y + 8);
    drawWheel(ctx, skin, x + w - 11, y + 8);
  } else if (e.type === 'truck') {
    fillShape(ctx, skin, skin.truckBody, x + 3, y + 6, w - 6, CELL - 12);
    // Cabina en el extremo hacia el que avanza
    const cabX = dir === 1 ? x + w - CELL + 3 : x + 3;
    fillShape(ctx, skin, skin.truckCab, cabX, y + 6, CELL - 6, CELL - 12);
    for (let k = 0; k < e.width; k++) {
      drawWheel(ctx, skin, x + k * CELL + 20, y + CELL - 6);
    }
  } else if (e.type === 'log') {
    fillShape(ctx, skin, skin.log, x + 2, y + 6, w - 4, CELL - 12);
    ctx.strokeStyle = skin.logGrain;
    ctx.lineWidth = 2;
    for (let k = 1; k < e.width * 2; k++) {
      ctx.beginPath();
      ctx.moveTo(x + k * (CELL / 2), y + 10);
      ctx.lineTo(x + k * (CELL / 2), y + CELL - 10);
      ctx.stroke();
    }
  } else {
    for (let k = 0; k < e.width; k++) {
      const cx = x + k * CELL + CELL / 2;
      const cy = y + CELL / 2;
      if (skin.blocky) {
        if (e.submerged) {
          ctx.strokeStyle = skin.turtleSub;
          ctx.lineWidth = 2;
          ctx.strokeRect(cx - 14, cy - 14, 28, 28);
        } else {
          fillShape(ctx, skin, skin.turtle, cx - 15, cy - 15, 30, 30);
          ctx.fillStyle = skin.turtleDetail;
          ctx.fillRect(cx - 8, cy - 8, 16, 16);
        }
        continue;
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 15, 0, Math.PI * 2);
      if (e.submerged) {
        ctx.strokeStyle = skin.turtleSub;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        if (skin.outline) {
          ctx.globalAlpha = 0.22;
          ctx.fillStyle = skin.turtle;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = skin.turtle;
          ctx.lineWidth = 1.5;
          ctx.shadowColor = skin.turtle;
          ctx.shadowBlur = skin.glow;
          ctx.stroke();
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = skin.turtle;
          ctx.fill();
        }
        ctx.strokeStyle = skin.turtleDetail;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.moveTo(cx - 9, cy);
        ctx.lineTo(cx + 9, cy);
        ctx.moveTo(cx, cy - 9);
        ctx.lineTo(cx, cy + 9);
        ctx.stroke();
      }
    }
  }
}

function drawFrogShape(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  cx: number,
  cy: number,
  scale: number,
  angle: number,
  legs: boolean,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.fillStyle = skin.frog;
  ctx.shadowColor = skin.frog;
  ctx.shadowBlur = skin.glow;
  if (legs) {
    ctx.fillRect(-16, -12, 6, 8);
    ctx.fillRect(10, -12, 6, 8);
    ctx.fillRect(-16, 6, 6, 8);
    ctx.fillRect(10, 6, 6, 8);
  }
  if (skin.blocky) {
    ctx.fillRect(-13, -11, 26, 22);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-13, 9, 26, 2);
    ctx.fillRect(11, -11, 2, 22);
    ctx.fillStyle = skin.eyeWhite;
    ctx.fillRect(-10, -12, 7, 7);
    ctx.fillRect(3, -12, 7, 7);
    ctx.fillStyle = skin.pupil;
    ctx.fillRect(-8, -12, 3, 3);
    ctx.fillRect(5, -12, 3, 3);
  } else {
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Ojos (hacia delante = arriba)
    ctx.fillStyle = skin.eyeWhite;
    ctx.beginPath();
    ctx.arc(-6, -8, 4, 0, Math.PI * 2);
    ctx.arc(6, -8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.pupil;
    ctx.beginPath();
    ctx.arc(-6, -9, 1.8, 0, Math.PI * 2);
    ctx.arc(6, -9, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const FACING_ANGLE: Record<Direction, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};

function drawGoals(ctx: CanvasRenderingContext2D, skin: Skin, goals: boolean[]) {
  GOAL_COLS.forEach((c, i) => {
    const x = c * CELL;
    ctx.fillStyle = skin.goalSlot;
    ctx.fillRect(x, 18, 2 * CELL, CELL - 18);
    ctx.strokeStyle = skin.goalBorder;
    ctx.lineWidth = skin.blocky ? 3 : 2;
    ctx.shadowColor = skin.goalBorder;
    ctx.shadowBlur = skin.glow;
    ctx.strokeRect(x + 1, 19, 2 * CELL - 2, CELL - 20);
    ctx.shadowBlur = 0;
    if (goals[i]) drawFrogShape(ctx, skin, x + CELL, 29, 0.6, 0, false);
  });
}

function drawHud(ctx: CanvasRenderingContext2D, skin: Skin, s: GameState) {
  // Barra de tiempo (fila 0): verde → amarillo → rojo
  const ratio = Math.max(0, s.timeLeft / roundTime(s.level));
  const barColor =
    ratio > 0.5 ? skin.timeHigh : ratio > 0.25 ? skin.timeMid : skin.timeLow;
  ctx.fillStyle = barColor;
  ctx.shadowColor = barColor;
  ctx.shadowBlur = skin.glow;
  ctx.fillRect(0, 0, CANVAS_W * ratio, 4);
  ctx.shadowBlur = 0;

  ctx.fillStyle = skin.text;
  ctx.shadowColor = skin.text;
  ctx.shadowBlur = skin.glow ? 6 : 0;
  ctx.font = 'bold 12px monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${String(s.score).padStart(6, '0')}`, 8, 15);
  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${s.level}`, CANVAS_W / 2, 15);
  ctx.shadowBlur = 0;

  ctx.fillStyle = skin.life;
  ctx.shadowColor = skin.life;
  ctx.shadowBlur = skin.glow ? 6 : 0;
  for (let k = 0; k < s.lives; k++) {
    const lx = CANVAS_W - 14 - k * 16;
    if (skin.blocky) {
      ctx.fillRect(lx - 5, 5, 10, 10);
    } else {
      ctx.beginPath();
      ctx.arc(lx, 10, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.shadowBlur = 0;
}

function draw(ctx: CanvasRenderingContext2D, s: GameState, skin: Skin) {
  drawBackground(ctx, skin);
  drawGoals(ctx, skin, s.goals);
  s.lanes.forEach((lane) =>
    lane.entities.forEach((e, i) =>
      drawEntity(ctx, skin, e, lane.row, lane.dir, i),
    ),
  );

  const f = s.frog;
  let fx = f.col;
  let fy = f.row;
  let scale = 1;
  if (f.animating) {
    const t = Math.min(1, f.animT / JUMP_MS);
    fx = f.col + (f.targetCol - f.col) * t;
    fy = f.row + (f.targetRow - f.row) * t;
    scale = 1 + 0.25 * Math.sin(Math.PI * t);
  }
  drawFrogShape(
    ctx,
    skin,
    fx * CELL + CELL / 2,
    fy * CELL + CELL / 2,
    scale,
    FACING_ANGLE[s.facing],
    f.animating,
  );

  drawHud(ctx, skin, s);
}

// ── Componente ────────────────────────────────────────────────
export default function FroggerGame({
  paused,
  skinKey = 'classic',
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
}: FroggerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const skinRef = useRef<Skin>(SKINS[skinKey] ?? SKINS.classic);
  const stateRef = useRef<GameState>(initialState());
  const prevScoreRef = useRef(0);
  const prevLivesRef = useRef(3);
  const prevLevelRef = useRef(1);
  const cbRef = useRef({ onScoreChange, onLivesChange, onLevelChange, onGameOver });

  // Mantener refs al día sin remontar el loop
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  // Cambiar de skin no reinicia la partida ni el loop: draw() lee skinRef
  useEffect(() => {
    skinRef.current = SKINS[skinKey] ?? SKINS.classic;
  }, [skinKey]);
  useEffect(() => {
    cbRef.current = { onScoreChange, onLivesChange, onLevelChange, onGameOver };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let raf = 0;
    let last = performance.now();

    function emitChanges() {
      const s = stateRef.current;
      const cb = cbRef.current;
      if (s.score !== prevScoreRef.current) {
        prevScoreRef.current = s.score;
        cb.onScoreChange(s.score);
      }
      if (s.level !== prevLevelRef.current) {
        prevLevelRef.current = s.level;
        cb.onLevelChange(s.level);
      }
      if (s.lives !== prevLivesRef.current) {
        prevLivesRef.current = s.lives;
        cb.onLivesChange(s.lives);
      }
    }

    function frame(now: number) {
      const dt = Math.min(now - last, 50); // evita saltos tras pausas/pestañas
      last = now;
      if (!pausedRef.current) update(stateRef.current, dt);
      emitChanges(); // incluye onLivesChange(0) si se acabaron las vidas
      draw(ctx!, stateRef.current, skinRef.current);
      if (stateRef.current.over) {
        // Fin de partida: último frame dibujado, se detiene el loop
        cbRef.current.onGameOver(stateRef.current.score);
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    function handleKey(e: KeyboardEvent) {
      const dir = KEY_TO_DIR[e.key.toLowerCase()];
      if (!dir) return;
      e.preventDefault();
      if (pausedRef.current) return;
      stateRef.current.pendingDir = dir;
    }

    document.addEventListener('keydown', handleKey);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
      }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="frogger-canvas"
        style={{
          display: 'block',
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}
