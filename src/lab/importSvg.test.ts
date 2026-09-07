import { describe, expect, it } from 'vitest'
import { PROFILE_SAMPLES } from '@/bot/profiles'
import { profileFromSvg } from './importSvg'

describe('import SVG -> profil 64 points', () => {
  it('refuse un SVG sans contour', () => {
    expect(profileFromSvg('<svg></svg>')).toBeNull()
    expect(profileFromSvg('pas du svg')).toBeNull()
  })

  it('fait un cercle de rayons egaux, normalises a 1', () => {
    const r = profileFromSvg(
      '<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="80" /></svg>'
    )
    expect(r).toHaveLength(PROFILE_SAMPLES)
    const peak = Math.max(...r!)
    const floor = Math.min(...r!)
    expect(peak).toBeCloseTo(1, 5)
    expect(floor).toBeGreaterThan(0.98)
  })

  it('lit un polygone carre', () => {
    const r = profileFromSvg(
      '<svg><polygon points="1,-1 1,1 -1,1 -1,-1" /></svg>'
    )
    expect(r).toHaveLength(PROFILE_SAMPLES)
    expect(Math.max(...r!)).toBeCloseTo(1, 5)
    // diagonale plus longue que les axes
    const right = r![0]!
    const diag = r![8]!
    expect(diag).toBeGreaterThan(right)
  })

  it('lit un path cubique ferme', () => {
    const r = profileFromSvg(
      '<svg><path d="M 10 0 C 10 5.5 5.5 10 0 10 C -5.5 10 -10 5.5 -10 0 C -10 -5.5 -5.5 -10 0 -10 C 5.5 -10 10 -5.5 10 0 Z" /></svg>'
    )
    expect(r).toHaveLength(PROFILE_SAMPLES)
    expect(Math.max(...r!)).toBeCloseTo(1, 5)
    expect(Math.min(...r!)).toBeGreaterThan(0.85)
  })

  it('prend le plus grand contour s il y en a plusieurs', () => {
    const r = profileFromSvg(
      '<svg><circle cx="0" cy="0" r="1" /><circle cx="0" cy="0" r="5" /></svg>'
    )
    expect(r).toHaveLength(PROFILE_SAMPLES)
    expect(Math.max(...r!)).toBeCloseTo(1, 5)
  })

  it('lit un rect', () => {
    const r = profileFromSvg('<svg><rect x="0" y="0" width="4" height="2" /></svg>')
    expect(r).toHaveLength(PROFILE_SAMPLES)
    expect(Math.max(...r!)).toBeCloseTo(1, 5)
  })
})
