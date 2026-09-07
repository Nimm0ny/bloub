import { clampDuration, makeBlock, type Block } from '@/bot/cycles'
import { SEQUENCE, STATE_BY_ID, type StateId } from '@/bot/states'
import type { MotionDef, MotionPrimitive, MotionSample } from './types'

function stateDuration(state: StateId, asked?: number): number {
  const fallback = STATE_BY_ID.get(state)?.duration ?? 2
  return clampDuration(state, asked ?? fallback)
}

export function durationOfPrimitive(p: MotionPrimitive, current: StateId = 'idle'): number {
  if (p.type === 'state') return stateDuration(p.state, p.duration)
  if (p.type === 'hold') return stateDuration(current, p.duration)
  if (p.type === 'expression') return stateDuration(current, p.duration ?? 0.45)
  return stateDuration(current, p.duration ?? 0.24)
}

export function durationOfMotion(def: MotionDef): number {
  let t = 0
  let state: StateId = 'idle'
  for (const p of def.primitives) {
    t += durationOfPrimitive(p, state)
    if (p.type === 'state') state = p.state
  }
  return t
}

/**
 * Convertit un mouvement en montage du lecteur existant. Les primitives qui ne
 * sont pas un etat (expression, regard, pause) allongent l'etat courant : le
 * moteur d'origine ne sait jouer que des blocs d'etats.
 */
export function motionToBlocks(def: MotionDef): Block[] {
  const blocks: Block[] = []
  let current: StateId = 'idle'

  const push = (state: StateId, duration: number) => {
    const d = stateDuration(state, duration)
    const last = blocks.at(-1)
    if (last && last.state === state) {
      last.duration = stateDuration(state, last.duration + d)
      return
    }
    blocks.push({ state, duration: d })
  }

  for (const p of def.primitives) {
    if (p.type === 'state') {
      current = p.state
      push(current, p.duration ?? STATE_BY_ID.get(current)?.duration ?? 2)
    } else {
      push(current, durationOfPrimitive(p, current))
    }
  }
  return blocks.length ? blocks : [makeBlock('idle')]
}

export function sampleMotion(def: MotionDef, t: number): MotionSample {
  const total = durationOfMotion(def)
  let local = t
  if (def.loop && total > 0) {
    local = ((t % total) + total) % total
  } else if (total > 0) {
    local = Math.min(Math.max(0, t), Math.max(0, total - 1e-6))
  }

  let acc = 0
  let state: StateId = 'idle'
  let expressionId: string | null = null
  let look: MotionSample['look'] = null
  let current: StateId = 'idle'

  for (const p of def.primitives) {
    const d = durationOfPrimitive(p, current)
    if (p.type === 'state') {
      current = p.state
      state = p.state
    } else if (p.type === 'expression') {
      expressionId = p.id
    } else if (p.type === 'look') {
      look = { yaw: p.yaw, pitch: p.pitch, mix: p.mix ?? 1, spin: 0, wander: 0 }
    }
    if (local < acc + d) {
      return { state, expressionId, look }
    }
    acc += d
  }
  return { state, expressionId, look }
}

function wrapState(id: StateId, loop = false): MotionDef {
  return {
    id: `state-${id}`,
    name: id,
    loop,
    primitives: [{ type: 'state', state: id }]
  }
}

/**
 * Catalogue de mouvements. Chaque etat du SEQUENCE a son enveloppe, plus les
 * mouvements d'agent (rest / notice / think / write / …) qui composent.
 */
export const MOTION_CATALOG: MotionDef[] = [
  wrapState('idle', true),
  wrapState('thinking', true),
  ...SEQUENCE.filter((id) => id !== 'idle' && id !== 'thinking').map((id) => wrapState(id)),
  {
    id: 'rest',
    name: 'rest',
    loop: true,
    primitives: [{ type: 'state', state: 'idle' }]
  },
  {
    id: 'notice',
    name: 'notice',
    loop: false,
    primitives: [{ type: 'state', state: 'notify' }]
  },
  {
    id: 'think',
    name: 'think',
    loop: true,
    primitives: [{ type: 'state', state: 'thinking' }]
  },
  {
    id: 'write',
    name: 'write',
    loop: true,
    primitives: [
      { type: 'expression', id: 'attentif', duration: 0.45 },
      { type: 'state', state: 'idle' }
    ]
  },
  {
    id: 'speak',
    name: 'speak',
    loop: true,
    primitives: [{ type: 'state', state: 'wide' }]
  },
  {
    id: 'error',
    name: 'error',
    loop: false,
    primitives: [{ type: 'state', state: 'alert' }]
  },
  {
    id: 'done',
    name: 'done',
    loop: false,
    primitives: [{ type: 'state', state: 'wink' }]
  },
  {
    id: 'sleep',
    name: 'sleep',
    loop: true,
    primitives: [{ type: 'state', state: 'sleep' }]
  }
]

export const MOTION_BY_ID = new Map(MOTION_CATALOG.map((m) => [m.id, m]))

export function cloneMotion(def: MotionDef): MotionDef {
  return {
    id: def.id,
    name: def.name,
    loop: def.loop,
    primitives: def.primitives.map((p) => ({ ...p }))
  }
}
