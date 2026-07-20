export type Vec2 = { x: number; y: number };

export type Rect = { x: number; y: number; w: number; h: number };

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function pointInRect(p: Vec2, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function pointInTriangle(p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
  const s1 = sign(p, a, b);
  const s2 = sign(p, b, c);
  const s3 = sign(p, c, a);
  const hasNeg = s1 < 0 || s2 < 0 || s3 < 0;
  const hasPos = s1 > 0 || s2 > 0 || s3 > 0;
  return !(hasNeg && hasPos);
}

function sign(p1: Vec2, p2: Vec2, p3: Vec2): number {
  return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

export function triangleArea(a: Vec2, b: Vec2, c: Vec2): number {
  return Math.abs((a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2);
}

/** Distance from point to line segment. */
export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = clamp(t, 0, 1);
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

export function segmentsTouch(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2, pad = 18): boolean {
  return (
    distToSegment(a1, b1, b2) < pad ||
    distToSegment(a2, b1, b2) < pad ||
    distToSegment(b1, a1, a2) < pad ||
    distToSegment(b2, a1, a2) < pad ||
    segmentsIntersect(a1, a2, b1, b2)
  );
}

function segmentsIntersect(p1: Vec2, q1: Vec2, p2: Vec2, q2: Vec2): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  return o1 !== o2 && o3 !== o4;
}

function orientation(p: Vec2, q: Vec2, r: Vec2): number {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(val) < 1e-9) return 0;
  return val > 0 ? 1 : 2;
}
