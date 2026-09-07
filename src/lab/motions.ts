import { clampDuration, makeBlock, type Block } from '@/bot/cycles'
import { TAU, clamp, easings, lerp } from '@/bot/math'
import { SEQUENCE, STATE_BY_ID, type StateId } from '@/bot/states'
import type { PartMotion, PartPose, Vec3 } from '@/bot/parts'
import type {
  MotionDef,
  MotionPrimitive,
  MotionSample,
  PartAxis,
  PartChannel,
  PartTrack,
  PartTrackSegment
} from './types'

const AXIS: Record<PartAxis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 }

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

export function durationOfSequence(def: MotionDef): number {
  let t = 0
  let state: StateId = 'idle'
  for (const p of def.sequence) {
    t += durationOfPrimitive(p, state)
    if (p.type === 'state') state = p.state
  }
  return t
}

export function durationOfMotion(def: MotionDef): number {
  return def.duration > 0 ? def.duration : durationOfSequence(def)
}

export function hasPartTracks(def: MotionDef): boolean {
  return def.tracks.some((tr) => tr.segments.length > 0)
}

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

  for (const p of def.sequence) {
    if (p.type === 'state') {
      current = p.state
      push(current, p.duration ?? STATE_BY_ID.get(current)?.duration ?? 2)
    } else if (p.type === 'hold' || p.type === 'expression' || p.type === 'look') {
      push(current, durationOfPrimitive(p, current))
    }
  }
  return blocks.length ? blocks : [makeBlock('idle')]
}

export function parsePartTarget(
  target: string
): { part: string; channel: PartChannel; axis: PartAxis } | null {
  const m = /^(.+)\.(rotation|position)\.([xyz])$/.exec(target)
  if (!m) return null
  return { part: m[1]!, channel: m[2] as PartChannel, axis: m[3] as PartAxis }
}

function evalSegment(seg: PartTrackSegment, t: number): number {
  const d = Math.max(seg.duration, 1e-4)
  const u = clamp((t - seg.at) / d)
  if (seg.type === 'oscillate') {
    const cycles = Math.max(1, Math.round(seg.cycles ?? 1))
    const center = seg.center ?? 0
    const amp = seg.amplitude ?? 0
    return center + amp * Math.sin(TAU * cycles * u)
  }
  const from = seg.from ?? 0
  const to = seg.to ?? 0
  return lerp(from, to, easings.easeOutQuint(u))
}

function sampleTrack(track: PartTrack, t: number): number {
  let value = 0
  for (const seg of track.segments) {
    if (t + 1e-9 < seg.at) break
    value = evalSegment(seg, t)
  }
  return value
}

function ensurePose(bag: Record<string, PartPose>, id: string): PartPose {
  return bag[id] ?? (bag[id] = {})
}

function setChannel(
  bag: Record<string, PartPose>,
  part: string,
  channel: PartChannel,
  axis: PartAxis,
  value: number
) {
  const p = ensurePose(bag, part)
  const key = channel === 'rotation' ? 'rotation' : 'position'
  const vec: Vec3 = p[key] ? [...p[key]!] : [0, 0, 0]
  vec[AXIS[axis]] = value
  p[key] = vec
}

export function sampleTracks(tracks: PartTrack[], t: number): Record<string, PartPose> {
  const bag: Record<string, PartPose> = {}
  for (const track of tracks) {
    const parsed = parsePartTarget(track.target)
    if (!parsed || !track.segments.length) continue
    setChannel(bag, parsed.part, parsed.channel, parsed.axis, sampleTrack(track, t))
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

  for (const p of def.sequence) {
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
      return { state, expressionId, look, parts: sampleTracks(def.tracks, local) }
    }
    acc += d
  }
  return { state, expressionId, look, parts: sampleTracks(def.tracks, local) }
}

/** Sampler clockless pour le moteur : `PartPose = f(t)`. */
export function partMotionOf(def: MotionDef): PartMotion {
  return {
    sample(localTime: number) {
      return sampleMotion(def, localTime).parts
    }
  }
}

function wrapState(id: StateId, loop = false): MotionDef {
  const duration = STATE_BY_ID.get(id)?.duration ?? 2
  return {
    id: `state-${id}`,
    name: id,
    duration,
    loop,
    sequence: [{ type: 'state', state: id }],
    tracks: []
  }
}

function osc(
  target: string,
  duration: number,
  center: number,
  amplitude: number,
  cycles: number
): PartTrack {
  return {
    target,
    segments: [{ at: 0, duration, type: 'oscillate', center, amplitude, cycles }]
  }
}

