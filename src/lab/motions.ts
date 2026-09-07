import { clampDuration, makeBlock, type Block } from '@/bot/cycles'
import { TAU, clamp, easings, lerp } from '@/bot/math'
import { SEQUENCE, STATE_BY_ID, type StateId } from '@/bot/states'
import type { PartPose, Vec3 } from '@/bot/parts'
import type { MotionDef, MotionPrimitive, MotionSample, PartAxis } from './types'

const AXIS: Record<PartAxis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 }

function isPartPrimitive(
  p: MotionPrimitive
): p is Extract<MotionPrimitive, { type: 'part.rotate' | 'part.translate' | 'part.oscillate' }> {
  return p.type === 'part.rotate' || p.type === 'part.translate' || p.type === 'part.oscillate'
}

function stateDuration(state: StateId, asked?: number): number {
  const fallback = STATE_BY_ID.get(state)?.duration ?? 2
  return clampDuration(state, asked ?? fallback)
}

export function durationOfPrimitive(p: MotionPrimitive, current: StateId = 'idle'): number {
  if (isPartPrimitive(p)) return 0
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
 * sont pas un etat (expression, regard, pause, pieces) allongent l'etat courant
 * ou n'ajoutent rien : le moteur d'origine ne sait jouer que des blocs d'etats.
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
    if (isPartPrimitive(p)) continue
    if (p.type === 'state') {
      current = p.state
      push(current, p.duration ?? STATE_BY_ID.get(current)?.duration ?? 2)
    } else {
      push(current, durationOfPrimitive(p, current))
    }
  }
  return blocks.length ? blocks : [makeBlock('idle')]
}

function ensurePose(bag: Record<string, PartPose>, id: string): PartPose {
  const cur = bag[id] ?? (bag[id] = {})
  return cur
}

function setRot(bag: Record<string, PartPose>, id: string, axis: PartAxis, value: number) {
  const p = ensurePose(bag, id)
  const rot: Vec3 = p.rotation ? [...p.rotation] : [0, 0, 0]
  rot[AXIS[axis]] = value
  p.rotation = rot
}

function setPos(bag: Record<string, PartPose>, id: string, axis: PartAxis, value: number) {
  const p = ensurePose(bag, id)
  const pos: Vec3 = p.position ? [...p.position] : [0, 0, 0]
  pos[AXIS[axis]] = value
  p.position = pos
}

function overlayParts(def: MotionDef, t: number): Record<string, PartPose> {
  const bag: Record<string, PartPose> = {}
  for (const p of def.primitives) {
    if (p.type === 'part.oscillate') {
      setRot(bag, p.part, p.axis, p.center + p.amplitude * Math.sin(t * TAU * p.frequency))
    } else if (p.type === 'part.rotate') {
      const d = Math.max(p.duration ?? 0.28, 1e-4)
      const k = easings.easeOutQuint(clamp(t / d))
      setRot(bag, p.part, p.axis, lerp(p.from, p.to, k))
    } else if (p.type === 'part.translate') {
      const d = Math.max(p.duration ?? 0.28, 1e-4)
      const k = easings.easeOutQuint(clamp(t / d))
      setPos(bag, p.part, p.axis, lerp(p.from, p.to, k))
    }
  }
  return bag
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
    if (isPartPrimitive(p)) continue
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
      return { state, expressionId, look, parts: overlayParts(def, local) }
    }
    acc += d
  }
  return { state, expressionId, look, parts: overlayParts(def, local) }
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
 * mouvements d'agent, plus les motions de pieces (vague, main au visage).
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
  },
  {
    id: 'wave',
    name: 'wave',
    loop: true,
    primitives: [
      { type: 'state', state: 'idle' },
      {
        type: 'part.oscillate',
        part: 'arm-left',
        axis: 'z',
        center: 0,
        amplitude: -25,
        frequency: 2
      },
      {
        type: 'part.oscillate',
        part: 'arm-right',
        axis: 'z',
        center: 0,
        amplitude: 25,
        frequency: 2
      }
    ]
  },
  {
    id: 'hand',
    name: 'hand',
    loop: true,
    primitives: [
      { type: 'expression', id: 'attentif', duration: 0.45 },
      { type: 'state', state: 'idle' },
      { type: 'part.rotate', part: 'arm-left', axis: 'z', from: 0, to: 42, duration: 0.45 },
      { type: 'part.translate', part: 'arm-left', axis: 'x', from: 0, to: 0.23, duration: 0.45 },
      { type: 'part.translate', part: 'arm-left', axis: 'y', from: 0, to: -0.18, duration: 0.45 }
    ]
  },
  {
    id: 'celebrate',
    name: 'celebrate',
    loop: true,
    primitives: [
      { type: 'state', state: 'idle' },
      { type: 'expression', id: 'heureux', duration: 0.45 },
      {
        type: 'part.oscillate',
        part: 'arm-left',
        axis: 'z',
        center: -32,
        amplitude: 14,
        frequency: 1.5
      },
      {
        type: 'part.oscillate',
        part: 'arm-right',
        axis: 'z',
        center: 32,
        amplitude: 14,
        frequency: 1.5
      }
    ]
  },
  {
    id: 'clap',
    name: 'clap',
    loop: true,
    primitives: [
      { type: 'state', state: 'idle' },
      {
        type: 'part.oscillate',
        part: 'arm-left',
        axis: 'z',
        center: 20,
        amplitude: 16,
        frequency: 2
      },
      {
        type: 'part.oscillate',
        part: 'arm-right',
        axis: 'z',
        center: -20,
        amplitude: 16,
        frequency: 2
      },
      {
        type: 'part.translate',
        part: 'arm-left',
        axis: 'x',
        from: 0,
        to: 0.22,
        duration: 0.2
      },
      {
        type: 'part.translate',
        part: 'arm-right',
        axis: 'x',
        from: 0,
        to: -0.22,
        duration: 0.2
      }
    ]
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
