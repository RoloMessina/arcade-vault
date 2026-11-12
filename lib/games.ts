export type Game = {
  id: string;
  titulo: string;
  categoria: string;
  corta: string;
  larga: string;
  accent: string;
  accent2: string;
  /** Clase CSS de la portada de la biblioteca (ver globals.css) */
  portada: string;
  sprite: string[];
  /** Archivo HTML del juego dentro de /public/games */
  archivo: string;
  vidas: number;
  /** Refleja `games.record_base` en Supabase (base del tope `score_max`); la UI ya no lo usa. */
  recordBase: number;
  /** Partidas jugadas, en texto abreviado (p. ej. "12.4K") */
  partidas: string;
  /** Estrellas llenas sobre 5 */
  dificultad: 1 | 2 | 3 | 4 | 5;
};

const C = "#00f5ff";
const M = "#ff006e";
const Y = "#f5ff00";
const G = "#00ff88";

export const GAMES: Game[] = [
  {
    id: "bloque-buster",
    portada: "cover-bricks",
    titulo: "Bloque Buster",
    categoria: "Arcade",
    corta: "Rebota la pelota y destruye muros de neón.",
    larga:
      "Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?",
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
    recordBase: 28450,
    partidas: "12.4K",
    dificultad: 3,
  },
  {
    id: "caida",
    portada: "cover-tetro",
    titulo: "Caída",
    categoria: "Puzzle",
    corta: "Encaja las piezas antes de que el techo te aplaste.",
    larga:
      "Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.",
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
    archivo: "tetris.html",
    vidas: 1,
    recordBase: 184220,
    partidas: "31.8K",
    dificultad: 3,
  },
  {
    id: "serpentina",
    portada: "cover-snake",
    titulo: "Serpentina",
    categoria: "Arcade",
    corta: "Crece sin morder tu propia cola.",
    larga:
      "Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.",
    accent: G,
    accent2: M,
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
    recordBase: 7820,
    partidas: "9.1K",
    dificultad: 3,
  },
  {
    id: "gloton",
    portada: "cover-glot",
    titulo: "Glotón",
    categoria: "Arcade",
    corta: "Devora puntos y escapa de los fantasmas.",
    larga:
      "Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.",
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
    recordBase: 96400,
    partidas: "27.2K",
    dificultad: 3,
  },
  {
    id: "invasores",
    portada: "cover-invaders",
    titulo: "Invasores",
    categoria: "Shooter",
    corta: "Defiende el planeta de filas alienígenas.",
    larga:
      "Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.",
    accent: G,
    accent2: C,
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
    recordBase: 54190,
    partidas: "18.0K",
    dificultad: 3,
  },
  {
    id: "rocas",
    portada: "cover-rocas",
    titulo: "Rocas",
    categoria: "Shooter",
    corta: "Pulveriza asteroides en gravedad cero.",
    larga:
      "Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños.",
    accent: Y,
    accent2: C,
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
    archivo: "asteroids.html",
    vidas: 3,
    recordBase: 41200,
    partidas: "15.6K",
    dificultad: 3,
  },
  {
    id: "ranaria",
    portada: "cover-rana",
    titulo: "Ranaria",
    categoria: "Arcade",
    corta: "Cruza la autopista de pixeles.",
    larga:
      "Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo.",
    accent: G,
    accent2: Y,
    sprite: [
      "..#..#..",
      ".##..##.",
      ".######.",
      "..####..",
      ".######.",
      "##.##.##",
      "#......#",
      "........",
    ],
    archivo: "demo.html",
    vidas: 3,
    recordBase: 18900,
    partidas: "6.4K",
    dificultad: 3,
  },
  {
    id: "duelo-pixel",
    portada: "cover-duelo",
    titulo: "Duelo Pixel",
    categoria: "Versus",
    corta: "Dos paletas. Una pelota. Reflejos máximos.",
    larga:
      "El duelo más puro: dos paletas verticales se enfrentan por rebotar una pelota luminosa. Modo solitario contra la CPU o partida local a dos jugadores.",
    accent: C,
    accent2: M,
    sprite: [
      "#.......",
      "#.......",
      "#.......",
      "#..#....",
      "....#..#",
      ".......#",
      ".......#",
      ".......#",
    ],
    archivo: "demo.html",
    vidas: 1,
    recordBase: 24,
    partidas: "4.2K",
    dificultad: 3,
  },
];

export const CATEGORIAS = ["Todos", ...Array.from(new Set(GAMES.map((g) => g.categoria)))];

export function getGame(id: string) {
  return GAMES.find((g) => g.id === id);
}

export function fmtScore(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
