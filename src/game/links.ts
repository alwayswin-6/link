import { LINK } from './config';
import {
  dist,
  segmentsTouch,
  triangleArea,
  type Vec2,
} from './math';
import type { PlayerId } from './player';

export type EnergyLink = {
  id: number;
  ownerId: PlayerId;
  a: Vec2;
  b: Vec2;
  age: number;
  lifetime: number;
  invisible: boolean;
};

export type EnergyZone = {
  id: number;
  ownerId: PlayerId;
  a: Vec2;
  b: Vec2;
  c: Vec2;
  age: number;
  lifetime: number;
  linkIds: [number, number, number];
};

let nextLinkId = 1;
let nextZoneId = 1;

export function createLink(
  ownerId: PlayerId,
  a: Vec2,
  b: Vec2,
  invisible = false,
): EnergyLink {
  return {
    id: nextLinkId++,
    ownerId,
    a: { ...a },
    b: { ...b },
    age: 0,
    lifetime: LINK.lifetime,
    invisible,
  };
}

export function tickLinks(links: EnergyLink[], dt: number): EnergyLink[] {
  for (const l of links) l.age += dt;
  return links.filter((l) => l.age < l.lifetime);
}

export function tickZones(zones: EnergyZone[], dt: number): EnergyZone[] {
  for (const z of zones) z.age += dt;
  return zones.filter((z) => z.age < z.lifetime);
}

export function prunePlayerLinks(links: EnergyLink[], ownerId: PlayerId): EnergyLink[] {
  const owned = links.filter((l) => l.ownerId === ownerId);
  if (owned.length <= LINK.maxPerPlayer) return links;
  const drop = owned.length - LINK.maxPerPlayer;
  const oldest = [...owned].sort((a, b) => b.age - a.age).slice(0, drop);
  const dropIds = new Set(oldest.map((l) => l.id));
  return links.filter((l) => !dropIds.has(l.id));
}

/**
 * Find new triangles formed by the owner's links.
 * Three links form a triangle when each pair shares a near-endpoint.
 */
export function detectNewZones(
  links: EnergyLink[],
  zones: EnergyZone[],
  ownerId: PlayerId,
): EnergyZone[] {
  const owned = links.filter((l) => l.ownerId === ownerId);
  if (owned.length < 3) return [];

  const existing = new Set(
    zones
      .filter((z) => z.ownerId === ownerId)
      .map((z) => [...z.linkIds].sort((a, b) => a - b).join('-')),
  );

  const created: EnergyZone[] = [];

  for (let i = 0; i < owned.length; i++) {
    for (let j = i + 1; j < owned.length; j++) {
      for (let k = j + 1; k < owned.length; k++) {
        const L = [owned[i], owned[j], owned[k]];
        const ids = L.map((l) => l.id).sort((a, b) => a - b) as [number, number, number];
        const key = ids.join('-');
        if (existing.has(key)) continue;

        if (!formsTriangle(L[0], L[1], L[2])) continue;

        const corners = extractCorners(L[0], L[1], L[2]);
        if (!corners) continue;
        if (triangleArea(corners[0], corners[1], corners[2]) < LINK.triangleMinArea) continue;

        created.push({
          id: nextZoneId++,
          ownerId,
          a: corners[0],
          b: corners[1],
          c: corners[2],
          age: 0,
          lifetime: LINK.zoneLifetime,
          linkIds: ids,
        });
        existing.add(key);
      }
    }
  }

  return created;
}

function formsTriangle(a: EnergyLink, b: EnergyLink, c: EnergyLink): boolean {
  return (
    segmentsTouch(a.a, a.b, b.a, b.b) &&
    segmentsTouch(b.a, b.b, c.a, c.b) &&
    segmentsTouch(c.a, c.b, a.a, a.b)
  );
}

function extractCorners(a: EnergyLink, b: EnergyLink, c: EnergyLink): [Vec2, Vec2, Vec2] | null {
  const pts = [a.a, a.b, b.a, b.b, c.a, c.b];
  const unique: Vec2[] = [];
  for (const p of pts) {
    if (!unique.some((u) => dist(u, p) < 22)) unique.push({ ...p });
  }
  if (unique.length < 3) return null;
  // Pick three that maximize area
  let best: [Vec2, Vec2, Vec2] | null = null;
  let bestArea = 0;
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      for (let k = j + 1; k < unique.length; k++) {
        const area = triangleArea(unique[i], unique[j], unique[k]);
        if (area > bestArea) {
          bestArea = area;
          best = [unique[i], unique[j], unique[k]];
        }
      }
    }
  }
  return best;
}

export function resetLinkIds(): void {
  nextLinkId = 1;
  nextZoneId = 1;
}
