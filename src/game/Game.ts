import { thinkBot } from './bot';
import { COLORS, MATCH, PLAYER, PLAYER_NAMES } from './config';
import { Input } from './input';
import {
  createLink,
  detectNewZones,
  prunePlayerLinks,
  resetLinkIds,
  tickLinks,
  tickZones,
  type EnergyLink,
  type EnergyZone,
} from './links';
import { createNeonRooftop, updatePlatforms, type ArenaMap } from './map';
import { dist, distToSegment, pointInTriangle } from './math';
import {
  resetNodeIds,
  spawnNode,
  spawnPowerUp,
  tryCapture,
  type EnergyNode,
  type PowerUpPickup,
} from './nodes';
import {
  applyPowerUp,
  createPlayer,
  movePlayer,
  playerCenter,
  tickPowerUp,
  type Player,
} from './player';
import { Renderer } from './renderer';

export type HudState = {
  timeLeft: number;
  scores: { name: string; color: string; energy: number }[];
  ended: boolean;
  winner: string | null;
};

type Flash = { x: number; y: number; facing: 1 | -1; color: string; scale: number; t: number };

export class Game {
  private map: ArenaMap;
  private players: Player[] = [];
  private links: EnergyLink[] = [];
  private zones: EnergyZone[] = [];
  private nodes: EnergyNode[] = [];
  private pickups: PowerUpPickup[] = [];
  private input: Input;
  private renderer: Renderer;
  private time = 0;
  private matchLeft: number = MATCH.durationSec;
  private nodeTimer = 2;
  private powerTimer = MATCH.powerUpInterval;
  private running = false;
  private ended = false;
  private active = false;
  private flashes: Flash[] = [];
  private onHud: (s: HudState) => void;

  constructor(canvas: HTMLCanvasElement, onHud: (s: HudState) => void) {
    this.renderer = new Renderer(canvas);
    this.input = new Input();
    this.map = createNeonRooftop();
    this.onHud = onHud;
    this.reset(false);
  }

  /** @param start If false, load arena in idle preview mode. */
  reset(start = true): void {
    resetLinkIds();
    resetNodeIds();
    this.map = createNeonRooftop();
    this.links = [];
    this.zones = [];
    this.nodes = [];
    this.pickups = [];
    this.flashes = [];
    this.time = 0;
    this.matchLeft = MATCH.durationSec;
    this.nodeTimer = 1;
    this.powerTimer = MATCH.powerUpInterval;
    this.ended = false;
    this.active = start;

    this.players = [
      createPlayer(0, PLAYER_NAMES[0], COLORS[0], this.map.spawns[0].x, this.map.spawns[0].y, false),
      createPlayer(1, PLAYER_NAMES[1], COLORS[1], this.map.spawns[1].x, this.map.spawns[1].y, true),
      createPlayer(2, PLAYER_NAMES[2], COLORS[2], this.map.spawns[2].x, this.map.spawns[2].y, true),
    ];

    // Seed one node
    const n = spawnNode(this.map.nodeSpawns, this.nodes);
    if (n) this.nodes.push(n);
    this.pushHud();
  }

  dispose(): void {
    this.input.dispose();
    this.running = false;
  }

