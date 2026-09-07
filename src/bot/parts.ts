import { TAU } from './math'
import { PROFILE_SAMPLES } from './profiles'
import { closedPath, hullOfCircles, toPoints, type Point, type Silhouette } from './shape'

/**
 * Pieces secondaires du corps : pas un second `r(theta)`, des primitives
 * independantes. Kirby (Bible Strong Avatar Lab) est un sphere primaire plus
 * deux ellipsoides de bras — les mains doivent pouvoir bouger seules, donc elles
 * ne rentrent pas dans le profil radial.
 *
 * Unites : rayon de la boule au repos (= 1). `sample()` les ramene au viewBox.
 * Projection orthogonale, comme les yeux : pas de Three.js.
 */

export type Vec3 = [number, number, number]

export type PrimitiveDef =
  | { type: 'ellipsoid'; size: Vec3 }
  | { type: 'capsule'; radius: number; length: number }
  | { type: 'radial'; radii: number[] }

export interface PartTransform {
  position: Vec3
  /** Euler XYZ, en degres. Pour Kirby, seul Z est non nul. */
  rotation: Vec3
  scale: Vec3
}

export interface PartAnchor {
  parent: 'body'
  spherical: { yaw: number; pitch: number; radius: number }
}

export interface PartDef {
  id: string
  primitive: PrimitiveDef
  /**
   * Pose de BIND : la structure du personnage, pas l'animation.
   * `transform` est accepte a la lecture (JSON ancien) et recopie ici.
   */
  bindTransform: PartTransform
  anchor?: PartAnchor
  render: { depthMode: 'auto' | 'front' | 'back' }
}

/**
 * Pose animee, par-dessus le bind. `rotation` est ABSOLUE (remplace l'axe
 * fourni) ; `position` est un DECALAGE ajoute au bind — c'est ce qui permet
 * « la main sur la sphere, puis 0,12 vers l'exterieur » sans retoucher le
 * personnage.
 */
export interface PartPose {
  position?: Vec3
  rotation?: Vec3
  scale?: Vec3
  alpha?: number
}

export interface RenderedPart {
  id: string
  path: string
  depth: number
  alpha: number
}

export const MAX_PARTS = 8

const BS_R = 120

/**
 * Bras de Kirby, mesures lues sur `defaultStudioDocument.json` du studio
 * Bible Strong (avatar "Kirby") et ramenees au rayon 1.
 *
 * Corps source : sphere 240. Bras : sphere 108.11 x 81.6 x 81.6, z ~ -9.8
 * (derriere le corps), rotation Z +/-15deg.
 */
export const KIRBY_PARTS: PartDef[] = [
  {
    id: 'arm-left',
    primitive: {
      type: 'ellipsoid',
      size: [108.11015625 / 2 / BS_R, 81.6 / 2 / BS_R, 81.6 / 2 / BS_R]
    },
    bindTransform: {
      position: [-103.30437876033604 / BS_R, 30.4449714479682 / BS_R, -9.784765625 / BS_R],
      rotation: [0, 0, -14.843359375],
      scale: [1, 1, 1]
    },
    render: { depthMode: 'auto' }
  },
  {
    id: 'arm-right',
    primitive: {
      type: 'ellipsoid',
      size: [108.11015625 / 2 / BS_R, 81.6 / 2 / BS_R, 81.6 / 2 / BS_R]
    },
    bindTransform: {
      position: [98.15429266544173 / BS_R, 32.55003025735345 / BS_R, -9.784765625 / BS_R],
      rotation: [0, 0, 15.175],
      scale: [1, 1, 1]
    },
    render: { depthMode: 'auto' }
  }
]

