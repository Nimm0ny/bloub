import { describe, expect, it } from 'vitest'
import { BotEngine } from './engine'
import {
  KIRBY_PARTS,
  composePart,
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
    part.bindTransform.position = [0, 0, -0.1]
    part.bindTransform.rotation = [0, 0, 0]
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
    part.bindTransform.position = [0, 0, 0.1]
    part.bindTransform.rotation = [0, 0, 0]
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

describe('invariants du rig', () => {
  function core(f: ReturnType<BotEngine['sample']>) {
    const { partsBack: _b, partsFront: _f, ...rest } = f
    return rest
  }

  it('parts vides : sample identique au moteur nu', () => {
    const nu = new BotEngine(100, 'idle')
    const vide = new BotEngine(100, 'idle')
    vide.setParts([])
    for (const t of [0, 0.4, 1.2, 2.7]) {
      expect(core(vide.sample(t))).toEqual(core(nu.sample(t)))
    }
  })

  it('Kirby ne change pas le bodyPath du repos', () => {
    const nu = new BotEngine(100, 'idle')
    const k = new BotEngine(100, 'idle')
    k.setParts(KIRBY_PARTS)
    expect(k.sample(0.5).bodyPath).toBe(nu.sample(0.5).bodyPath)
  })

  it('offX/offY deplacent ellipsoid, capsule et radial ensemble', () => {
    const kinds = ['ellipsoid', 'capsule', 'radial'] as const
    for (const kind of kinds) {
      const p = defaultPart(kind, kind)
      p.bindTransform.position = [0.4, 0.1, -0.05]
      const a = projectParts([p], { scale: 100, offX: 0, offY: 0, alpha: 1 })
      const b = projectParts([p], { scale: 100, offX: 0.2, offY: 0.1, alpha: 1 })
      const fa = footprint((a.back[0] ?? a.front[0])!.path)
      const fb = footprint((b.back[0] ?? b.front[0])!.path)
      expect(fb.cx - fa.cx, kind).toBeCloseTo(20, 0)
      expect(fb.cy - fa.cy, kind).toBeCloseTo(10, 0)
    }
  })

  it('la pose s ajoute au bind, elle ne le remplace pas', () => {
    const p = defaultPart('ellipsoid', 'arm')
    p.bindTransform.rotation = [0, 0, 15]
    const w = composePart(p, { rotation: [0, 0, 25] })
    expect(w.rotation[2]).toBeCloseTo(40, 5)
  })

  it('l ancre s ajoute au bind, elle ne le remplace pas', () => {
    const p = defaultPart('ellipsoid', 'hand')
    p.anchor = { parent: 'body', spherical: { yaw: 90, pitch: 0, radius: 1 } }
    p.bindTransform.position = [0.12, 0, 0]
    const w = composePart(p)
    expect(w.position[0]).toBeCloseTo(1.12, 5)
    expect(w.position[2]).toBeCloseTo(0, 5)
  })

  it('une rotation Z continue ne produit pas de NaN', () => {
    const p = defaultPart('ellipsoid', 'spin')
    const widths: number[] = []
    for (const z of [0, 20, 40, 60]) {
      p.bindTransform.rotation = [0, 0, z]
      const { back, front } = projectParts([p], { scale: 100, offX: 0, offY: 0, alpha: 1 })
      const path = (back[0] ?? front[0])!.path
      expect(path.includes('NaN')).toBe(false)
      widths.push(footprint(path).w)
    }
    expect(widths[0]).not.toBe(widths[2])
  })

  it('le passage de Z negatif a positif change de couche sans saut de position', () => {
    const p = defaultPart('ellipsoid', 'flip')
    p.bindTransform.position = [0.5, 0, -0.01]
    const behind = projectParts([p], { scale: 100, offX: 0, offY: 0, alpha: 1 })
    p.bindTransform.position = [0.5, 0, 0.01]
    const ahead = projectParts([p], { scale: 100, offX: 0, offY: 0, alpha: 1 })
    expect(behind.back).toHaveLength(1)
    expect(ahead.front).toHaveLength(1)
    const a = footprint(behind.back[0]!.path)
    const b = footprint(ahead.front[0]!.path)
    expect(Math.abs(a.cx - b.cx)).toBeLessThan(0.5)
    expect(Math.abs(a.cy - b.cy)).toBeLessThan(0.5)
  })

  it('sample ne depend pas de l ordre des lectures', () => {
    const e = new BotEngine(100, 'idle')
    e.setParts(KIRBY_PARTS)
    e.sample(1.4)
    const mid = e.sample(0.5).partsBack[0]!.path
    const other = new BotEngine(100, 'idle')
    other.setParts(KIRBY_PARTS)
    expect(other.sample(0.5).partsBack[0]!.path).toBe(mid)
  })

  it('PartPose animee se recalcule au rewind, sans la pose precedente', () => {
    const motion = {
      sample(t: number) {
        return { 'arm-right': { rotation: [0, 0, t * 40] as [number, number, number] } }
      }
    }
    const e = new BotEngine(100, 'idle')
    e.setParts(KIRBY_PARTS)
    e.setPartMotion(motion, 0)
    e.sample(1.4)
    const rewound = e.sample(0.5)
    const fresh = new BotEngine(100, 'idle')
    fresh.setParts(KIRBY_PARTS)
    fresh.setPartMotion(motion, 0)
    expect(rewound.partsBack.find((p) => p.id === 'arm-right')!.path).toBe(
      fresh.sample(0.5).partsBack.find((p) => p.id === 'arm-right')!.path
    )
    expect(rewound.partsBack.find((p) => p.id === 'arm-right')!.path).not.toBe(
      fresh.sample(1.4).partsBack.find((p) => p.id === 'arm-right')!.path
    )
  })
})
