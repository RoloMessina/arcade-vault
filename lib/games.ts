export type Game = {
  id: string;
  titulo: string;
  categoria: string;
  corta: string;
  larga: string;
  accent: string;
  accent2: string;
  sprite: string[];
  /** Archivo HTML del juego dentro de /public/games */
  archivo: string;
  vidas: number;
  recordBase: number;
};

export type ScoreEntry = {
  gameId: string;
  name: string;
  score: number;
  date: string; // ISO yyyy-mm-dd
};

const C = "#00f5ff";
const M = "#ff006e";
const Y = "#f5ff00";

export const GAMES: Game[] = [
  {
    id: "arkanoid",
    titulo: "Arkanoid",
    categoria: "Clásico",
    corta: "Rompe todos los ladrillos con la pelota.",
    larga:
      "Mueve la paleta, mantén la pelota en juego y destruye cada ladrillo del muro. Recoge potenciadores, esquiva los fallos y supera niveles cada vez más caóticos.",
    accent: C,
    accent2: M,
    sprite: [
      "########",
      "########",
      "........",
      "....#...",
      "........",
      "........",
      "..####..",
      "........",
    ],
    archivo: "demo.html",
    vidas: 3,
    recordBase: 48200,
  },
  {
    id: "tetris",
    titulo: "Tetris",
    categoria: "Puzle",
    corta: "Encaja las piezas y limpia líneas.",
    larga:
      "Las piezas caen cada vez más rápido. Gíralas, encájalas y completa líneas para que desaparezcan. Un solo hueco mal puesto y la pila crece sin piedad.",
    accent: M,
    accent2: C,
    sprite: [
      "##......",
      "##..#...",
      "....###.",
      ".#......",
      ".#..##..",
      ".###.##.",
      "........",
      "........",
    ],
    archivo: "demo.html",
    vidas: 1,
    recordBase: 126500,
  },
  {
    id: "snake",
    titulo: "Snake",
    categoria: "Clásico",
    corta: "Come, crece y no te muerdas la cola.",
    larga:
      "La serpiente crece con cada manzana que devora. Controla la dirección con las flechas, evita las paredes y no choques contigo misma. Cada nivel acelera el ritmo.",
    accent: Y,
    accent2: C,
    sprite: [
      "........",
      ".####...",
      ".#......",
      ".#.###..",
      ".#...#..",
      ".#####.#",
      "......##",
      "........",
    ],
    archivo: "snake.html",
    vidas: 3,
    recordBase: 3400,
  },
  {
    id: "pacman",
    titulo: "Pac-Man",
    categoria: "Arcade",
    corta: "Devora puntos y huye de los fantasmas.",
    larga:
      "Recorre el laberinto comiendo todos los puntos mientras cuatro fantasmas te persiguen. Las píldoras de poder invierten los papeles por unos segundos.",
    accent: Y,
    accent2: M,
    sprite: [
      "..####..",
      ".######.",
      "####....",
      "###.....",
      "####....",
      ".######.",
      "..####..",
      "........",
    ],
    archivo: "demo.html",
    vidas: 3,
    recordBase: 21400,
  },
  {
    id: "invaders",
    titulo: "Space Invaders",
    categoria: "Disparos",
    corta: "Defiende la Tierra de la invasión alienígena.",
    larga:
      "Oleadas de invasores descienden en formación. Dispara desde tu cañón, ocúltate tras los escudos y detén la invasión antes de que toque el suelo.",
    accent: C,
    accent2: Y,
    sprite: [
      "..#.....#..",
      "...#...#...",
      "..#######..",
      ".##.###.##.",
      "###########",
      "#.#######.#",
      "#.#.....#.#",
      "...##.##...",
    ],
    archivo: "demo.html",
    vidas: 3,
    recordBase: 15900,
  },
  {
    id: "asteroids",
    titulo: "Asteroids",
    categoria: "Disparos",
    corta: "Sobrevive en el espacio y pulveriza rocas.",
    larga:
      "Pilota tu nave en un campo de asteroides. Dispara para fragmentarlos, usa el hiperespacio como último recurso y no dejes que ninguna roca te alcance.",
    accent: M,
    accent2: Y,
    sprite: [
      "...##...",
      "...##...",
      "..####..",
      "..####..",
      ".######.",
      ".##..##.",
      "##....##",
      "........",
    ],
    archivo: "demo.html",
    vidas: 3,
    recordBase: 9800,
  },
];

export const CATEGORIAS = ["Todos", ...Array.from(new Set(GAMES.map((g) => g.categoria)))];

export function getGame(id: string) {
  return GAMES.find((g) => g.id === id);
}

const NOMBRES = [
  "NEO_RIDER",
  "LUNA88",
  "PIXELFOX",
  "KAIJU",
  "DR_BYTE",
  "TURBO_T",
  "ROSA_V",
  "MAXPOWER",
  "CHIPA",
  "ZXCVBN",
];

/** Puntuaciones de ejemplo. Un backend real (REST / Supabase) las reemplazaría. */
export function seedScores(game: Game): ScoreEntry[] {
  return NOMBRES.map((name, i) => ({
    gameId: game.id,
    name,
    score: Math.round((game.recordBase * (1 - i * 0.085 - ((i * 7 + game.id.length) % 5) * 0.012)) / 10) * 10,
    date: `2026-10-${String(28 - i * 2).padStart(2, "0")}`,
  }));
}

export function buildBoard(game: Game, saved: ScoreEntry[], limit = 10): ScoreEntry[] {
  return [...seedScores(game), ...saved.filter((s) => s.gameId === game.id)]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function fmtScore(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
