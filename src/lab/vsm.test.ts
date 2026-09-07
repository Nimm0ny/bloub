import { describe, expect, it } from 'vitest'
import { MOTION_BY_ID } from './motions'
import { AGENT_EVENTS, DEFAULT_VSM, motionIdOf, stepVsm, visualOf } from './vsm'

describe('machine d etats visuels', () => {
  it('part du repos', () => {
    expect(DEFAULT_VSM.initial).toBe('rest')
    expect(visualOf(DEFAULT_VSM, 'rest')?.motion).toBe('rest')
  })

  it('chaque etat visuel pointe un mouvement du catalogue', () => {
    for (const s of DEFAULT_VSM.states) {
      expect(MOTION_BY_ID.has(s.motion), s.motion).toBe(true)
    }
  })

  it('notice depuis le repos, idle y ramene', () => {
    expect(stepVsm(DEFAULT_VSM, 'rest', 'notice')).toBe('notice')
    expect(stepVsm(DEFAULT_VSM, 'notice', 'idle')).toBe('rest')
  })

  it('think et write sont deux etats distincts', () => {
    expect(stepVsm(DEFAULT_VSM, 'rest', 'think')).toBe('think')
    expect(stepVsm(DEFAULT_VSM, 'rest', 'write')).toBe('write')
    expect(motionIdOf(DEFAULT_VSM, 'think')).toBe('think')
    expect(motionIdOf(DEFAULT_VSM, 'write')).toBe('write')
  })

  it('un evenement non branche laisse l etat courant', () => {
    expect(stepVsm(DEFAULT_VSM, 'sleep', 'write')).toBe('sleep')
  })

  it('idle sans arc explicite ramene au repos', () => {
    expect(stepVsm(DEFAULT_VSM, 'inconnu', 'idle')).toBe('rest')
  })

  it('expose les huit evenements d agent', () => {
    expect(AGENT_EVENTS).toHaveLength(8)
  })
})