  start(): void {
    this.running = true;
    let last = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.draw();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private update(dt: number): void {
    if (!this.active || this.ended) {
      this.input.endFrame();
      // Still draw idle arena when waiting
      if (!this.active && !this.ended) {
        this.time += dt;
        updatePlatforms(this.map.platforms, this.time);
      }
      return;
    }

    this.time += dt;
    this.matchLeft -= dt;
    if (this.matchLeft <= 0) {
      this.matchLeft = 0;
      this.ended = true;
      this.pushHud();
      this.input.endFrame();
      return;
    }

    updatePlatforms(this.map.platforms, this.time);

    // Spawns
    this.nodeTimer -= dt;
    if (this.nodeTimer <= 0 && this.nodes.length < MATCH.maxNodes) {
      const n = spawnNode(this.map.nodeSpawns, this.nodes);
      if (n) this.nodes.push(n);
      this.nodeTimer = MATCH.nodeSpawnInterval;
    }

    this.powerTimer -= dt;
    if (this.powerTimer <= 0) {
      this.pickups.push(spawnPowerUp(this.map.nodeSpawns));
      this.powerTimer = MATCH.powerUpInterval;
    }

    for (const pu of this.pickups) pu.age += dt;
    this.pickups = this.pickups.filter((p) => p.age < 20);

    // Player intents
    for (const p of this.players) {
      tickPowerUp(p, dt);

      let move = 0;
      let jump = false;
      let attack = false;
      let dash = false;

      if (!p.isBot) {
        if (this.input.isDown('left')) move -= 1;
        if (this.input.isDown('right')) move += 1;
        jump = this.input.consumePress('jump');
        attack = this.input.consumePress('attack');
        dash = this.input.consumePress('dash');
      } else {
        const cmd = thinkBot(p, this.players, this.nodes, this.zones, this.links, this.time);
        move = cmd.move;
        jump = cmd.jump;
        attack = cmd.attack;
        dash = cmd.dash;
      }

      const speedMul = this.linkSpeedMul(p);
      const wasDashing = p.dashTimer > 0;
      movePlayer(p, dt, this.map.platforms, move, jump, dash, speedMul);

      // Explosive dash knockback
      if (p.explosiveDash && wasDashing && p.dashTimer <= 0) {
        this.aoePush(playerCenter(p), 90, 420, p.id);
      }

      if (attack) this.doAttack(p);

      // Capture nodes
      p.capturing = null;
      for (const node of [...this.nodes]) {
        const done = tryCapture(
          node,
          p.id,
          playerCenter(p),
          PLAYER.captureRate,
          dt,
        );
        if (node.capturerId === p.id && node.progress > 0) p.capturing = node.id;
        if (done) {
          p.energy += node.value;
          this.nodes = this.nodes.filter((n) => n.id !== node.id);
        }
      }

      // Zone scoring / destruction by standing + attack already handled
      for (const z of this.zones) {
        if (pointInTriangle(playerCenter(p), z.a, z.b, z.c)) {
          if (z.ownerId === p.id) {
            p.energy += PLAYER.zoneScoreRate * dt;
          }
        }
      }

      // Power-up pickup
      for (const pu of [...this.pickups]) {
        if (dist(playerCenter(p), { x: pu.x, y: pu.y }) < 28) {
          applyPowerUp(p, pu.type, MATCH.powerUpDuration);
          this.pickups = this.pickups.filter((x) => x.id !== pu.id);
        }
      }
    }

    // Tick links/zones
    this.links = tickLinks(this.links, dt);
    this.zones = tickZones(this.zones, dt);

    // Remove zones whose links expired
    const liveIds = new Set(this.links.map((l) => l.id));
    this.zones = this.zones.filter((z) => z.linkIds.every((id) => liveIds.has(id)));

    this.flashes = this.flashes.filter((f) => {
      f.t -= dt;
      return f.t > 0;
    });

    this.input.endFrame();
    this.pushHud();
  }

  private linkSpeedMul(p: Player): number {
    const c = playerCenter(p);
    let mul = 1;
    for (const l of this.links) {
      if (l.invisible && l.ownerId !== p.id) continue;
      if (distToSegment(c, l.a, l.b) > 14) continue;
      if (l.ownerId === p.id) mul = Math.max(mul, PLAYER.boostSpeed / PLAYER.moveSpeed);
      else mul = Math.min(mul, PLAYER.slowSpeed / PLAYER.moveSpeed);
    }
    return mul;
  }

  private doAttack(p: Player): void {
    if (p.attackCooldown > 0) return;
    p.attackCooldown = PLAYER.attackCooldown;

    const origin = playerCenter(p);
    const range = PLAYER.attackRange * p.attackScale;
    const tip = {
      x: origin.x + p.facing * range,
      y: origin.y,
    };

    this.flashes.push({
      x: origin.x,
      y: origin.y,
      facing: p.facing,
      color: p.color,
      scale: p.attackScale,
      t: 0.12,
    });

    // Create link
    const link = createLink(p.id, origin, tip, p.invisibleLinks);
    this.links.push(link);
    this.links = prunePlayerLinks(this.links, p.id);

    // Detect new zones
    const created = detectNewZones(this.links, this.zones, p.id);
    this.zones.push(...created);

    // Hit players
    for (const other of this.players) {
      if (other.id === p.id || !other.alive) continue;
      const oc = playerCenter(other);
      if (dist(origin, oc) > range + 10) continue;
      // Must be roughly in facing direction
      if ((oc.x - origin.x) * p.facing < -10) continue;

      other.vx = p.facing * PLAYER.attackKnockback;
      other.vy = -180;
      other.stun = 0.2;
      other.onGround = false;

      // Interrupt capture
      for (const n of this.nodes) {
        if (n.capturerId === other.id) {
          n.progress = Math.max(0, n.progress - 35);
        }
      }
    }

    // Break enemy zones if attack overlaps
    this.zones = this.zones.filter((z) => {
      if (z.ownerId === p.id) return true;
      const hit =
        pointInTriangle(origin, z.a, z.b, z.c) ||
        pointInTriangle(tip, z.a, z.b, z.c) ||
        distToSegment(origin, z.a, z.b) < range ||
        distToSegment(origin, z.b, z.c) < range ||
        distToSegment(origin, z.c, z.a) < range;
      return !hit;
    });
  }

  private aoePush(center: { x: number; y: number }, radius: number, force: number, except: number): void {
    for (const other of this.players) {
      if (other.id === except) continue;
      const oc = playerCenter(other);
      const d = dist(center, oc);
      if (d > radius || d < 1) continue;
      const nx = (oc.x - center.x) / d;
      const ny = (oc.y - center.y) / d;
      other.vx += nx * force;
      other.vy += ny * force * 0.5 - 100;
      other.stun = 0.25;
    }
  }

  private draw(): void {
    this.renderer.clear(this.time);
    this.renderer.drawMap(this.map);
    this.renderer.drawZones(this.zones, this.players);
    this.renderer.drawLinks(this.links, this.players);
    this.renderer.drawNodes(this.nodes, this.players);
    this.renderer.drawPowerUps(this.pickups);
    this.renderer.drawPlayers(this.players, this.time);
    for (const f of this.flashes) {
      this.renderer.drawAttackFlash(f.x, f.y, f.facing, f.color, f.scale);
    }
  }

  private pushHud(): void {
    const sorted = [...this.players].sort((a, b) => b.energy - a.energy);
    this.onHud({
      timeLeft: this.matchLeft,
      scores: this.players.map((p) => ({
        name: p.name,
        color: p.color,
        energy: Math.floor(p.energy),
      })),
      ended: this.ended,
      winner: this.ended ? sorted[0]?.name ?? null : null,
    });
  }
}
