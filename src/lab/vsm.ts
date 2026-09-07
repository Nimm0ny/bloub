import { MOTION_BY_ID } from './motions'
import type { AgentEvent, AgentVSM, VisualState } from './types'

export const AGENT_EVENTS: AgentEvent[] = [
  'idle',
  'notice',
  'think',
  'write',
  'speak',
  'error',
  'done',
  'sleep'
]

/**
 * Machine d'etats visuels de l'agent. Elle ne touche pas au moteur : elle
 * choisit un MotionDef, et le laboratoire le joue. Les silhouettes d'animation
 * restent celles de `states.ts`.
 *
 * `write` n'a pas d'etat mesure sur la video (pas de papier/crayon dans Bloub) :
 * on pose le visage `attentif` sur le repos, ce qui se distingue de `think`
 * (trois points).
 */
export const DEFAULT_VSM: AgentVSM = {
  initial: 'rest',
  states: [
    { id: 'rest', motion: 'rest', loop: true },
    { id: 'notice', motion: 'notice', loop: false },
    { id: 'think', motion: 'think', loop: true },
    { id: 'write', motion: 'write', loop: true },
    { id: 'speak', motion: 'speak', loop: true },
    { id: 'error', motion: 'error', loop: false },
    { id: 'done', motion: 'done', loop: false },
    { id: 'sleep', motion: 'sleep', loop: true }
  ],
  transitions: [
    { from: 'rest', event: 'notice', to: 'notice' },
    { from: 'rest', event: 'think', to: 'think' },
    { from: 'rest', event: 'write', to: 'write' },
    { from: 'rest', event: 'speak', to: 'speak' },
    { from: 'rest', event: 'error', to: 'error' },
    { from: 'rest', event: 'sleep', to: 'sleep' },
    { from: 'notice', event: 'idle', to: 'rest' },
    { from: 'notice', event: 'think', to: 'think' },
    { from: 'notice', event: 'write', to: 'write' },
    { from: 'think', event: 'idle', to: 'rest' },
    { from: 'think', event: 'write', to: 'write' },
    { from: 'think', event: 'speak', to: 'speak' },
    { from: 'think', event: 'error', to: 'error' },
    { from: 'think', event: 'done', to: 'done' },
    { from: 'write', event: 'idle', to: 'rest' },
    { from: 'write', event: 'think', to: 'think' },
    { from: 'write', event: 'speak', to: 'speak' },
    { from: 'write', event: 'done', to: 'done' },
    { from: 'write', event: 'error', to: 'error' },
    { from: 'speak', event: 'idle', to: 'rest' },
    { from: 'speak', event: 'think', to: 'think' },
    { from: 'speak', event: 'write', to: 'write' },
    { from: 'speak', event: 'done', to: 'done' },
    { from: 'error', event: 'idle', to: 'rest' },
    { from: 'error', event: 'think', to: 'think' },
    { from: 'done', event: 'idle', to: 'rest' },
    { from: 'done', event: 'think', to: 'think' },
    { from: 'sleep', event: 'idle', to: 'rest' },
    { from: 'sleep', event: 'notice', to: 'notice' }
  ]
}

export function visualOf(vsm: AgentVSM, id: string): VisualState | undefined {
  return vsm.states.find((s) => s.id === id)
}

/**
 * Transition. Une paire (etat, evenement) inconnue laisse l'etat courant :
 * l'agent ne doit pas disparaitre pour un evenement non branche.
 *
 * `idle` depuis n'importe ou sans arc explicite ramene au repos — c'est le
 * reset visuel.
 */
export function stepVsm(vsm: AgentVSM, current: string, event: AgentEvent): string {
  const hit = vsm.transitions.find((t) => t.from === current && t.event === event)
  if (hit) return hit.to
  if (event === 'idle') return vsm.initial
  return current
}

export function motionIdOf(vsm: AgentVSM, visualId: string): string | null {
  const vis = visualOf(vsm, visualId)
  if (!vis) return null
  return MOTION_BY_ID.has(vis.motion) ? vis.motion : null
}
