export const WORLD = {
  width: 960,
  height: 540,
} as const;

export const MATCH = {
  durationSec: 180,
  nodeSpawnInterval: 8,
  maxNodes: 4,
  powerUpInterval: 30,
  powerUpDuration: 10,
} as const;

export const PLAYER = {
  width: 22,
  height: 28,
  moveSpeed: 220,
  boostSpeed: 340,
  slowSpeed: 110,
  jumpVelocity: -420,
  gravity: 1100,
  maxFall: 700,
  dashSpeed: 520,
  dashDuration: 0.16,
  dashCooldown: 0.7,
  attackRange: 48,
  attackCooldown: 0.35,
  attackKnockback: 380,
  captureRate: 28,
  zoneScoreRate: 12,
} as const;

export const LINK = {
  lifetime: 5,
  maxPerPlayer: 12,
  thickness: 3,
  triangleMinArea: 1800,
  zoneLifetime: 8,
} as const;

export const COLORS = [
  '#3cf0ff', // cyan
  '#ff4fd8', // pink
  '#b8ff3c', // lime
  '#ffb020', // amber
] as const;

export const PLAYER_NAMES = ['CYBER', 'NOVA', 'PULSE', 'BYTE'] as const;
