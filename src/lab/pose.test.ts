import { describe, expect, it } from 'vitest'
import { EXPRESSION_BY_ID } from '@/bot/expressions'
import { REST_GAZE } from '@/bot/face'
import {
  applyPreset,
  defaultDraft,
  draftFromExpression,
  expressionFromDraft,
  eyesLinked,
  lookFromDraft,
  setEye
} from './pose'

describe('brouillon du laboratoire', () => {
  it('part du neutre mesure', () => {
    const d = defaultDraft()
    expect(d.presetId).toBe('neutre')
    expect(d.gaze).toEqual(REST_GAZE)
    expect(d.freezeGaze).toBe(true)
    expect(d.eyesLinked).toBe(true)
  })

  it('reconstruit une BotExpression fidele au preset', () => {
    const src = EXPRESSION_BY_ID.get('colere')!
    const d = draftFromExpression(src, 'cercle', 'encre')
    const back = expressionFromDraft(d)
    expect(back.id).toBe('colere')
    expect(back.gaze).toEqual(src.gaze)
    expect(back.split).toBe(src.split)
    expect(back.eyes[0]).toMatchObject({ w: src.eyes[0]!.w, h: src.eyes[0]!.h })
  })

  it('fige le regard quand on le demande, et le relache sinon', () => {
    const d = defaultDraft()
    const look = lookFromDraft(d)!
    expect(look.mix).toBe(1)
    expect(look.wander).toBe(0)
    expect(look.yaw).toBe(d.gaze.yaw)
    expect(lookFromDraft({ ...d, freezeGaze: false })).toBeNull()
  })

  it('miroir les yeux lies, et laisse les autres independants', () => {
    const d = defaultDraft()
    const linked = setEye(d, 0, { w: 0.3, tilt: 20 })
    expect(linked.eyes[1]!.w).toBe(0.3)
    expect(linked.eyes[1]!.tilt).toBe(-20)
    const split = setEye({ ...d, eyesLinked: false }, 0, { w: 0.3, tilt: 20 })
    expect(split.eyes[1]!.w).toBe(d.eyes[1]!.w)
    expect(split.eyes[1]!.tilt).toBe(d.eyes[1]!.tilt)
  })

  it('reconnait une expression dissymetrique comme non liee', () => {
    const mefiant = EXPRESSION_BY_ID.get('mefiant')!
    expect(eyesLinked(mefiant.eyes)).toBe(false)
    expect(draftFromExpression(mefiant).eyesLinked).toBe(false)
  })

  it('un preset ecrase les curseurs', () => {
    const d = defaultDraft()
    d.gaze.yaw = 0
    d.split = 10
    const next = applyPreset(d, EXPRESSION_BY_ID.get('surpris')!)
    expect(next.presetId).toBe('surpris')
    expect(next.split).toBe(EXPRESSION_BY_ID.get('surpris')!.split)
    expect(next.gaze).toEqual(EXPRESSION_BY_ID.get('surpris')!.gaze)
  })
})