export function defaultPart(kind: PrimitiveDef['type'] = 'ellipsoid', id = 'part'): PartDef {
  const primitive: PrimitiveDef =
    kind === 'capsule'
      ? { type: 'capsule', radius: 0.22, length: 0.7 }
      : kind === 'radial'
        ? { type: 'radial', radii: new Array(PROFILE_SAMPLES).fill(0.35) }
        : { type: 'ellipsoid', size: [0.35, 0.28, 0.28] }
  return {
    id,
    primitive,
    bindTransform: {
      position: [0.85, 0.2, -0.08],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    },
    render: { depthMode: 'auto' }
  }
}

export function parsePartsList(raw: unknown): PartDef[] {
  if (!Array.isArray(raw)) return []
  return raw.map(parsePart).filter((p): p is PartDef => p !== null)
}

export function cloneParts(parts: PartDef[]): PartDef[] {
  return parts.map((p) => ({
    id: p.id,
    primitive:
      p.primitive.type === 'ellipsoid'
        ? { type: 'ellipsoid', size: [...p.primitive.size] }
        : p.primitive.type === 'capsule'
          ? { ...p.primitive }
          : { type: 'radial', radii: [...p.primitive.radii] },
    bindTransform: {
      position: [...p.bindTransform.position],
      rotation: [...p.bindTransform.rotation],
      scale: [...p.bindTransform.scale]
    },
    anchor: p.anchor
      ? {
          parent: 'body',
          spherical: { ...p.anchor.spherical }
        }
      : undefined,
    render: { ...p.render }
  }))
}

/** Point sur la sphere unite, meme convention que `face.ts` (y vers le bas). */
export function sphericalPoint(yawDeg: number, pitchDeg: number, radius: number): Vec3 {
  const yaw = (yawDeg * Math.PI) / 180
  const pitch = (pitchDeg * Math.PI) / 180
  const cp = Math.cos(pitch)
  return [
    Math.sin(yaw) * cp * radius,
    -Math.sin(pitch) * radius,
    Math.cos(yaw) * cp * radius
  ]
}

function euler(rx: number, ry: number, rz: number): number[][] {
  const a = (rx * Math.PI) / 180
  const b = (ry * Math.PI) / 180
  const c = (rz * Math.PI) / 180
  const cx = Math.cos(a)
  const sx = Math.sin(a)
  const cy = Math.cos(b)
  const sy = Math.sin(b)
  const cz = Math.cos(c)
  const sz = Math.sin(c)
  return [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx]
  ]
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number, rot: number): string {
  const n = 32
  const cr = Math.cos(rot)
  const sr = Math.sin(rot)
  const pts: Point[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU
    const lx = Math.cos(a) * rx
    const ly = Math.sin(a) * ry
    pts.push({ x: cx + cr * lx - sr * ly, y: cy + sr * lx + cr * ly })
  }
  return closedPath(pts)
}

/**
 * Silhouette orthographique d'un ellipsoide : l'image d'une sphere unite par
 * `R * diag(a,b,c)` se projette en une ellipse dont la covariance est le 2x2
 * haut-gauche de `M M^T`.
 */
function projectEllipsoid(
  size: Vec3,
  rotation: Vec3,
  cx: number,
  cy: number,
  scale: number
): string {
  const ax = Math.max(size[0], 1e-4)
  const ay = Math.max(size[1], 1e-4)
  const az = Math.max(size[2], 1e-4)
  const R = euler(rotation[0], rotation[1], rotation[2])
  const c00 = (R[0]![0]! * ax) ** 2 + (R[0]![1]! * ay) ** 2 + (R[0]![2]! * az) ** 2
  const c11 = (R[1]![0]! * ax) ** 2 + (R[1]![1]! * ay) ** 2 + (R[1]![2]! * az) ** 2
  const c01 =
    R[0]![0]! * ax * R[1]![0]! * ax +
    R[0]![1]! * ay * R[1]![1]! * ay +
    R[0]![2]! * az * R[1]![2]! * az
  const rot = 0.5 * Math.atan2(2 * c01, c00 - c11)
  const cr = Math.cos(rot)
  const sr = Math.sin(rot)
  const q00 = cr * cr * c00 + 2 * cr * sr * c01 + sr * sr * c11
  const q11 = sr * sr * c00 - 2 * cr * sr * c01 + cr * cr * c11
  const rx = Math.sqrt(Math.max(q00, 0)) * scale
  const ry = Math.sqrt(Math.max(q11, 0)) * scale
  return ellipsePath(cx, cy, rx, ry, rot)
}

