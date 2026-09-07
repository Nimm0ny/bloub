import { describe, expect, it } from 'vitest'
import { MIN_BLOCK } from '@/bot/cycles'
import { SEQUENCE, STATE_BY_ID } from '@/bot/states'
import {
  durationOfMotion,
  MOTION_BY_ID,
  MOTION_CATALOG,
  motionToBlocks,
  sampleMotion
} from './motions'

describe('MotionDef', () => {
  it('enveloppe chaque etat du SEQUENCE', () => {
    for (const id of SEQUENCE) {
      expect(MOTION_BY_ID.get(`state-${id}`)?.primitives[0]).toEqual({ type: 'state', state: id })
    }
  })

  it('ne reecrit pas les durees mesurees des etats', () => {
    for (const id of SEQUENCE) {
      const blocks = motionToBlocks(MOTION_BY_ID.get(`state-${id}`)!)
      expect(blocks).toHaveLength(1)
      expect(blocks[0]!.state).toBe(id)
      expect(blocks[0]!.duration).toBe(STATE_BY_ID.get(id)!.duration)
    }
  })

  it('tient un plancher de bloc, comme le lecteur', () => {
    const blocks = motionToBlocks({
      id: 'x',
      name: 'x',
      loop: false,
      primitives: [{ type: 'state', state: 'idle', duration: 0.1 }]
    })
    expect(blocks[0]!.duration).toBe(MIN_BLOCK)
  })

  it('sample est une fonction pure du temps', () => {
    const def = MOTION_BY_ID.get('think')!
    expect(sampleMotion(def, 0.3)).toEqual(sampleMotion(def, 0.3))
    expect(sampleMotion(def, 0).state).toBe('thinking')
  })

  it('boucle quand le mouvement le demande', () => {
    const def = MOTION_BY_ID.get('rest')!
    const total = durationOfMotion(def)
    expect(sampleMotion(def, 0).state).toBe(sampleMotion(def, total).state)
    expect(sampleMotion(def, total + 0.01).state).toBe('idle')
  })

  it('pose le visage attentif sur le repos pour write', () => {
    const def = MOTION_BY_ID.get('write')!
    const s = sampleMotion(def, 0.1)
    expect(s.state).toBe('idle')
    expect(s.expressionId).toBe('attentif')
    const blocks = motionToBlocks(def)
    expect(blocks.every((b) => b.state === 'idle')).toBe(true)
  })

  it('le catalogue a des identifiants uniques', () => {
    const ids = MOTION_CATALOG.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
