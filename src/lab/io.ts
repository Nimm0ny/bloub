import { cloneParts } from '@/bot/parts'
import { DEFAULT_EXPRESSION, EXPRESSION_BY_ID } from '@/bot/expressions'
import { DEFAULT_SHAPE, SHAPE_BY_ID, type ShapeId } from '@/bot/skins'
import { DEFAULT_CHARACTER, parseCharacter } from './character'
import type { CharacterDef, LabDraft } from './types'
import { applyPreset } from './pose'

export const BLOUB_FORMAT = 'bloub-character'
export const BLOUB_VERSION = 1

export function characterFromDraft(draft: LabDraft, name = 'bloub'): CharacterDef {
  const body: CharacterDef['body'] =
    draft.radii && draft.radii.length
      ? { kind: 'profile', radii: [...draft.radii] }
      : {
          kind: 'catalog',
          id: (SHAPE_BY_ID.has(draft.shapeId) ? draft.shapeId : DEFAULT_SHAPE) as ShapeId
        }
  const rest = EXPRESSION_BY_ID.has(draft.presetId) ? draft.presetId : DEFAULT_EXPRESSION
  return {
    id: slug(name),
    name,
    body,
    color: draft.colorId,
    restExpression: rest,
    expressions: DEFAULT_CHARACTER.expressions,
    ...(draft.parts.length ? { parts: cloneParts(draft.parts) } : {})
  }
}

export function packCharacter(character: CharacterDef): string {
  return JSON.stringify(
    { format: BLOUB_FORMAT, version: BLOUB_VERSION, ...character },
    null,
    2
  )
}

export function applyCharacter(draft: LabDraft, character: CharacterDef): LabDraft {
  const shapeId = character.body.kind === 'catalog' ? character.body.id : 'custom'
  const radii = character.body.kind === 'profile' ? [...character.body.radii] : null
  const next: LabDraft = {
    ...draft,
    shapeId,
    colorId: character.color,
    radii,
    parts: cloneParts(character.parts ?? [])
  }
  const expr = EXPRESSION_BY_ID.get(character.restExpression)
  return expr ? applyPreset(next, expr) : next
}

/** Uniquement notre format. Pas de lecture d'un export etranger. */
export function importCharacter(raw: unknown): CharacterDef | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  if (o.format !== undefined && o.format !== BLOUB_FORMAT) return null
  const { format: _f, version: _v, ...rest } = o
  return parseCharacter(rest)
}

function slug(name: string) {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return s || 'bloub'
}
