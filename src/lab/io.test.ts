import { describe, expect, it } from 'vitest'
import { cloneParts, KIRBY_PARTS } from '@/bot/parts'
import { defaultDraft } from './pose'
import { applyCharacter, characterFromDraft, importCharacter, packCharacter } from './io'

describe('export / import de personnage', () => {
  it('fait un aller-retour de Kirby dans le JSON de bloub', () => {
    const draft = defaultDraft()
    draft.parts = cloneParts(KIRBY_PARTS)
    draft.shapeId = 'cercle'
    const packed = packCharacter(characterFromDraft(draft, 'Kirby'))
    const back = importCharacter(JSON.parse(packed))
    expect(back?.name).toBe('Kirby')
    expect(back?.body).toEqual({ kind: 'catalog', id: 'cercle' })
    expect(back?.parts).toHaveLength(2)
    expect(back?.parts?.[0]?.id).toBe('arm-left')
    expect(back?.parts?.[1]?.primitive.type).toBe('ellipsoid')
    const applied = applyCharacter(defaultDraft(), back!)
    expect(applied.parts).toHaveLength(2)
    expect(applied.shapeId).toBe('cercle')
    expect(applied.parts[0]?.bindTransform.position[0]).toBeCloseTo(
      KIRBY_PARTS[0]!.bindTransform.position[0]
    )
  })

  it('refuse un JSON qui n est pas le format bloub', () => {
    expect(importCharacter(null)).toBeNull()
    expect(importCharacter({ foo: 1 })).toBeNull()
    expect(importCharacter({ format: 'avatar-export', avatar: { name: 'Kirby' } })).toBeNull()
  })
})
