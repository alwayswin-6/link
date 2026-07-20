import type { SpawnPoint } from './map';
import { dist, type Vec2 } from './math';
import type { PlayerId } from './player';

export type EnergyNode = {
  id: number;
  x: number;
  y: number;
  radius: number;
  progress: number; // 0..100, filled by capturer
  capturerId: PlayerId | null;
  value: number;
};

export type PowerUpPickup = {
  id: number;
  x: number;
  y: number;
  type: import('./player').PowerUpType;
  age: number;
};

let nextNodeId = 1;
let nextPickupId = 1;

const POWER_TYPES: import('./player').PowerUpType[] = [
  'doubleJump',
  'tripleDash',
  'giantAttack',
  'invisibleLinks',
  'explosiveDash',
];

export function spawnNode(spawns: SpawnPoint[], existing: EnergyNode[]): EnergyNode | null {
  const taken = new Set(existing.map((n) => `${Math.round(n.x)},${Math.round(n.y)}`));
  const candidates = spawns.filter((s) => !taken.has(`${Math.round(s.x)},${Math.round(s.y)}`));
  if (candidates.length === 0) return null;
  const s = candidates[Math.floor(Math.random() * candidates.length)];
  return {
    id: nextNodeId++,
    x: s.x,
    y: s.y,
    radius: 22,
    progress: 0,
    capturerId: null,
    value: 25 + Math.floor(Math.random() * 16),
  };
}

export function spawnPowerUp(spawns: SpawnPoint[]): PowerUpPickup {
  const s = spawns[Math.floor(Math.random() * spawns.length)];
  return {
    id: nextPickupId++,
    x: s.x,
    y: s.y - 20,
    type: POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)],
    age: 0,
  };
}

export function tryCapture(
  node: EnergyNode,
  playerId: PlayerId,
  playerPos: Vec2,
  rate: number,
  dt: number,
): boolean {
  if (dist(playerPos, { x: node.x, y: node.y }) > node.radius + 14) {
    if (node.capturerId === playerId) {
      node.progress = Math.max(0, node.progress - rate * dt * 0.5);
      if (node.progress <= 0) node.capturerId = null;
    }
    return false;
  }

  if (node.capturerId !== null && node.capturerId !== playerId) {
    // contest — drain enemy progress
    node.progress = Math.max(0, node.progress - rate * dt * 1.4);
    if (node.progress <= 0) node.capturerId = playerId;
    return false;
  }

  node.capturerId = playerId;
  node.progress += rate * dt;
  return node.progress >= 100;
}

export function resetNodeIds(): void {
  nextNodeId = 1;
  nextPickupId = 1;
}
