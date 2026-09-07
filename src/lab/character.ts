import {
  DEFAULT_EXPRESSION,
  EXPRESSIONS,
  EXPRESSION_BY_ID,
  type BotExpression,
  type ExpressionId
} from '@/bot/expressions'
import { COLOR_BY_ID, DEFAULT_COLOR, DEFAULT_SHAPE, SHAPE_BY_ID, type ShapeId } from '@/bot/skins'
import { PROFILE_SAMPLES } from '@/bot/profiles'
import type { CharacterDef, ExpressionDef } from './types'
import { parsePart, type PartDef } from '@/bot/parts'

function copyEye(e: BotExpression['eyes'][number]): ExpressionDef['eyes'][number] {
  // `pair(w, h, 0)` produit un `tilt: -0` sur l'oeil droit ; JSON le rend `0`.
  return { w: e.w, h: e.h, open: e.open, tilt: e.tilt ? e.tilt : 0 }
}

function copyExpression(e: BotExpression): ExpressionDef {
  return {
    id: e.id,
    gaze: { ...e.gaze },
    split: e.split,
    eyes: [copyEye(e.eyes[0]!), copyEye(e.eyes[1]!)]
  }
}

/**
 * Personnage par defaut : le bloub du catalogue, mesures inchangees.
 *
 * P2 enveloppe les tableaux existants. On ne reecrit aucune constante.
 */
export function characterFromCatalog(
  shapeId: string = DEFAULT_SHAPE,
  colorId: string = DEFAULT_COLOR,
  rest: string = DEFAULT_EXPRESSION
): CharacterDef {
  const shape = SHAPE_BY_ID.has(shapeId) ? (shapeId as ShapeId) : DEFAULT_SHAPE
  return {
    id: 'bloub',
    name: 'bloub',
    body: { kind: 'catalog', id: shape },
    color: COLOR_BY_ID.has(colorId) ? colorId : DEFAULT_COLOR,
    restExpression: EXPRESSION_BY_ID.has(rest) ? rest : DEFAULT_EXPRESSION,
    expressions: EXPRESSIONS.map(copyExpression)
  }
}

export const DEFAULT_CHARACTER: CharacterDef = characterFromCatalog()

function knownColor(id: string) {
  return COLOR_BY_ID.has(id) || /^#[0-9a-fA-F]{6}$/.test(id)
}

/** Profil radial effectif, ou null pour le cercle mesure du moteur. */
export function radiiOf(character: CharacterDef): number[] | null {
  if (character.body.kind === 'profile') {
    return character.body.radii.length === PROFILE_SAMPLES ? character.body.radii : null
  }
  return SHAPE_BY_ID.get(character.body.id)?.radii ?? null
}

/**
 * Repasse une ExpressionDef dans le type du moteur. Un id hors catalogue retombe
 * sur `neutre` pour l'eyefit (table indexee par les 16 humeurs), sans perdre le
 * visage saisi.
 */
export function expressionDefToBot(def: ExpressionDef): BotExpression {
  const id = (EXPRESSION_BY_ID.has(def.id) ? def.id : DEFAULT_EXPRESSION) as ExpressionId
  return {
    id,
    gaze: { ...def.gaze },
    split: def.split,
    eyes: [{ ...def.eyes[0]! }, { ...def.eyes[1]! }]
  }
}

function isFiniteGaze(v: unknown): v is ExpressionDef['gaze'] {
  if (typeof v !== 'object' || v === null) return false
  const g = v as Record<string, unknown>
  return [g.yaw, g.pitch, g.roll].every((n) => typeof n === 'number' && Number.isFinite(n))
}

function isEye(v: unknown): v is ExpressionDef['eyes'][number] {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Record<string, unknown>
  return (
    typeof e.w === 'number' &&
    typeof e.h === 'number' &&
    typeof e.open === 'number' &&
    Number.isFinite(e.w + e.h + e.open)
  )
}

function parseExpression(raw: unknown): ExpressionDef | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || !o.id) return null
  if (!isFiniteGaze(o.gaze)) return null
  if (typeof o.split !== 'number' || !Number.isFinite(o.split)) return null
  const eyes = o.eyes
  if (!Array.isArray(eyes) || eyes.length !== 2 || !isEye(eyes[0]) || !isEye(eyes[1])) return null
  const a = eyes[0]
  const b = eyes[1]
  return {
    id: o.id,
    gaze: { yaw: o.gaze.yaw, pitch: o.gaze.pitch, roll: o.gaze.roll },
    split: o.split,
    eyes: [
      { w: a.w, h: a.h, open: a.open, tilt: a.tilt ? a.tilt : 0 },
      { w: b.w, h: b.h, open: b.open, tilt: b.tilt ? b.tilt : 0 }
    ]
  }
}

function parseBody(raw: unknown): CharacterDef['body'] | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  if (o.kind === 'catalog' && typeof o.id === 'string' && SHAPE_BY_ID.has(o.id)) {
    return { kind: 'catalog', id: o.id as ShapeId }
  }
  if (o.kind === 'profile' && Array.isArray(o.radii) && o.radii.length === PROFILE_SAMPLES) {
    const radii = o.radii.map((n) => (typeof n === 'number' && Number.isFinite(n) ? n : 0))
    if (radii.every((r) => r >= 0) && Math.max(...radii) > 0) return { kind: 'profile', radii }
  }
  return null
}

/** Lecture GARDEE : un JSON hostile ne doit pas casser le laboratoire. */
export function parseCharacter(raw: unknown): CharacterDef | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.name !== 'string') return null
  const body = parseBody(o.body)
  if (!body) return null
  if (typeof o.color !== 'string' || !knownColor(o.color)) return null
  if (typeof o.restExpression !== 'string') return null
  if (!Array.isArray(o.expressions)) return null
  const expressions = o.expressions.map(parseExpression).filter((e): e is ExpressionDef => e !== null)
  if (!expressions.length) return null
  const parts = Array.isArray(o.parts)
    ? o.parts.map(parsePart).filter((p): p is PartDef => p !== null)
    : undefined
  return {
    id: o.id,
    name: o.name,
    body,
    color: o.color,
    restExpression: o.restExpression,
    expressions,
    ...(parts?.length ? { parts } : {})
  }
}

export function serializeCharacter(character: CharacterDef): string {
  return JSON.stringify(character)
}