function projectCapsule(
  radius: number,
  length: number,
  rotation: Vec3,
  cx: number,
  cy: number,
  scale: number
): string {
  const r = Math.max(radius, 1e-4)
  const half = Math.max(length, r * 2) / 2
  const poly = hullOfCircles(-half, 0, r, half, 0, r, 48)
  const R = euler(rotation[0], rotation[1], rotation[2])
  const pts: Point[] = poly.map((p) => ({
    x: cx + (R[0]![0]! * p.x + R[0]![1]! * p.y) * scale,
    y: cy + (R[1]![0]! * p.x + R[1]![1]! * p.y) * scale
  }))
  return closedPath(pts)
}

function projectRadial(
  radii: number[],
  rotation: Vec3,
  position: Vec3,
  scaleVec: Vec3,
  engineScale: number
): string {
  const sil: Silhouette = {
    radii: radii.length === PROFILE_SAMPLES ? radii : new Array(PROFILE_SAMPLES).fill(0.3),
    rot: (rotation[2] * Math.PI) / 180,
    cx: position[0],
    cy: position[1],
    sx: scaleVec[0],
    sy: scaleVec[1]
  }
  return closedPath(toPoints(sil, engineScale))
}

/**
 * Compose bind × pose × ancre. L'ancre pose un point sur la sphere du corps ;
 * le bind (plus la pose) s'exprime ALORS dans ce reperage, au lieu de remplacer
 * la position.
 */
export function composePart(
  part: PartDef,
  pose?: PartPose
): { position: Vec3; rotation: Vec3; scale: Vec3; alpha: number } {
  const bind = part.bindTransform
  const rotation: Vec3 = [
    bind.rotation[0] + (pose?.rotation?.[0] ?? 0),
    bind.rotation[1] + (pose?.rotation?.[1] ?? 0),
    bind.rotation[2] + (pose?.rotation?.[2] ?? 0)
  ]
  const scale: Vec3 = [
    bind.scale[0] * (pose?.scale?.[0] ?? 1),
    bind.scale[1] * (pose?.scale?.[1] ?? 1),
    bind.scale[2] * (pose?.scale?.[2] ?? 1)
  ]
  let position: Vec3 = [
    bind.position[0] + (pose?.position?.[0] ?? 0),
    bind.position[1] + (pose?.position?.[1] ?? 0),
    bind.position[2] + (pose?.position?.[2] ?? 0)
  ]
  if (part.anchor?.spherical) {
    const s = part.anchor.spherical
    const ap = sphericalPoint(s.yaw, s.pitch, s.radius)
    position = [ap[0] + position[0], ap[1] + position[1], ap[2] + position[2]]
  }
  return { position, rotation, scale, alpha: pose?.alpha ?? 1 }
}

export interface ProjectPartsOpts {
  scale: number
  offX: number
  offY: number
  alpha: number
  poses?: Record<string, PartPose>
}

/**
 * Projette les pieces et les separe devant / derriere le corps, d'apres Z
 * (vers le spectateur). Mode `front` / `back` force la couche.
 *
 * Capsule : projection 2D (enveloppe de deux cercles). La rotation X/Y n'est
 * pas une vraie capsule 3D — seul Z est fidele. `sz` entre dans le rayon.
 */
