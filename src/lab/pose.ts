import type { Look } from '@/bot/engine'
import {
  DEFAULT_EXPRESSION,
  EXPRESSION_BY_ID,
  type BotExpression,
  type ExpressionId
} from '@/bot/expressions'
import { EYE_H, EYE_SPLIT, EYE_W, REST_GAZE } from '@/bot/face'
import { DEFAULT_COLOR, DEFAULT_SHAPE } from '@/bot/skins'
import type { EyeCfg } from '@/bot/states'
import type { ExpressionDef, LabDraft } from './types'

const EPS = 1e-4

export const LAB_RANGE = {
  yaw: { min: -40, max: 50 },
  pitch: { min: -30, max: 40 },
  roll: { min: -30, max: 30 },
  split: { min: 8, max: 25 },
  w: { min: 0.08, max: 0.55 },
  h: { min: 0.08, max: 0.7 },
  tilt: { min: -80, max: 80 },
  open: { min: 0, max: 1 }
} as const

function copyEye(e: EyeCfg): EyeCfg {
  return { w: e.w, h: e.h, open: e.open, tilt: e.tilt ?? 0 }
}

function mirrorOf(e: EyeCfg): EyeCfg {
  return { w: e.w, h: e.h, open: e.open, tilt: -(e.tilt ?? 0) }
}

export function eyesLinked(eyes: [EyeCfg, EyeCfg]): boolean {
  const [a, b] = eyes
  return (
    Math.abs(a.w - b.w) < EPS &&
    Math.abs(a.h - b.h) < EPS &&
    Math.abs(a.open - b.open) < EPS &&
    Math.abs((a.tilt ?? 0) + (b.tilt ?? 0)) < EPS
  )
}

export function draftFromExpression(
  expr: BotExpression,
  shapeId = DEFAULT_SHAPE,
  colorId = DEFAULT_COLOR
): LabDraft {
  const eyes: [EyeCfg, EyeCfg] = [copyEye(expr.eyes[0]!), copyEye(expr.eyes[1]!)]
  return {
    shapeId,
    colorId,
    presetId: expr.id,
    gaze: { ...expr.gaze },
    split: expr.split,
    eyes,
    eyesLinked: eyesLinked(eyes),
    freezeGaze: true,
    radii: null,
    parts: []
  }
}

export function defaultDraft(shapeId = DEFAULT_SHAPE, colorId = DEFAULT_COLOR): LabDraft {
  const expr = EXPRESSION_BY_ID.get(DEFAULT_EXPRESSION)!
  return draftFromExpression(expr, shapeId, colorId)
}

export function applyPreset(draft: LabDraft, expr: BotExpression): LabDraft {
  const eyes: [EyeCfg, EyeCfg] = [copyEye(expr.eyes[0]!), copyEye(expr.eyes[1]!)]
  return {
    ...draft,
    presetId: expr.id,
    gaze: { ...expr.gaze },
    split: expr.split,
    eyes,
    eyesLinked: eyesLinked(eyes)
  }
}

export function expressionFromDraft(draft: LabDraft): BotExpression {
  const id = (EXPRESSION_BY_ID.has(draft.presetId) ? draft.presetId : DEFAULT_EXPRESSION) as ExpressionId
  return {
    id,
    gaze: { ...draft.gaze },
    split: draft.split,
    eyes: [copyEye(draft.eyes[0]), copyEye(draft.eyes[1])]
  }
}

export function defFromDraft(draft: LabDraft): ExpressionDef {
  const bot = expressionFromDraft(draft)
  return {
    id: draft.presetId,
    gaze: bot.gaze,
    split: bot.split,
    eyes: bot.eyes
  }
}

/**
 * Regard impose par les curseurs. `null` laisse la derive du moteur : c'est le
 * bouton « figer le regard » qui tranche.
 */
export function lookFromDraft(draft: LabDraft): Look | null {
  if (!draft.freezeGaze) return null
  return {
    yaw: draft.gaze.yaw,
    pitch: draft.gaze.pitch,
    mix: 1,
    spin: 0,
    wander: 0
  }
}

export function setEye(
  draft: LabDraft,
  side: 0 | 1,
  patch: Partial<EyeCfg>
): LabDraft {
  const eyes: [EyeCfg, EyeCfg] = [copyEye(draft.eyes[0]), copyEye(draft.eyes[1])]
  eyes[side] = { ...eyes[side]!, ...patch }
  if (draft.eyesLinked) {
    const src = eyes[side]!
    eyes[side === 0 ? 1 : 0] = mirrorOf(src)
  }
  return { ...draft, eyes }
}

export const REST_NUMBERS = {
  gaze: REST_GAZE,
  split: EYE_SPLIT,
  eye: { w: EYE_W, h: EYE_H }
} as const
