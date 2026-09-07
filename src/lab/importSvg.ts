import { PROFILE_SAMPLES } from '@/bot/profiles'
import { profileFromPolygon, type Point } from '@/bot/shape'

/**
 * SVG -> profil radial de 64 rayons, le meme echantillonnage que `profiles.ts`.
 *
 * Pas de DOM : le laboratoire doit rester testable en `node`, comme le reste de
 * `src/bot/`. On lit polygon, polyline, circle, ellipse, rect, et un sous-ensemble
 * de `path` (M L H V C S Q T Z). Les coordonnees sont ramenees au centroide puis
 * normalisees (rayon max = 1), donc viewBox et echelle n'importent pas.
 */

const ATTR = (name: string) => new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i')

function attr(tag: string, name: string): string | null {
  return ATTR(name).exec(tag)?.[1] ?? null
}

function nums(src: string): number[] {
  return (src.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number).filter(Number.isFinite)
}

function pairPoints(values: number[]): Point[] {
  const out: Point[] = []
  for (let i = 0; i + 1 < values.length; i += 2) out.push({ x: values[i]!, y: values[i + 1]! })
  return out
}

function circlePoints(cx: number, cy: number, rx: number, ry: number, n = 64): Point[] {
  const out: Point[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    out.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry })
  }
  return out
}

function lerpPt(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function cubic(a: Point, b: Point, c: Point, d: Point, steps: number): Point[] {
  const out: Point[] = []
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const ab = lerpPt(a, b, t)
    const bc = lerpPt(b, c, t)
    const cd = lerpPt(c, d, t)
    const abbc = lerpPt(ab, bc, t)
    const bccd = lerpPt(bc, cd, t)
    out.push(lerpPt(abbc, bccd, t))
  }
  return out
}

function quad(a: Point, b: Point, c: Point, steps: number): Point[] {
  const out: Point[] = []
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const ab = lerpPt(a, b, t)
    const bc = lerpPt(b, c, t)
    out.push(lerpPt(ab, bc, t))
  }
  return out
}

function tokenizePath(d: string): string[] {
  return d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? []
}

function pathPoints(d: string): Point[] {
  const tokens = tokenizePath(d)
  const pts: Point[] = []
  let i = 0
  let cmd = 'M'
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  let cx = 0
  let cy = 0
  let qx = 0
  let qy = 0
  let lastCubic = false
  let lastQuad = false

  const take = () => Number(tokens[i++] ?? 0)
  const startSub = (nx: number, ny: number) => {
    x = nx
    y = ny
    sx = nx
    sy = ny
    pts.push({ x, y })
    lastCubic = false
    lastQuad = false
  }

  while (i < tokens.length) {
    const t = tokens[i]!
    if (/^[a-zA-Z]$/.test(t)) {
      cmd = t
      i++
    }
    const rel = cmd === cmd.toLowerCase()
    const c = cmd.toUpperCase()
    if (c === 'Z') {
      if (pts.length && (x !== sx || y !== sy)) pts.push({ x: sx, y: sy })
      x = sx
      y = sy
      lastCubic = false
      lastQuad = false
      continue
    }
    if (c === 'M') {
      const nx = take() + (rel ? x : 0)
      const ny = take() + (rel ? y : 0)
      startSub(nx, ny)
      cmd = rel ? 'l' : 'L'
      continue
    }
    if (c === 'L') {
      x = take() + (rel ? x : 0)
      y = take() + (rel ? y : 0)
      pts.push({ x, y })
      lastCubic = false
      lastQuad = false
      continue
    }
    if (c === 'H') {
      x = take() + (rel ? x : 0)
      pts.push({ x, y })
      lastCubic = false
      lastQuad = false
      continue
    }
    if (c === 'V') {
      y = take() + (rel ? y : 0)
      pts.push({ x, y })
      lastCubic = false
      lastQuad = false
      continue
    }
    if (c === 'C') {
      const x1 = take() + (rel ? x : 0)
      const y1 = take() + (rel ? y : 0)
      const x2 = take() + (rel ? x : 0)
      const y2 = take() + (rel ? y : 0)
      const nx = take() + (rel ? x : 0)
      const ny = take() + (rel ? y : 0)
      pts.push(...cubic({ x, y }, { x: x1, y: y1 }, { x: x2, y: y2 }, { x: nx, y: ny }, 12))
      cx = x2
      cy = y2
      x = nx
      y = ny
      lastCubic = true
      lastQuad = false
      continue
    }
    if (c === 'S') {
      const x2 = take() + (rel ? x : 0)
      const y2 = take() + (rel ? y : 0)
      const nx = take() + (rel ? x : 0)
      const ny = take() + (rel ? y : 0)
      const x1 = lastCubic ? 2 * x - cx : x
      const y1 = lastCubic ? 2 * y - cy : y
      pts.push(...cubic({ x, y }, { x: x1, y: y1 }, { x: x2, y: y2 }, { x: nx, y: ny }, 12))
      cx = x2
      cy = y2
      x = nx
      y = ny
      lastCubic = true
      lastQuad = false
      continue
    }
    if (c === 'Q') {
      const x1 = take() + (rel ? x : 0)
      const y1 = take() + (rel ? y : 0)
      const nx = take() + (rel ? x : 0)
      const ny = take() + (rel ? y : 0)
      pts.push(...quad({ x, y }, { x: x1, y: y1 }, { x: nx, y: ny }, 10))
      qx = x1
      qy = y1
      x = nx
      y = ny
      lastQuad = true
      lastCubic = false
      continue
    }
    if (c === 'T') {
      const nx = take() + (rel ? x : 0)
      const ny = take() + (rel ? y : 0)
      const x1 = lastQuad ? 2 * x - qx : x
      const y1 = lastQuad ? 2 * y - qy : y
      pts.push(...quad({ x, y }, { x: x1, y: y1 }, { x: nx, y: ny }, 10))
      qx = x1
      qy = y1
      x = nx
      y = ny
      lastQuad = true
      lastCubic = false
      continue
    }
    if (c === 'A') {
      // approximation : on garde l'arrivee. Un vrai arc viendra si un SVG du
      // mascotte en a besoin ; les silhouettes Bloub sont des cubiques / polygones.
      take()
      take()
      take()
      take()
      take()
      x = take() + (rel ? x : 0)
      y = take() + (rel ? y : 0)
      pts.push({ x, y })
      lastCubic = false
      lastQuad = false
      continue
    }
    // commande inconnue : on avance d'un nombre pour ne pas boucler
    if (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i]!)) i++
    else break
  }
  return pts
}