export function projectParts(
  parts: PartDef[],
  opts: ProjectPartsOpts
): { back: RenderedPart[]; front: RenderedPart[] } {
  const back: RenderedPart[] = []
  const front: RenderedPart[] = []
  const { scale, offX, offY, alpha, poses } = opts

  for (const part of parts) {
    const world = composePart(part, poses?.[part.id])
    const sx = world.scale[0]
    const sy = world.scale[1]
    const sz = world.scale[2]
    const cx = (world.position[0] + offX) * scale
    const cy = (world.position[1] + offY) * scale
    const rot = world.rotation
    let path = ''
    const prim = part.primitive
    if (prim.type === 'ellipsoid') {
      path = projectEllipsoid(
        [prim.size[0] * sx, prim.size[1] * sy, prim.size[2] * sz],
        rot,
        cx,
        cy,
        scale
      )
    } else if (prim.type === 'capsule') {
      path = projectCapsule(
        prim.radius * Math.min(sx, sy, sz),
        prim.length * sx,
        rot,
        cx,
        cy,
        scale
      )
    } else {
      path = projectRadial(
        prim.radii,
        rot,
        [world.position[0] + offX, world.position[1] + offY, world.position[2]],
        world.scale,
        scale
      )
    }
    if (!path) continue
    const rendered: RenderedPart = {
      id: part.id,
      path,
      depth: world.position[2],
      alpha: alpha * world.alpha
    }
    const mode = part.render.depthMode
    const behind = mode === 'back' || (mode === 'auto' && world.position[2] < 0)
    if (behind) back.push(rendered)
    else front.push(rendered)
  }

  back.sort((a, b) => a.depth - b.depth)
  front.sort((a, b) => a.depth - b.depth)
  return { back, front }
}

export function parsePart(raw: unknown): PartDef | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || !o.id) return null
  const prim = parsePrimitive(o.primitive)
  if (!prim) return null
  const tr = o.bindTransform ?? o.transform
  if (typeof tr !== 'object' || tr === null) return null
  const t = tr as Record<string, unknown>
  const position = vec3(t.position)
  const rotation = vec3(t.rotation) ?? [0, 0, 0]
  const scale = vec3(t.scale) ?? [1, 1, 1]
  if (!position) return null
  const renderRaw = o.render
  let depthMode: PartDef['render']['depthMode'] = 'auto'
  if (typeof renderRaw === 'object' && renderRaw !== null) {
    const m = (renderRaw as Record<string, unknown>).depthMode
    if (m === 'front' || m === 'back' || m === 'auto') depthMode = m
  }
  const part: PartDef = {
    id: o.id,
    primitive: prim,
    bindTransform: { position, rotation, scale },
    render: { depthMode }
  }
  const anc = o.anchor
  if (typeof anc === 'object' && anc !== null) {
    const a = anc as Record<string, unknown>
    const sph = a.spherical
    if (typeof sph === 'object' && sph !== null) {
      const s = sph as Record<string, unknown>
      if (
        typeof s.yaw === 'number' &&
        typeof s.pitch === 'number' &&
        typeof s.radius === 'number'
      ) {
        part.anchor = {
          parent: 'body',
          spherical: { yaw: s.yaw, pitch: s.pitch, radius: s.radius }
        }
      }
    }
  }
  return part
}

function vec3(v: unknown): Vec3 | null {
  if (!Array.isArray(v) || v.length !== 3) return null
  const a = v.map((n) => (typeof n === 'number' && Number.isFinite(n) ? n : null))
  if (a.some((n) => n === null)) return null
  return [a[0]!, a[1]!, a[2]!]
}

function parsePrimitive(raw: unknown): PrimitiveDef | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  if (o.type === 'ellipsoid') {
    const size = vec3(o.size)
    if (!size) return null
    return { type: 'ellipsoid', size }
  }
  if (o.type === 'capsule') {
    if (typeof o.radius !== 'number' || typeof o.length !== 'number') return null
    return { type: 'capsule', radius: o.radius, length: o.length }
  }
  if (o.type === 'radial' && Array.isArray(o.radii) && o.radii.length === PROFILE_SAMPLES) {
    const radii = o.radii.map((n) => (typeof n === 'number' && Number.isFinite(n) ? n : 0))
    if (Math.max(...radii) <= 0) return null
    return { type: 'radial', radii }
  }
  return null
}
