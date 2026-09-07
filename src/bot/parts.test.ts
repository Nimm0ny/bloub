import { describe, expect, it } from 'vitest'
import { BotEngine } from './engine'
import {
  KIRBY_PARTS,
  defaultPart,
  parsePart,
  parsePartsList,
  projectParts,
  sphericalPoint
} from './parts'
import { PROFILE_SAMPLES } from './profiles'

function footprint(d: string) {
  const xs: number[] = []
  const ys: number[] = []
  const head = /^M(-?[\d.]+) (-?[\d.]+)/.exec(d)
  if (head) {
    xs.push(+head[1]!)
    ys.push(+head[2]!)
  }
  for (const seg of d.matchAll(/C[-\d. ]+? (-?[\d.]+) (-?[\d.]+)(?=C|Z)/g)) {
    xs.push(+seg[1]!)
    ys.push(+seg[2]!)
  }
  return {
    cx: (Math.min(...xs) + Math.max(...xs)) / 2,
    cy: (Math.min(...ys) + Math.max(...ys)) / 2,
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys)
  }
}

describe('primitives de pieces', () => {
  it('projette une sphere en cercle de rayon attendu', () => {
    const part = defaultPart('ellipsoid', 'ball')
    part.primitive = { type: 'ellipsoid', size: [0.5, 0.5, 0.5] }
    part.transform.position = [0, 0, -0.1]
    part.transform.rotation = [0, 0, 0]
    const { back } = projectParts([part], { scale: 100, offX: 0, offY: 0, alpha: 1 })
    expect(back).toHaveLength(1)
    const f = footprint(back[0]!.path)
    expect(f.w / 100).toBeCloseTo(1, 1)
    expect(f.h / 100).toBeCloseTo(1, 1)
    expect(Math.abs(f.w - f.h) / 100).toBeLessThan(0.04)
  })

  it('place les bras de Kirby de part et d autre, derriere le corps', () => {
    const { back, front } = projectParts(KIRBY_PARTS, {
      scale: 100,
      offX: 0,
      offY: 0,
      alpha: 1
    })
    expect(front).toHaveLength(0)
    expect(back).toHaveLength(2)
    const left = footprint(back.find((p) => p.id === 'arm-left')!.path)
    const right = footprint(back.find((p) => p.id === 'arm-right')!.path)
    expect(left.cx).toBeLessThan(0)
    expect(right.cx).toBeGreaterThan(0)
    expect(left.cy).toBeGreaterThan(0)
    expect(right.cy).toBeGreaterThan(0)
  })

  it('une capsule produit un trait plus long que large', () => {
    const part = defaultPart('capsule', 'limb')
    part.transform.position = [0, 0, 0.1]
    part.transform.rotation = [0, 0, 0]
    const { front } = projectParts([part], { scale: 100, offX: 0, offY: 0, alpha: 1 })
    const f = footprint(front[0]!.path)
    expect(f.w).toBeGreaterThan(f.h)
  })

  it('un profil radial a 64 points se ferme', () => {
    const part = defaultPart('radial', 'blob')
    expect(part.primitive.type).toBe('radial')
    if (part.primitive.type === 'radial') {
      expect(part.primitive.radii).toHaveLength(PROFILE_SAMPLES)
    }
    const { back } = projectParts([part], { scale: 100, offX: 0, offY: 0, alpha: 1 })
    expect(back[0]!.path.startsWith('M')).toBe(true)
    expect(back[0]!.path.endsWith('Z') || /Z$/.test(back[0]!.path)).toBe(true)
  })

  it('l ancre spherique pose un point a yaw 0 sur +z', () => {
    const p = sphericalPoint(0, 0, 1)
    expect(p[0]).toBeCloseTo(0, 5)
    expect(p[1]).toBeCloseTo(0, 5)
    expect(p[2]).toBeCloseTo(1, 5)
    const right = sphericalPoint(90, 0, 1)
    expect(right[0]).toBeCloseTo(1, 5)
  })

  it('parse une liste de pieces, ignore les entrees hostiles', () => {
    expect(parsePartsList(null)).toEqual([])
    expect(parsePartsList([KIRBY_PARTS[0], { id: 'x' }, KIRBY_PARTS[1]])).toHaveLength(2)
  })

  it('parse une piece hostile en null, une piece Kirby en identite', () => {
    expect(parsePart(null)).toBeNull()
    expect(parsePart({ id: 'x' })).toBeNull()
    const back = parsePart(KIRBY_PARTS[0])
    expect(back?.id).toBe('arm-left')
    expect(back?.primitive.type).toBe('ellipsoid')
  })
})

describe('moteur avec pieces', () => {
  it('sans pieces, le corps reste celui du moteur nu', () => {
    const nu = new BotEngine(100, 'idle')
    const avec = new BotEngine(100, 'idle')
    avec.setParts([])
    expect(avec.sample(0.5).bodyPath).toBe(nu.sample(0.5).bodyPath)
    expect(avec.sample(0.5).partsBack).toEqual([])
    expect(avec.sample(0.5).partsFront).toEqual([])
  })

  it('pose les bras de Kirby derriere le corps au repos', () => {
    const e = new BotEngine(100, 'idle')
    e.setParts(KIRBY_PARTS)
    const f = e.sample(0.5)
    expect(f.partsBack).toHaveLength(2)
    expect(f.partsFront).toHaveLength(0)
    expect(f.bodyPath.length).toBeGreaterThan(10)
  })

  it('n affiche pas les pieces sur un etat sans corps de repos', () => {
    const e = new BotEngine(100, 'alert')
    e.setParts(KIRBY_PARTS)
    const f = e.sample(0.8)
    expect(f.partsBack).toEqual([])
    expect(f.partsFront).toEqual([])
  })
})