function tagsOf(svg: string, name: string): string[] {
  const re = new RegExp(`<${name}\\b[^>]*>`, 'gi')
  return svg.match(re) ?? []
}

function area(poly: Point[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!
    const q = poly[(i + 1) % poly.length]!
    a += p.x * q.y - q.x * p.y
  }
  return Math.abs(a) / 2
}

function centroid(poly: Point[]): Point {
  let x = 0
  let y = 0
  for (const p of poly) {
    x += p.x
    y += p.y
  }
  const n = poly.length || 1
  return { x: x / n, y: y / n }
}

function contoursOf(svg: string): Point[][] {
  const found: Point[][] = []
  for (const tag of tagsOf(svg, 'polygon')) {
    const pts = pairPoints(nums(attr(tag, 'points') ?? ''))
    if (pts.length >= 3) found.push(pts)
  }
  for (const tag of tagsOf(svg, 'polyline')) {
    const pts = pairPoints(nums(attr(tag, 'points') ?? ''))
    if (pts.length >= 3) found.push(pts)
  }
  for (const tag of tagsOf(svg, 'circle')) {
    const cx = Number(attr(tag, 'cx') ?? 0)
    const cy = Number(attr(tag, 'cy') ?? 0)
    const r = Number(attr(tag, 'r') ?? 0)
    if (r > 0) found.push(circlePoints(cx, cy, r, r))
  }
  for (const tag of tagsOf(svg, 'ellipse')) {
    const cx = Number(attr(tag, 'cx') ?? 0)
    const cy = Number(attr(tag, 'cy') ?? 0)
    const rx = Number(attr(tag, 'rx') ?? 0)
    const ry = Number(attr(tag, 'ry') ?? 0)
    if (rx > 0 && ry > 0) found.push(circlePoints(cx, cy, rx, ry))
  }
  for (const tag of tagsOf(svg, 'rect')) {
    const x = Number(attr(tag, 'x') ?? 0)
    const y = Number(attr(tag, 'y') ?? 0)
    const w = Number(attr(tag, 'width') ?? 0)
    const h = Number(attr(tag, 'height') ?? 0)
    if (w > 0 && h > 0) {
      found.push([
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h }
      ])
    }
  }
  const pathRe = /<path\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = pathRe.exec(svg))) {
    const d = attr(m[0], 'd')
    if (!d) continue
    const pts = pathPoints(d)
    if (pts.length >= 3) found.push(pts)
  }
  return found
}

function normalize(radii: number[], max = 1): number[] {
  const peak = Math.max(...radii)
  if (peak <= 0) return radii
  const k = max / peak
  return radii.map((r) => r * k)
}

/**
 * Convertit un SVG en 64 rayons. `null` si aucun contour ferme n'est lisible.
 */
export function profileFromSvg(svg: string): number[] | null {
  const contours = contoursOf(svg)
  if (!contours.length) return null
  let best = contours[0]!
  let bestA = area(best)
  for (const c of contours.slice(1)) {
    const a = area(c)
    if (a > bestA) {
      best = c
      bestA = a
    }
  }
  if (best.length < 3) return null
  const c = centroid(best)
  const radii = profileFromPolygon(best, c.x, c.y)
  if (radii.length !== PROFILE_SAMPLES) return null
  if (Math.max(...radii) <= 0) return null
  return normalize(radii)
}