export const MOTION_CATALOG: MotionDef[] = [
  wrapState('idle', true),
  wrapState('thinking', true),
  ...SEQUENCE.filter((id) => id !== 'idle' && id !== 'thinking').map((id) => wrapState(id)),
  {
    id: 'rest',
    name: 'rest',
    duration: STATE_BY_ID.get('idle')!.duration,
    loop: true,
    sequence: [{ type: 'state', state: 'idle' }],
    tracks: []
  },
  {
    id: 'notice',
    name: 'notice',
    duration: STATE_BY_ID.get('notify')!.duration,
    loop: false,
    sequence: [{ type: 'state', state: 'notify' }],
    tracks: []
  },
  {
    id: 'think',
    name: 'think',
    duration: STATE_BY_ID.get('thinking')!.duration,
    loop: true,
    sequence: [{ type: 'state', state: 'thinking' }],
    tracks: []
  },
  {
    id: 'write',
    name: 'write',
    duration: 0.45 + STATE_BY_ID.get('idle')!.duration,
    loop: true,
    sequence: [
      { type: 'expression', id: 'attentif', duration: 0.45 },
      { type: 'state', state: 'idle' }
    ],
    tracks: []
  },
  {
    id: 'speak',
    name: 'speak',
    duration: STATE_BY_ID.get('wide')!.duration,
    loop: true,
    sequence: [{ type: 'state', state: 'wide' }],
    tracks: []
  },
  {
    id: 'error',
    name: 'error',
    duration: STATE_BY_ID.get('alert')!.duration,
    loop: false,
    sequence: [{ type: 'state', state: 'alert' }],
    tracks: []
  },
  {
    id: 'done',
    name: 'done',
    duration: STATE_BY_ID.get('wink')!.duration,
    loop: false,
    sequence: [{ type: 'state', state: 'wink' }],
    tracks: []
  },
  {
    id: 'sleep',
    name: 'sleep',
    duration: STATE_BY_ID.get('sleep')!.duration,
    loop: true,
    sequence: [{ type: 'state', state: 'sleep' }],
    tracks: []
  },
  {
    id: 'wave',
    name: 'wave',
    duration: 1.2,
    loop: true,
    sequence: [{ type: 'state', state: 'idle', duration: 1.2 }],
    tracks: [
      osc('arm-left.rotation.z', 1.2, 0, -25, 2),
      osc('arm-right.rotation.z', 1.2, 0, 25, 2)
    ]
  },
  {
    id: 'hand',
    name: 'hand',
    duration: 2.4,
    loop: false,
    sequence: [
      { type: 'expression', id: 'attentif', duration: 0.45 },
      { type: 'state', state: 'idle', duration: 1.95 }
    ],
    tracks: [
      {
        target: 'arm-left.rotation.z',
        segments: [{ at: 0, duration: 0.45, from: 0, to: 42 }]
      },
      {
        target: 'arm-left.position.x',
        segments: [{ at: 0, duration: 0.45, from: 0, to: 0.23 }]
      },
      {
        target: 'arm-left.position.y',
        segments: [{ at: 0, duration: 0.45, from: 0, to: -0.18 }]
      }
    ]
  },
  {
    id: 'celebrate',
    name: 'celebrate',
    duration: 1.6,
    loop: true,
    sequence: [
      { type: 'expression', id: 'heureux', duration: 0.45 },
      { type: 'state', state: 'idle', duration: 1.15 }
    ],
    tracks: [
      osc('arm-left.rotation.z', 1.6, -32, 14, 2),
      osc('arm-right.rotation.z', 1.6, 32, 14, 2)
    ]
  },
  {
    id: 'clap',
    name: 'clap',
    duration: 1.2,
    loop: true,
    sequence: [{ type: 'state', state: 'idle', duration: 1.2 }],
    tracks: [
      osc('arm-left.rotation.z', 1.2, 20, 16, 2),
      osc('arm-right.rotation.z', 1.2, -20, 16, 2),
      {
        target: 'arm-left.position.x',
        segments: [{ at: 0, duration: 1.2, type: 'oscillate', center: 0.12, amplitude: 0.1, cycles: 2 }]
      },
      {
        target: 'arm-right.position.x',
        segments: [{ at: 0, duration: 1.2, type: 'oscillate', center: -0.12, amplitude: 0.1, cycles: 2 }]
      }
    ]
  }
]

export const MOTION_BY_ID = new Map(MOTION_CATALOG.map((m) => [m.id, m]))

export function cloneMotion(def: MotionDef): MotionDef {
  return {
    id: def.id,
    name: def.name,
    duration: def.duration,
    loop: def.loop,
    sequence: def.sequence.map((p) => ({ ...p })),
    tracks: def.tracks.map((tr) => ({
      target: tr.target,
      segments: tr.segments.map((s) => ({ ...s }))
    }))
  }
}
