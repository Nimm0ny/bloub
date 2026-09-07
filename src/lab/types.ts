import type { Look } from '@/bot/engine'
import type { PartDef, PartPose } from '@/bot/parts'
import type { HeadGaze } from '@/bot/face'
import type { ShapeId } from '@/bot/skins'
import type { EyeCfg, StateId } from '@/bot/states'

/**
 * Expression durable, independante du catalogue hardcode.
 *
 * Les nombres restent ceux de `src/bot/expressions.ts` tant qu'on n'en a pas
 * saisi d'autres : P2 dataise le CONTRAT, pas les mesures.
 */
export interface ExpressionDef {
  id: string
  gaze: HeadGaze
  split: number
  eyes: [EyeCfg, EyeCfg]
}

/** Corps d'un personnage : une forme du personnalisateur, ou un profil radial. */
export type BodyDef =
  | { kind: 'catalog'; id: ShapeId }
  | { kind: 'profile'; radii: number[] }

/**
 * Personnage portable. C'est l'identite visuelle persistante, avant toute pose
 * temporaire du laboratoire.
 */
export interface CharacterDef {
  id: string
  name: string
  body: BodyDef
  /** identifiant de `COLORS`, ou hex #rrggbb */
  color: string
  restExpression: string
  expressions: ExpressionDef[]
  /** Pieces secondaires. Absentes = le bloub d'origine, un seul contour. */
  parts?: PartDef[]
}

/**
 * Primitive de mouvement. Le moteur d'origine n'en a pas : un etat EST a la fois
 * la silhouette, le visage et le decor. Ici on decompose pour pouvoir composer
 * sans retoucher `states.ts`.
 */
export type PartAxis = 'x' | 'y' | 'z'
export type PartChannel = 'rotation' | 'position'

/** Recit : etats, expressions, regard. Ordre = temps. */
export type MotionPrimitive =
  | { type: 'state'; state: StateId; duration?: number }
  | { type: 'expression'; id: string; duration?: number }
  | { type: 'look'; yaw: number; pitch: number; mix?: number; duration?: number }
  | { type: 'hold'; duration: number }

export interface PartTrackSegment {
  at: number
  duration: number
  type?: 'lerp' | 'oscillate'
  from?: number
  to?: number
  center?: number
  amplitude?: number
  /** Cycles entiers sur `duration` : t=0 et t=duration coincident. */
  cycles?: number
}

/** Piste d'un membre. `target` : `arm-right.rotation.z` */
export interface PartTrack {
  target: string
  segments: PartTrackSegment[]
}

export interface MotionDef {
  id: string
  name: string
  duration: number
  loop: boolean
  sequence: MotionPrimitive[]
  tracks: PartTrack[]
}

export type AgentEvent =
  | 'idle'
  | 'notice'
  | 'think'
  | 'write'
  | 'speak'
  | 'error'
  | 'done'
  | 'sleep'

export interface VisualState {
  id: string
  motion: string
  loop: boolean
}

export interface AgentVSM {
  initial: string
  states: VisualState[]
  transitions: Array<{ from: string; event: AgentEvent; to: string }>
}

/** Brouillon du laboratoire : ce que les curseurs tiennent, pas encore un def. */
export interface LabDraft {
  shapeId: string
  colorId: string
  presetId: string
  gaze: HeadGaze
  split: number
  eyes: [EyeCfg, EyeCfg]
  eyesLinked: boolean
  freezeGaze: boolean
  radii: number[] | null
  parts: PartDef[]
}

export interface MotionSample {
  state: StateId
  expressionId: string | null
  look: Look | null
  parts: Record<string, PartPose>
}

export type LabTab = 'pose' | 'import' | 'motion' | 'agent'
