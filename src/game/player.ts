import { PLAYER } from './config';
import type { Platform } from './map';
import { clamp, rectsOverlap, type Rect } from './math';

export type PlayerId = number;

export type PowerUpType =
  | 'doubleJump'
  | 'tripleDash'
  | 'giantAttack'
  | 'invisibleLinks'
  | 'explosiveDash';

export type Player = {
  id: PlayerId;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  energy: number;
  capturing: number | null;
  attackCooldown: number;
  dashCooldown: number;
  dashTimer: number;
  dashesLeft: number;
  jumpsLeft: number;
  maxJumps: number;
  stun: number;
  alive: boolean;
  isBot: boolean;
  powerUp: PowerUpType | null;
  powerUpTimer: number;
  attackScale: number;
  invisibleLinks: boolean;
  explosiveDash: boolean;
};

export function createPlayer(
  id: PlayerId,
  name: string,
  color: string,
  x: number,
  y: number,
  isBot: boolean,
): Player {
  return {
    id,
    name,
    color,
    x,
    y,
    vx: 0,
    vy: 0,
    facing: id % 2 === 0 ? 1 : -1,
    onGround: false,
    energy: 0,
    capturing: null,
    attackCooldown: 0,
    dashCooldown: 0,
    dashTimer: 0,
    dashesLeft: 1,
    jumpsLeft: 1,
    maxJumps: 1,
    stun: 0,
    alive: true,
    isBot,
    powerUp: null,
    powerUpTimer: 0,
    attackScale: 1,
    invisibleLinks: false,
    explosiveDash: false,
  };
}

export function playerRect(p: Player): Rect {
  return { x: p.x, y: p.y, w: PLAYER.width, h: PLAYER.height };
}

export function playerCenter(p: Player): { x: number; y: number } {
  return { x: p.x + PLAYER.width / 2, y: p.y + PLAYER.height / 2 };
}

export function applyPowerUp(p: Player, type: PowerUpType, duration: number): void {
  clearPowerUpEffects(p);
  p.powerUp = type;
  p.powerUpTimer = duration;
  switch (type) {
    case 'doubleJump':
      p.maxJumps = 2;
      p.jumpsLeft = Math.max(p.jumpsLeft, 2);
      break;
    case 'tripleDash':
      p.dashesLeft = 3;
      break;
    case 'giantAttack':
      p.attackScale = 1.8;
      break;
    case 'invisibleLinks':
      p.invisibleLinks = true;
      break;
    case 'explosiveDash':
      p.explosiveDash = true;
      break;
  }
}

function clearPowerUpEffects(p: Player): void {
  p.maxJumps = 1;
  p.attackScale = 1;
  p.invisibleLinks = false;
  p.explosiveDash = false;
  if (p.dashesLeft > 1) p.dashesLeft = 1;
}

export function tickPowerUp(p: Player, dt: number): void {
  if (!p.powerUp) return;
  p.powerUpTimer -= dt;
  if (p.powerUpTimer <= 0) {
    clearPowerUpEffects(p);
    p.powerUp = null;
    p.powerUpTimer = 0;
  }
}

export function movePlayer(
  p: Player,
  dt: number,
  platforms: Platform[],
  moveDir: number,
  wantJump: boolean,
  wantDash: boolean,
  speedMul: number,
): void {
  if (p.stun > 0) {
    p.stun -= dt;
    moveDir = 0;
    wantJump = false;
    wantDash = false;
  }

  p.attackCooldown = Math.max(0, p.attackCooldown - dt);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);

  if (p.dashTimer > 0) {
    p.dashTimer -= dt;
    p.vx = p.facing * PLAYER.dashSpeed;
    p.vy = 0;
  } else {
    const speed = PLAYER.moveSpeed * speedMul;
    if (moveDir !== 0) {
      p.facing = moveDir > 0 ? 1 : -1;
      p.vx = moveDir * speed;
    } else {
      p.vx *= Math.pow(0.05, dt);
      if (Math.abs(p.vx) < 8) p.vx = 0;
    }

    if (wantDash && p.dashesLeft > 0 && p.dashCooldown <= 0) {
      p.dashTimer = PLAYER.dashDuration;
      p.dashesLeft -= 1;
      if (p.powerUp !== 'tripleDash' || p.dashesLeft === 0) {
        p.dashCooldown = PLAYER.dashCooldown;
        if (p.powerUp !== 'tripleDash') p.dashesLeft = 0;
      }
      p.vx = p.facing * PLAYER.dashSpeed;
      p.vy = 0;
    }

    if (wantJump && p.jumpsLeft > 0) {
      p.vy = PLAYER.jumpVelocity;
      p.jumpsLeft -= 1;
      p.onGround = false;
    }

    p.vy += PLAYER.gravity * dt;
    p.vy = clamp(p.vy, -9999, PLAYER.maxFall);
  }

  // Horizontal
  p.x += p.vx * dt;
  resolvePlatforms(p, platforms, true);

  // Vertical
  p.y += p.vy * dt;
  p.onGround = false;
  resolvePlatforms(p, platforms, false);

  // World bounds
  p.x = clamp(p.x, 0, 960 - PLAYER.width);
  if (p.y > 560) {
    // fell off — soft respawn upward with energy penalty already handled elsewhere
    p.y = 40;
    p.vy = 0;
    p.energy = Math.max(0, p.energy - 15);
  }

  if (p.onGround) {
    p.jumpsLeft = p.maxJumps;
    if (p.powerUp === 'tripleDash') {
      // keep remaining dashes mid-air only; refresh on ground
      if (p.dashCooldown <= 0) p.dashesLeft = Math.max(p.dashesLeft, 3);
    } else if (p.dashCooldown <= 0) {
      p.dashesLeft = 1;
    }
  }
}

function resolvePlatforms(p: Player, platforms: Platform[], horizontal: boolean): void {
  const pr = playerRect(p);
  for (const plat of platforms) {
    const br: Rect = { x: plat.x, y: plat.y, w: plat.w, h: plat.h };
    if (!rectsOverlap(pr, br)) continue;

    if (horizontal) {
      if (p.vx > 0) p.x = br.x - PLAYER.width;
      else if (p.vx < 0) p.x = br.x + br.w;
      p.vx = 0;
      pr.x = p.x;
    } else {
      if (p.vy > 0 && p.y + PLAYER.height - p.vy * 0.02 <= br.y + 8) {
        p.y = br.y - PLAYER.height;
        p.vy = 0;
        p.onGround = true;
      } else if (p.vy < 0) {
        p.y = br.y + br.h;
        p.vy = 0;
      }
      pr.y = p.y;
    }
  }
}
