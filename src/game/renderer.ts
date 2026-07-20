import { LINK, WORLD } from './config';
import type { EnergyLink, EnergyZone } from './links';
import type { ArenaMap } from './map';
import type { EnergyNode, PowerUpPickup } from './nodes';
import { PLAYER } from './config';
import { playerCenter, type Player } from './player';

const POWER_LABEL: Record<string, string> = {
  doubleJump: 'DOUBLE JUMP',
  tripleDash: 'TRIPLE DASH',
  giantAttack: 'GIANT ATK',
  invisibleLinks: 'INVIS LINK',
  explosiveDash: 'EXPL DASH',
};

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    canvas.width = WORLD.width;
    canvas.height = WORLD.height;
  }

  clear(time: number): void {
    const g = this.ctx;
    g.clearRect(0, 0, WORLD.width, WORLD.height);

    // Night sky
    const grad = g.createLinearGradient(0, 0, 0, WORLD.height);
    grad.addColorStop(0, '#0a1020');
    grad.addColorStop(0.55, '#0c1528');
    grad.addColorStop(1, '#060a14');
    g.fillStyle = grad;
    g.fillRect(0, 0, WORLD.width, WORLD.height);

    // City silhouette
    g.fillStyle = '#070b16';
    for (let i = 0; i < 18; i++) {
      const bx = (i * 67 + Math.sin(time * 0.1 + i) * 4) % (WORLD.width + 40) - 20;
      const bh = 60 + ((i * 37) % 120);
      g.fillRect(bx, WORLD.height - 40 - bh, 40 + (i % 3) * 12, bh);
    }

    // Stars
    g.fillStyle = 'rgba(200,220,255,0.55)';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 97 + 13) % WORLD.width;
      const sy = (i * 53 + 7) % 200;
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(time * 2 + i));
      g.globalAlpha = twinkle;
      g.fillRect(sx, sy, 2, 2);
    }
    g.globalAlpha = 1;
  }

  drawMap(map: ArenaMap): void {
    const g = this.ctx;
    for (const p of map.platforms) {
      g.fillStyle = '#141c30';
      g.fillRect(p.x, p.y, p.w, p.h);
      g.strokeStyle = 'rgba(60,240,255,0.35)';
      g.lineWidth = 1;
      g.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
      // neon edge
      g.fillStyle = 'rgba(60,240,255,0.55)';
      g.fillRect(p.x, p.y, p.w, 2);
    }
  }

  drawZones(zones: EnergyZone[], players: Player[]): void {
    const g = this.ctx;
    for (const z of zones) {
      const owner = players.find((p) => p.id === z.ownerId);
      const color = owner?.color ?? '#fff';
      const fade = 1 - z.age / z.lifetime;
      g.beginPath();
      g.moveTo(z.a.x, z.a.y);
      g.lineTo(z.b.x, z.b.y);
      g.lineTo(z.c.x, z.c.y);
      g.closePath();
      g.fillStyle = hexAlpha(color, 0.18 * fade);
      g.fill();
      g.strokeStyle = hexAlpha(color, 0.55 * fade);
      g.lineWidth = 2;
      g.stroke();
    }
  }

  drawLinks(links: EnergyLink[], players: Player[]): void {
    const g = this.ctx;
    for (const l of links) {
      if (l.invisible) continue;
      const owner = players.find((p) => p.id === l.ownerId);
      const color = owner?.color ?? '#fff';
      const fade = 1 - l.age / l.lifetime;
      g.save();
      g.shadowColor = color;
      g.shadowBlur = 12 * fade;
      g.strokeStyle = hexAlpha(color, 0.35 + 0.65 * fade);
      g.lineWidth = LINK.thickness;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(l.a.x, l.a.y);
      g.lineTo(l.b.x, l.b.y);
      g.stroke();
      g.restore();
    }
  }

  drawNodes(nodes: EnergyNode[], players: Player[]): void {
    const g = this.ctx;
    for (const n of nodes) {
      g.save();
      g.shadowColor = '#ffe566';
      g.shadowBlur = 16;
      g.strokeStyle = '#ffe566';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      g.stroke();

      if (n.progress > 0 && n.capturerId !== null) {
        const owner = players.find((p) => p.id === n.capturerId);
        g.strokeStyle = owner?.color ?? '#fff';
        g.lineWidth = 4;
        g.beginPath();
        g.arc(n.x, n.y, n.radius - 4, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * n.progress) / 100);
        g.stroke();
      }

      g.fillStyle = 'rgba(255,229,102,0.25)';
      g.beginPath();
      g.arc(n.x, n.y, 8, 0, Math.PI * 2);
      g.fill();
      g.restore();

      g.fillStyle = '#c8b060';
      g.font = '10px JetBrains Mono, monospace';
      g.textAlign = 'center';
      g.fillText(`+${n.value}`, n.x, n.y - n.radius - 6);
    }
  }

  drawPowerUps(pickups: PowerUpPickup[]): void {
    const g = this.ctx;
    for (const p of pickups) {
      g.save();
      g.translate(p.x, p.y + Math.sin(p.age * 4) * 4);
      g.shadowColor = '#b8ff3c';
      g.shadowBlur = 14;
      g.fillStyle = 'rgba(184,255,60,0.2)';
      g.strokeStyle = '#b8ff3c';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -12);
      g.lineTo(12, 0);
      g.lineTo(0, 12);
      g.lineTo(-12, 0);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();

      g.fillStyle = '#b8ff3c';
      g.font = '9px JetBrains Mono, monospace';
      g.textAlign = 'center';
      g.fillText(POWER_LABEL[p.type] ?? p.type, p.x, p.y - 22);
    }
  }

  drawPlayers(players: Player[], time: number): void {
    const g = this.ctx;
    for (const p of players) {
      if (!p.alive) continue;
      const c = playerCenter(p);
      g.save();
      g.shadowColor = p.color;
      g.shadowBlur = 14;

      // body
      g.fillStyle = p.color;
      g.fillRect(p.x, p.y, PLAYER.width, PLAYER.height);

      // visor
      g.fillStyle = '#0a1020';
      g.fillRect(p.x + 4, p.y + 6, PLAYER.width - 8, 8);

      // facing indicator
      g.fillStyle = '#fff';
      const eyeX = p.facing > 0 ? p.x + PLAYER.width - 8 : p.x + 4;
      g.fillRect(eyeX, p.y + 8, 4, 4);

      // dash trail
      if (p.dashTimer > 0) {
        g.globalAlpha = 0.35;
        g.fillRect(p.x - p.facing * 16, p.y, PLAYER.width, PLAYER.height);
      }

      g.restore();

      // name + energy
      g.fillStyle = p.color;
      g.font = '10px JetBrains Mono, monospace';
      g.textAlign = 'center';
      g.fillText(`${p.name} ${Math.floor(p.energy)}`, c.x, p.y - 8);

      if (p.powerUp) {
        g.fillStyle = '#b8ff3c';
        g.fillText(POWER_LABEL[p.powerUp] ?? '', c.x, p.y - 20);
      }

      // idle bob glow
      void time;
    }
  }

  drawAttackFlash(x: number, y: number, facing: number, color: string, scale: number): void {
    const g = this.ctx;
    g.save();
    g.shadowColor = color;
    g.shadowBlur = 20;
    g.strokeStyle = color;
    g.lineWidth = 3;
    const reach = PLAYER.attackRange * scale;
    g.beginPath();
    g.arc(x, y, reach, facing > 0 ? -0.8 : Math.PI - 0.8, facing > 0 ? 0.8 : Math.PI + 0.8);
    g.stroke();
    g.restore();
  }
}

function hexAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
