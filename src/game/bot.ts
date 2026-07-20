import type { EnergyLink, EnergyZone } from './links';
import { dist, pointInTriangle } from './math';
import type { EnergyNode } from './nodes';
import { playerCenter, type Player } from './player';
import { PLAYER } from './config';

export type BotCommand = {
  move: number;
  jump: boolean;
  attack: boolean;
  dash: boolean;
};

/**
 * Lightweight heuristic bot: capture nodes, disrupt enemy zones, attack nearby foes.
 */
export function thinkBot(
  bot: Player,
  players: Player[],
  nodes: EnergyNode[],
  zones: EnergyZone[],
  _links: EnergyLink[],
  time: number,
): BotCommand {
  const cmd: BotCommand = { move: 0, jump: false, attack: false, dash: false };
  const me = playerCenter(bot);

  // Prefer unfinished nodes, then enemy zones, then chase nearest player
  let targetX = me.x;
  let targetY = me.y;
  let mode: 'node' | 'zone' | 'fight' | 'wander' = 'wander';

  const openNode = [...nodes].sort(
    (a, b) => dist(me, { x: a.x, y: a.y }) - dist(me, { x: b.x, y: b.y }),
  )[0];

  const enemyZone = zones
    .filter((z) => z.ownerId !== bot.id)
    .sort((a, b) => {
      const ca = { x: (a.a.x + a.b.x + a.c.x) / 3, y: (a.a.y + a.b.y + a.c.y) / 3 };
      const cb = { x: (b.a.x + b.b.x + b.c.x) / 3, y: (b.a.y + b.b.y + b.c.y) / 3 };
      return dist(me, ca) - dist(me, cb);
    })[0];

  const foe = players
    .filter((p) => p.id !== bot.id && p.alive)
    .sort((a, b) => dist(me, playerCenter(a)) - dist(me, playerCenter(b)))[0];

  if (openNode && (bot.energy < 80 || Math.sin(time + bot.id) > -0.2)) {
    targetX = openNode.x;
    targetY = openNode.y;
    mode = 'node';
  } else if (enemyZone && Math.sin(time * 0.7 + bot.id * 2) > 0.1) {
    targetX = (enemyZone.a.x + enemyZone.b.x + enemyZone.c.x) / 3;
    targetY = (enemyZone.a.y + enemyZone.b.y + enemyZone.c.y) / 3;
    mode = 'zone';
  } else if (foe) {
    targetX = foe.x + PLAYER.width / 2;
    targetY = foe.y;
    mode = 'fight';
  }

  const dx = targetX - me.x;
  const dy = targetY - me.y;
  if (Math.abs(dx) > 10) cmd.move = dx > 0 ? 1 : -1;

  // Jump if target is above or platform gap
  if (dy < -40 && bot.onGround) cmd.jump = true;
  if (dy < -90 && bot.jumpsLeft > 0 && !bot.onGround) cmd.jump = Math.random() > 0.7;

  // Attack if close to foe or standing in enemy zone
  if (foe && dist(me, playerCenter(foe)) < PLAYER.attackRange * 1.3) {
    cmd.attack = true;
    if (Math.random() > 0.85) cmd.dash = true;
  }

  if (mode === 'zone' && enemyZone && pointInTriangle(me, enemyZone.a, enemyZone.b, enemyZone.c)) {
    cmd.attack = true;
  }

  // Occasional dash toward objective
  if (Math.abs(dx) > 120 && bot.dashesLeft > 0 && Math.random() > 0.97) cmd.dash = true;

  // Avoid standing still — dash sometimes
  if (Math.random() > 0.992) cmd.dash = true;

  return cmd;
}
