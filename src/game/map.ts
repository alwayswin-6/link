export type Platform = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Horizontal oscillation amplitude (0 = static). */
  ampX?: number;
  /** Vertical oscillation amplitude. */
  ampY?: number;
  period?: number;
  phase?: number;
  baseX?: number;
  baseY?: number;
};

export type SpawnPoint = { x: number; y: number };

export type ArenaMap = {
  id: string;
  name: string;
  platforms: Platform[];
  spawns: SpawnPoint[];
  nodeSpawns: SpawnPoint[];
};

export function createNeonRooftop(): ArenaMap {
  const platforms: Platform[] = [
    { x: 40, y: 500, w: 880, h: 24 }, // ground
    { x: 80, y: 400, w: 160, h: 16 },
    { x: 360, y: 360, w: 240, h: 16 },
    { x: 720, y: 400, w: 160, h: 16 },
    { x: 200, y: 280, w: 120, h: 16, ampY: 28, period: 3.2, phase: 0 },
    { x: 640, y: 280, w: 120, h: 16, ampY: 28, period: 3.2, phase: Math.PI },
    { x: 400, y: 200, w: 160, h: 16, ampX: 90, period: 4.5, phase: 0.5 },
    { x: 60, y: 180, w: 100, h: 16 },
    { x: 800, y: 180, w: 100, h: 16 },
  ];

  for (const p of platforms) {
    p.baseX = p.x;
    p.baseY = p.y;
  }

  return {
    id: 'neon-rooftop',
    name: 'Neon City Rooftop',
    platforms,
    spawns: [
      { x: 120, y: 450 },
      { x: 820, y: 450 },
      { x: 420, y: 320 },
      { x: 540, y: 320 },
    ],
    nodeSpawns: [
      { x: 160, y: 360 },
      { x: 480, y: 320 },
      { x: 800, y: 360 },
      { x: 480, y: 160 },
      { x: 110, y: 140 },
      { x: 850, y: 140 },
      { x: 260, y: 240 },
      { x: 700, y: 240 },
    ],
  };
}

export function updatePlatforms(platforms: Platform[], time: number): void {
  for (const p of platforms) {
    const bx = p.baseX ?? p.x;
    const by = p.baseY ?? p.y;
    const period = p.period ?? 1;
    const phase = p.phase ?? 0;
    const t = (time / period) * Math.PI * 2 + phase;
    p.x = bx + (p.ampX ?? 0) * Math.sin(t);
    p.y = by + (p.ampY ?? 0) * Math.sin(t);
  }
}
