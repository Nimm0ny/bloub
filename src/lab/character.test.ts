import { describe, expect, it } from 'vitest'
import { EXPRESSIONS } from '@/bot/expressions'
import { PROFILE_SAMPLES } from '@/bot/profiles'
import { DEFAULT_SHAPE, SHAPE_BY_ID } from '@/bot/skins'
import {
  characterFromCatalog,
  DEFAULT_CHARACTER,
  expressionDefToBot,
  parseCharacter,
  radiiOf,
  serializeCharacter
} from './character'

describe('CharacterDef', () => {
  it('enveloppe le catalogue sans en changer les mesures', () => {
    expect(DEFAULT_CHARACTER.expressions).toHaveLength(EXPRESSIONS.length)
    expect(DEFAULT_CHARACTER.expressions.map((e) => e.id)).toEqual(EXPRESSIONS.map((e) => e.id))
    const neutre = DEFAULT_CHARACTER.expressions.find((e) => e.id === 'neutre')!
    const src = EXPRESSIONS.find((e) => e.id === 'neutre')!
    expect(neutre.gaze).toEqual(src.gaze)
    expect(neutre.split).toBe(src.split)
    expect(neutre.eyes).toEqual(src.eyes)
  })

  it('reprend la forme et la couleur demandees si elles existent', () => {
    const c = characterFromCatalog('capsule', 'bleu', 'heureux')
    expect(c.body).toEqual({ kind: 'catalog', id: 'capsule' })
    expect(c.color).toBe('bleu')
    expect(c.restExpression).toBe('heureux')
  })

  it('ignore un id de forme inconnu', () => {
    const c = characterFromCatalog('licorne', 'bleu')
    expect(c.body).toEqual({ kind: 'catalog', id: DEFAULT_SHAPE })
  })

  it('survives a un aller-retour JSON', () => {
    const json = serializeCharacter(DEFAULT_CHARACTER)
    const back = parseCharacter(JSON.parse(json))
    expect(back).toEqual(DEFAULT_CHARACTER)
  })

  it('refuse un JSON hostile', () => {
    expect(parseCharacter(null)).toBeNull()
    expect(parseCharacter({ id: 'x' })).toBeNull()
    expect(parseCharacter({ ...DEFAULT_CHARACTER, expressions: [] })).toBeNull()
    expect(parseCharacter({ ...DEFAULT_CHARACTER, color: 'not-a-color' })).toBeNull()
  })

  it('accepte un profil radial custom de 64 points', () => {
    const radii = new Array(PROFILE_SAMPLES).fill(0).map((_, i) => 1 + 0.05 * Math.sin(i))
    const parsed = parseCharacter({
      ...DEFAULT_CHARACTER,
      body: { kind: 'profile', radii }
    })
    expect(parsed?.body).toEqual({ kind: 'profile', radii })
    expect(radiiOf(parsed!)?.length).toBe(PROFILE_SAMPLES)
  })

  it('retombe sur neutre pour l eyefit d une expression hors catalogue', () => {
    const bot = expressionDefToBot({
      id: 'maison',
      gaze: { yaw: 1, pitch: 2, roll: 3 },
      split: 18,
      eyes: [
        { w: 0.2, h: 0.3, open: 1, tilt: 4 },
        { w: 0.2, h: 0.3, open: 1, tilt: -4 }
      ]
    })
    expect(bot.id).toBe('neutre')
    expect(bot.gaze.roll).toBe(3)
    expect(bot.split).toBe(18)
  })

  it('lit le profil d une forme du catalogue', () => {
    const c = characterFromCatalog('goutte')
    expect(radiiOf(c)).toBe(SHAPE_BY_ID.get('goutte')!.radii)
  })
})
