<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import LabSlider from '@/components/LabSlider.vue'
import BotTile from '@/components/BotTile.vue'
import {
  EXPRESSIONS,
  EXPRESSION_BY_ID,
  type BotExpression,
  type ExpressionId
} from '@/bot/expressions'
import { COLORS, SHAPES } from '@/bot/skins'
import { SEQUENCE, type StateId } from '@/bot/states'
import { offsetOf, type Block } from '@/bot/cycles'
import type { Look } from '@/bot/engine'
import { t } from '@/i18n'
import { profileFromSvg } from '@/lab/importSvg'
import { applyCharacter, characterFromDraft, importCharacter, packCharacter } from '@/lab/io'
import {
  cloneMotion,
  hasPartTracks,
  MOTION_BY_ID,
  motionToBlocks,
  partMotionOf,
  sampleMotion
} from '@/lab/motions'
import {
  applyPreset,
  defaultDraft,
  draftFromExpression,
  expressionFromDraft,
  LAB_RANGE,
  lookFromDraft,
  setEye
} from '@/lab/pose'
import type { LabDraft, LabTab, MotionDef } from '@/lab/types'
import {
  KIRBY_PARTS,
  MAX_PARTS,
  cloneParts,
  defaultPart,
  type PartDef,
  type PartMotion,
  type PartPose
} from '@/bot/parts'
import { AGENT_EVENTS, DEFAULT_VSM, stepVsm, visualOf } from '@/lab/vsm'

const props = defineProps<{
  seedShape: string
  seedColor: string
  seedExpression: string
  seedParts?: PartDef[]
  block: number
  elapsed: number
}>()

const emit = defineEmits<{
  apply: [value: { shape: string; color: string; expression: string; parts: PartDef[] }]
  openCycle: [value: { name: string; blocks: Block[] }]
}>()

const shape = defineModel<string>('shape', { required: true })
const color = defineModel<string>('color', { required: true })
const liveExpression = defineModel<BotExpression | null>('liveExpression', { default: null })
const liveLook = defineModel<Look | null>('liveLook', { default: null })
const liveRadii = defineModel<number[] | null>('liveRadii', { default: null })
const liveParts = defineModel<PartDef[] | null>('liveParts', { default: null })
const livePartPoses = defineModel<Record<string, PartPose> | null>('livePartPoses', {
  default: null
})
const livePartMotion = defineModel<PartMotion | null>('livePartMotion', { default: null })
const labCycle = defineModel<Block[] | null>('labCycle', { default: null })
const playing = defineModel<boolean>('playing', { required: true })

const tab = ref<LabTab>('pose')
const seed = EXPRESSION_BY_ID.get(props.seedExpression)
const draft = reactive<LabDraft>(
  seed
    ? draftFromExpression(seed, props.seedShape, props.seedColor)
    : defaultDraft(props.seedShape, props.seedColor)
)
if (props.seedParts?.length) draft.parts = cloneParts(props.seedParts)

const svgText = ref('')
const svgStatus = ref<'ok' | 'err' | ''>('')
const svgRadii = ref<number[] | null>(null)
const jsonStatus = ref<'ok' | 'err' | ''>('')
const jsonMessage = ref('')

const motions = ref(Array.from(MOTION_BY_ID.values(), cloneMotion))
const selectedMotionId = ref('rest')
const selectedMotion = computed(
  () => motions.value.find((m) => m.id === selectedMotionId.value) ?? motions.value[0]!
)
const addState = ref<StateId>('idle')
const addPartId = ref('arm-right')
const addPartKind = ref<'part.oscillate' | 'part.rotate' | 'part.translate'>('part.oscillate')
const selectedPart = ref(0)
const visualId = ref(DEFAULT_VSM.initial)

const AGENT_MOTION_IDS = DEFAULT_VSM.states.map((s) => s.motion)
const STATE_MOTION_IDS = SEQUENCE.map((id) => `state-${id}`)

const PREVIEW_AT = 1

const R = LAB_RANGE

type AgentMotionId =
  | 'rest'
  | 'notice'
  | 'think'
  | 'write'
  | 'speak'
  | 'error'
  | 'done'
  | 'sleep'
  | 'wave'
  | 'hand'
  | 'celebrate'
  | 'clap'

const KIRBY_MOTION_IDS = ['wave', 'hand', 'celebrate', 'clap'] as const

function motionLabel(id: string) {
  if (id.startsWith('state-')) return t(`states.${id.slice(6) as StateId}`)
  return t(`lab.motions.${id as AgentMotionId}`)
}

function visualLabel(id: string) {
  return t(`lab.motions.${id as AgentMotionId}`)
}

function previewPath(radii: number[]) {
  const n = radii.length
  const d = radii.map((r, i) => {
    const a = (i / n) * Math.PI * 2
    const x = 40 + Math.cos(a) * r * 32
    const y = 40 + Math.sin(a) * r * 32
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
  })
  return `${d.join(' ')} Z`
}

function pushLive() {
  shape.value = draft.shapeId
  color.value = draft.colorId
  liveExpression.value = expressionFromDraft(draft)
  liveLook.value = lookFromDraft(draft)
  liveRadii.value = draft.radii
  liveParts.value = cloneParts(draft.parts)
  livePartPoses.value = null
  livePartMotion.value = null
}

watch(
  draft,
  () => {
    if (tab.value === 'pose' || tab.value === 'import') pushLive()
  },
  { deep: true, immediate: true }
)

watch([() => props.block, () => props.elapsed, selectedMotion, playing, tab], () => {
  if ((tab.value !== 'motion' && tab.value !== 'agent') || !playing.value) return
  const def = selectedMotion.value
  const blocks = labCycle.value
  if (!blocks?.length) return
  const tNow = offsetOf(blocks, props.block) + props.elapsed
  const sample = sampleMotion(def, tNow)
  if (sample.expressionId) {
    const expr = EXPRESSION_BY_ID.get(sample.expressionId)
    if (expr) liveExpression.value = expr
  }
  if (sample.look) liveLook.value = sample.look
})

watch(tab, (now) => {
  if (now === 'pose' || now === 'import') {
    playing.value = false
    labCycle.value = null
    pushLive()
  }
})

function pickShape(id: string) {
  draft.shapeId = id
  if (id !== 'custom') draft.radii = null
}

function partLabel(id: string) {
  if (id === 'arm-left') return t('lab.armLeft')
  if (id === 'arm-right') return t('lab.armRight')
  return id
}

function applyKirby() {
  draft.shapeId = 'cercle'
  draft.radii = null
  draft.parts = cloneParts(KIRBY_PARTS)
  selectedPart.value = 0
}

function addPart(kind: 'ellipsoid' | 'capsule') {
  if (draft.parts.length >= MAX_PARTS) return
  draft.parts.push(defaultPart(kind, `${kind}-${draft.parts.length + 1}`))
  selectedPart.value = draft.parts.length - 1
}

function removePart(index: number) {
  draft.parts.splice(index, 1)
  selectedPart.value = Math.max(0, Math.min(selectedPart.value, draft.parts.length - 1))
}

function clearParts() {
  draft.parts = []
  selectedPart.value = 0
}

const currentPart = computed(() => draft.parts[selectedPart.value] ?? null)

function setPartPos(axis: 0 | 1 | 2, value: number) {
  const p = currentPart.value
  if (p) p.bindTransform.position[axis] = value
}

function setPartRotZ(value: number) {
  const p = currentPart.value
  if (p) p.bindTransform.rotation[2] = value
}

function setEllipsoidSize(axis: 0 | 1 | 2, value: number) {
  const p = currentPart.value
  if (p && p.primitive.type === 'ellipsoid') p.primitive.size[axis] = value
}

const ellipsoidSize = computed((): [number, number, number] | null => {
  const p = currentPart.value
  return p?.primitive.type === 'ellipsoid' ? p.primitive.size : null
})

function pickPreset(expr: BotExpression) {
  Object.assign(draft, applyPreset(draft, expr))
}

function resetDraft() {
  const expr = EXPRESSION_BY_ID.get(draft.presetId) ?? EXPRESSION_BY_ID.get(props.seedExpression)
  if (expr) Object.assign(draft, applyPreset(draft, expr))
}

function applyToAvatar() {
  emit('apply', {
    shape: draft.shapeId === 'custom' ? props.seedShape : draft.shapeId,
    color: draft.colorId,
    expression: EXPRESSION_BY_ID.has(draft.presetId) ? draft.presetId : props.seedExpression,
    parts: cloneParts(draft.parts)
  })
}

function parseSvg() {
  const radii = profileFromSvg(svgText.value)
  svgRadii.value = radii
  svgStatus.value = radii ? 'ok' : 'err'
}

function applySvg() {
  if (!svgRadii.value) {
    parseSvg()
    if (!svgRadii.value) return
  }
  draft.radii = svgRadii.value
  draft.shapeId = 'custom'
  tab.value = 'pose'
}

function characterName() {
  if (draft.parts.some((p) => p.id === 'arm-left' || p.id === 'arm-right')) return 'Kirby'
  return 'bloub'
}

function exportJson() {
  const packed = packCharacter(characterFromDraft(draft, characterName()))
  const blob = new Blob([packed], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${characterName()}.json`
  a.click()
  URL.revokeObjectURL(url)
  jsonStatus.value = 'ok'
  jsonMessage.value = t('lab.jsonExported')
}

function loadCharacter(raw: unknown) {
  const character = importCharacter(raw)
  if (!character) {
    jsonStatus.value = 'err'
    jsonMessage.value = t('lab.jsonError')
    return false
  }
  Object.assign(draft, applyCharacter(draft, character))
  selectedPart.value = 0
  jsonStatus.value = 'ok'
  jsonMessage.value = t('lab.jsonOk', { name: character.name })
  tab.value = 'pose'
  return true
}

function onJsonFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  void file.text().then((text) => {
    try {
      loadCharacter(JSON.parse(text))
    } catch {
      jsonStatus.value = 'err'
      jsonMessage.value = t('lab.jsonError')
    }
  })
}

function onSvgFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  void file.text().then((text) => {
    svgText.value = text
    parseSvg()
  })
}

function playMotion(def: MotionDef) {
  selectedMotionId.value = def.id
  labCycle.value = motionToBlocks(def)
  livePartMotion.value = partMotionOf(def)
  playing.value = true
  if (tab.value !== 'agent') tab.value = 'motion'
}

function stopMotion() {
  playing.value = false
  labCycle.value = null
  livePartPoses.value = null
  livePartMotion.value = null
  pushLive()
}

function addPrimitive() {
  const m = selectedMotion.value
  m.sequence = [...m.sequence, { type: 'state', state: addState.value }]
}

function partTargets() {
  const ids = draft.parts.map((p) => p.id)
  if (!ids.includes('arm-left')) ids.push('arm-left')
  if (!ids.includes('arm-right')) ids.push('arm-right')
  return ids
}

function addPartPrimitive() {
  const m = selectedMotion.value
  const part = addPartId.value
  const target =
    addPartKind.value === 'part.translate'
      ? `${part}.position.y`
      : `${part}.rotation.z`
  const duration = Math.max(m.duration, 0.6)
  const segment =
    addPartKind.value === 'part.oscillate'
      ? {
          at: 0,
          duration,
          type: 'oscillate' as const,
          center: 0,
          amplitude: part === 'arm-left' ? -22 : 22,
          cycles: 2
        }
      : addPartKind.value === 'part.rotate'
        ? {
            at: 0,
            duration: 0.35,
            from: 0,
            to: part === 'arm-left' ? -40 : 40
          }
        : {
            at: 0,
            duration: 0.35,
            from: 0,
            to: -0.16
          }
  m.tracks = [...m.tracks, { target, segments: [segment] }]
}

function removePrimitive(index: number) {
  const m = selectedMotion.value
  if (m.sequence.length <= 1) return
  m.sequence = m.sequence.filter((_, i) => i !== index)
}

function movePrimitive(index: number, dir: -1 | 1) {
  const m = selectedMotion.value
  const j = index + dir
  if (j < 0 || j >= m.sequence.length) return
  const next = [...m.sequence]
  const [cut] = next.splice(index, 1)
  next.splice(j, 0, cut!)
  m.sequence = next
}

function removeTrack(index: number) {
  const m = selectedMotion.value
  m.tracks = m.tracks.filter((_, i) => i !== index)
}

function primLabel(type: string) {
  const short = type.startsWith('part.') ? type.slice(5) : type
  return t(`lab.prim.${short as 'state'}`)
}

function primitiveDuration(p: { type: string; duration?: number }) {
  return 'duration' in p ? (p.duration ?? '') : ''
}

function setPrimitiveDuration(index: number, seconds: number) {
  const p = selectedMotion.value.sequence[index]
  if (!p || p.type === 'look') return
  if ('duration' in p) p.duration = seconds
}

function fire(event: (typeof AGENT_EVENTS)[number]) {
  visualId.value = stepVsm(DEFAULT_VSM, visualId.value, event)
  const vis = visualOf(DEFAULT_VSM, visualId.value)
  if (!vis) return
  const def = motions.value.find((m) => m.id === vis.motion)
  if (def) playMotion(def)
}

const timelineBlocked = computed(() => hasPartTracks(selectedMotion.value))

function sendToTimeline() {
  const def = selectedMotion.value
  if (hasPartTracks(def)) return
  emit('openCycle', {
    name: t('lab.motionCycle', { name: motionLabel(def.id) }),
    blocks: motionToBlocks(def)
  })
}

const TABS: LabTab[] = ['pose', 'import', 'motion', 'agent']
</script>

<template>
  <div>
    <h2 class="text-sm font-semibold">{{ t('lab.title') }}</h2>
    <div class="mt-2 grid grid-cols-4 gap-1">
      <button
        v-for="id in TABS"
        :key="id"
        type="button"
        class="cursor-pointer rounded-lg px-1.5 py-1 text-xs transition"
        :class="
          tab === id
            ? 'bg-[var(--ink)] text-[var(--paper)]'
            : 'text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)]'
        "
        :aria-pressed="tab === id"
        @click="tab = id"
      >
        {{ t(`lab.${id}`) }}
      </button>
    </div>

    <!-- Pose : corps, regard, yeux, expression -->
    <template v-if="tab === 'pose'">
      <h3 class="mt-5 text-sm font-semibold">{{ t('lab.body') }}</h3>
      <div class="mt-2 grid grid-cols-4 gap-1.5">
        <BotTile
          v-for="s in SHAPES"
          :key="s.id"
          :label="t(`shapes.${s.id}`)"
          :selected="s.id === draft.shapeId && !draft.radii"
          :shape="s.id"
          :color="draft.colorId"
          :expression="draft.presetId"
          :frozen-at="PREVIEW_AT"
          @click="pickShape(s.id)"
        />
      </div>
      <div class="mt-3 grid grid-cols-6 gap-1.5">
        <button
          v-for="c in COLORS"
          :key="c.id"
          type="button"
          class="flex aspect-square cursor-pointer items-center justify-center rounded-full border-2 transition"
          :class="
            c.id === draft.colorId
              ? 'border-[var(--ink)]'
              : 'border-transparent hover:border-[var(--line)]'
          "
          :aria-label="t(`colors.${c.id}`)"
          :aria-pressed="c.id === draft.colorId"
          @click="draft.colorId = c.id"
        >
          <span
            class="block h-[78%] w-[78%] rounded-full ring-1 ring-black/10 ring-inset"
            :style="{ background: c.hex }"
          />
        </button>
      </div>

      <h3 class="mt-5 text-sm font-semibold">{{ t('lab.parts') }}</h3>
      <p class="mt-1 text-xs leading-relaxed text-[var(--muted)]">{{ t('lab.partsHint') }}</p>
      <div class="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          class="cursor-pointer rounded-lg bg-[var(--ink)] px-2.5 py-1.5 text-xs text-[var(--paper)]"
          @click="applyKirby"
        >
          {{ t('lab.kirby') }}
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-lg border border-[var(--line)] px-2 py-1.5 text-xs hover:bg-black/5"
          @click="addPart('ellipsoid')"
        >
          {{ t('lab.addEllipsoid') }}
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-lg border border-[var(--line)] px-2 py-1.5 text-xs hover:bg-black/5"
          @click="addPart('capsule')"
        >
          {{ t('lab.addCapsule') }}
        </button>
        <button
          v-if="draft.parts.length"
          type="button"
          class="cursor-pointer rounded-lg border border-[var(--line)] px-2 py-1.5 text-xs text-[var(--danger)] hover:bg-black/5"
          @click="clearParts"
        >
          {{ t('lab.clearParts') }}
        </button>
      </div>
      <ul v-if="draft.parts.length" class="mt-2 flex flex-col gap-1">
        <li v-for="(p, i) in draft.parts" :key="p.id">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs"
            :class="
              i === selectedPart
                ? 'bg-[var(--ink)] text-[var(--paper)]'
                : 'hover:bg-black/5'
            "
            @click="selectedPart = i"
          >
            <span>{{ partLabel(p.id) }}</span>
            <span class="opacity-70" @click.stop="removePart(i)">×</span>
          </button>
        </li>
      </ul>
      <div v-if="currentPart" class="mt-3 flex flex-col gap-3">
        <LabSlider
          :model-value="currentPart.bindTransform.position[0] ?? 0"
          :label="t('lab.partX')"
          :min="-1.6"
          :max="1.6"
          :step="0.01"
          :decimals="2"
          @update:model-value="(v) => setPartPos(0, v)"
        />
        <LabSlider
          :model-value="currentPart.bindTransform.position[1] ?? 0"
          :label="t('lab.partY')"
          :min="-1.6"
          :max="1.6"
          :step="0.01"
          :decimals="2"
          @update:model-value="(v) => setPartPos(1, v)"
        />
        <LabSlider
          :model-value="currentPart.bindTransform.position[2] ?? 0"
          :label="t('lab.partZ')"
          :min="-1"
          :max="1"
          :step="0.01"
          :decimals="2"
          @update:model-value="(v) => setPartPos(2, v)"
        />
        <LabSlider
          :model-value="currentPart.bindTransform.rotation[2] ?? 0"
          :label="t('lab.partRotZ')"
          :min="-80"
          :max="80"
          :step="0.5"
          :decimals="1"
          @update:model-value="setPartRotZ"
        />
        <template v-if="ellipsoidSize">
          <LabSlider
            :model-value="ellipsoidSize[0]"
            :label="t('lab.partSx')"
            :min="0.08"
            :max="1"
            :step="0.01"
            :decimals="2"
            @update:model-value="(v) => setEllipsoidSize(0, v)"
          />
          <LabSlider
            :model-value="ellipsoidSize[1]"
            :label="t('lab.partSy')"
            :min="0.08"
            :max="1"
            :step="0.01"
            :decimals="2"
            @update:model-value="(v) => setEllipsoidSize(1, v)"
          />
        </template>
      </div>

      <h3 class="mt-5 text-sm font-semibold">{{ t('lab.gaze') }}</h3>
      <label class="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
        <input v-model="draft.freezeGaze" type="checkbox" class="accent-[var(--ink)]" />
        {{ t('lab.freezeGaze') }}
      </label>
      <div class="mt-2 flex flex-col gap-3">
        <LabSlider v-model="draft.gaze.yaw" :label="t('lab.yaw')" v-bind="R.yaw" :step="0.5" :decimals="1" />
        <LabSlider
          v-model="draft.gaze.pitch"
          :label="t('lab.pitch')"
          v-bind="R.pitch"
          :step="0.5"
          :decimals="1"
        />
        <LabSlider
          v-model="draft.gaze.roll"
          :label="t('lab.roll')"
          v-bind="R.roll"
          :step="0.5"
          :decimals="1"
        />
      </div>

      <h3 class="mt-5 text-sm font-semibold">{{ t('lab.eyes') }}</h3>
      <label class="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
        <input v-model="draft.eyesLinked" type="checkbox" class="accent-[var(--ink)]" />
        {{ t('lab.linkEyes') }}
      </label>
      <div class="mt-2 flex flex-col gap-3">
        <LabSlider v-model="draft.split" :label="t('lab.split')" v-bind="R.split" :step="0.1" :decimals="1" />
        <LabSlider
          :model-value="draft.eyes[0]!.w"
          :label="t('lab.width')"
          v-bind="R.w"
          :step="0.005"
          :decimals="2"
          @update:model-value="(v) => Object.assign(draft, setEye(draft, 0, { w: v }))"
        />
        <LabSlider
          :model-value="draft.eyes[0]!.h"
          :label="t('lab.height')"
          v-bind="R.h"
          :step="0.005"
          :decimals="2"
          @update:model-value="(v) => Object.assign(draft, setEye(draft, 0, { h: v }))"
        />
        <LabSlider
          :model-value="draft.eyes[0]!.tilt ?? 0"
          :label="t('lab.tilt')"
          v-bind="R.tilt"
          :step="1"
          :decimals="0"
          @update:model-value="(v) => Object.assign(draft, setEye(draft, 0, { tilt: v }))"
        />
        <LabSlider
          :model-value="draft.eyes[0]!.open"
          :label="t('lab.open')"
          v-bind="R.open"
          :step="0.01"
          :decimals="2"
          @update:model-value="(v) => Object.assign(draft, setEye(draft, 0, { open: v }))"
        />
      </div>
      <template v-if="!draft.eyesLinked">
        <p class="mt-3 text-xs text-[var(--muted)]">{{ t('lab.rightEye') }}</p>
        <div class="mt-2 flex flex-col gap-3">
          <LabSlider
            :model-value="draft.eyes[1]!.w"
            :label="t('lab.width')"
            v-bind="R.w"
            :step="0.005"
            :decimals="2"
            @update:model-value="(v) => Object.assign(draft, setEye(draft, 1, { w: v }))"
          />
          <LabSlider
            :model-value="draft.eyes[1]!.h"
            :label="t('lab.height')"
            v-bind="R.h"
            :step="0.005"
            :decimals="2"
            @update:model-value="(v) => Object.assign(draft, setEye(draft, 1, { h: v }))"
          />
          <LabSlider
            :model-value="draft.eyes[1]!.tilt ?? 0"
            :label="t('lab.tilt')"
            v-bind="R.tilt"
            :step="1"
            :decimals="0"
            @update:model-value="(v) => Object.assign(draft, setEye(draft, 1, { tilt: v }))"
          />
          <LabSlider
            :model-value="draft.eyes[1]!.open"
            :label="t('lab.open')"
            v-bind="R.open"
            :step="0.01"
            :decimals="2"
            @update:model-value="(v) => Object.assign(draft, setEye(draft, 1, { open: v }))"
          />
        </div>
      </template>

      <h3 class="mt-5 text-sm font-semibold">{{ t('lab.expression') }}</h3>
      <div class="mt-2 grid grid-cols-4 gap-1.5">
        <BotTile
          v-for="e in EXPRESSIONS"
          :key="e.id"
          :label="t(`expressions.${e.id}`)"
          :selected="e.id === draft.presetId"
          :shape="draft.shapeId === 'custom' ? seedShape : draft.shapeId"
          :color="draft.colorId"
          :expression="e.id"
          :frozen-at="PREVIEW_AT"
          @click="pickPreset(e)"
        />
      </div>

      <div class="mt-4 flex gap-2">
        <button
          type="button"
          class="cursor-pointer rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs hover:bg-black/5"
          @click="resetDraft"
        >
          {{ t('lab.reset') }}
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-lg bg-[var(--ink)] px-2.5 py-1.5 text-xs text-[var(--paper)]"
          @click="applyToAvatar"
        >
          {{ t('lab.apply') }}
        </button>
      </div>
    </template>

    <!-- Import SVG / JSON -->
    <template v-else-if="tab === 'import'">
      <h3 class="mt-4 text-sm font-semibold">{{ t('lab.jsonTitle') }}</h3>
      <p class="mt-1 text-xs leading-relaxed text-[var(--muted)]">{{ t('lab.jsonHint') }}</p>
      <div class="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          class="cursor-pointer rounded-lg bg-[var(--ink)] px-2.5 py-1.5 text-xs text-[var(--paper)]"
          @click="exportJson"
        >
          {{ t('lab.jsonExport') }}
        </button>
        <label
          class="cursor-pointer rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs hover:bg-black/5"
        >
          {{ t('lab.jsonImport') }}
          <input type="file" accept=".json,application/json" class="sr-only" @change="onJsonFile" />
        </label>
      </div>
      <p v-if="jsonStatus === 'ok'" class="mt-2 text-xs text-[var(--ink)]">{{ jsonMessage }}</p>
      <p v-else-if="jsonStatus === 'err'" class="mt-2 text-xs text-[var(--danger)]">{{ jsonMessage }}</p>

      <h3 class="mt-5 text-sm font-semibold">{{ t('lab.svgLabel') }}</h3>
      <p class="mt-1 text-xs leading-relaxed text-[var(--muted)]">{{ t('lab.svgHint') }}</p>
      <label class="mt-3 block">
        <span class="text-xs text-[var(--muted)]">{{ t('lab.svgLabel') }}</span>
        <textarea
          v-model="svgText"
          rows="7"
          class="mt-1 w-full resize-y rounded-lg border border-[var(--line)] bg-white p-2 font-mono text-[11px] leading-snug"
          @change="parseSvg"
        />
      </label>
      <div class="mt-2 flex items-center gap-2">
        <label
          class="cursor-pointer rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs hover:bg-black/5"
        >
          {{ t('lab.svgFile') }}
          <input type="file" accept=".svg,image/svg+xml" class="sr-only" @change="onSvgFile" />
        </label>
        <button
          type="button"
          class="cursor-pointer rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs hover:bg-black/5"
          @click="parseSvg"
        >
          {{ t('lab.parse') }}
        </button>
      </div>
      <p v-if="svgStatus === 'ok'" class="mt-2 text-xs text-[var(--ink)]">{{ t('lab.svgOk') }}</p>
      <p v-else-if="svgStatus === 'err'" class="mt-2 text-xs text-[var(--danger)]">
        {{ t('lab.svgError') }}
      </p>
      <svg
        v-if="svgRadii"
        class="mt-3 block"
        width="80"
        height="80"
        viewBox="0 0 80 80"
        aria-hidden="true"
      >
        <path :d="previewPath(svgRadii)" fill="var(--ink)" />
      </svg>
      <button
        type="button"
        class="mt-3 cursor-pointer rounded-lg bg-[var(--ink)] px-2.5 py-1.5 text-xs text-[var(--paper)] disabled:opacity-40"
        :disabled="!svgRadii"
        @click="applySvg"
      >
        {{ t('lab.svgApply') }}
      </button>
    </template>

    <!-- Mouvements -->
    <template v-else-if="tab === 'motion'">
      <h3 class="mt-5 text-sm font-semibold">{{ t('lab.motion') }}</h3>
      <ul class="mt-2 flex flex-col gap-1">
        <li v-for="id in [...KIRBY_MOTION_IDS, ...AGENT_MOTION_IDS, ...STATE_MOTION_IDS]" :key="id">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition"
            :class="
              selectedMotionId === id
                ? 'bg-[var(--ink)] text-[var(--paper)]'
                : 'text-[var(--ink)] hover:bg-black/5'
            "
            @click="playMotion(motions.find((m) => m.id === id) ?? selectedMotion)"
          >
            <span>{{ motionLabel(id) }}</span>
            <span class="opacity-70">{{ MOTION_BY_ID.get(id)?.loop ? t('lab.loop') : '' }}</span>
          </button>
        </li>
      </ul>

      <h3 class="mt-5 text-sm font-semibold">{{ t('lab.primitives') }}</h3>
      <ul class="mt-2 flex flex-col gap-1.5">
        <li
          v-for="(p, i) in selectedMotion.sequence"
          :key="i"
          class="rounded-lg border border-[var(--line)] p-2"
        >
          <div class="flex items-center justify-between gap-1 text-xs">
            <span>{{ primLabel(p.type) }}</span>
            <span class="flex gap-1">
              <button type="button" class="cursor-pointer px-1" @click="movePrimitive(i, -1)">↑</button>
              <button type="button" class="cursor-pointer px-1" @click="movePrimitive(i, 1)">↓</button>
              <button
                type="button"
                class="cursor-pointer px-1 text-[var(--danger)]"
                :aria-label="t('lab.removePrimitive')"
                @click="removePrimitive(i)"
              >
                ×
              </button>
            </span>
          </div>
          <p v-if="p.type === 'state'" class="mt-1 text-xs text-[var(--muted)]">
            {{ t(`states.${p.state}`) }}
          </p>
          <p v-else-if="p.type === 'expression'" class="mt-1 text-xs text-[var(--muted)]">
            {{ t(`expressions.${p.id as ExpressionId}`) }}
          </p>
          <label
            v-if="p.type !== 'look'"
            class="mt-1 flex items-center gap-2 text-xs"
          >
            <span class="text-[var(--muted)]">{{ t('lab.duration') }}</span>
            <input
              type="number"
              min="0.6"
              max="10"
              step="0.1"
              class="w-16 rounded border border-[var(--line)] px-1 py-0.5"
              :value="primitiveDuration(p)"
              @change="
                setPrimitiveDuration(i, Number(($event.target as HTMLInputElement).value) || 0.6)
              "
            />
          </label>
        </li>
      </ul>
      <div class="mt-2 flex gap-2">
        <select
          v-model="addState"
          class="flex-1 rounded-lg border border-[var(--line)] px-2 py-1 text-xs"
        >
          <option v-for="id in SEQUENCE" :key="id" :value="id">{{ t(`states.${id}`) }}</option>
        </select>
        <button
          type="button"
          class="cursor-pointer rounded-lg border border-[var(--line)] px-2 py-1 text-xs hover:bg-black/5"
          @click="addPrimitive"
        >
          {{ t('lab.addState') }}
        </button>
      </div>
      <p class="mt-3 text-xs text-[var(--muted)]">{{ t('lab.partMotionHint') }}</p>
      <ul v-if="selectedMotion.tracks.length" class="mt-2 flex flex-col gap-1.5">
        <li
          v-for="(tr, i) in selectedMotion.tracks"
          :key="tr.target + i"
          class="flex items-center justify-between rounded-lg border border-[var(--line)] px-2 py-1.5 text-xs"
        >
          <span>{{ tr.target }}</span>
          <button
            type="button"
            class="cursor-pointer px-1 text-[var(--danger)]"
            @click="removeTrack(i)"
          >
            ×
          </button>
        </li>
      </ul>
      <div class="mt-2 flex flex-wrap gap-2">
        <select
          v-model="addPartId"
          class="rounded-lg border border-[var(--line)] px-2 py-1 text-xs"
        >
          <option v-for="id in partTargets()" :key="id" :value="id">{{ partLabel(id) }}</option>
        </select>
        <select
          v-model="addPartKind"
          class="rounded-lg border border-[var(--line)] px-2 py-1 text-xs"
        >
          <option value="part.oscillate">{{ t('lab.prim.oscillate') }}</option>
          <option value="part.rotate">{{ t('lab.prim.rotate') }}</option>
          <option value="part.translate">{{ t('lab.prim.translate') }}</option>
        </select>
        <button
          type="button"
          class="cursor-pointer rounded-lg border border-[var(--line)] px-2 py-1 text-xs hover:bg-black/5"
          @click="addPartPrimitive"
        >
          {{ t('lab.addPartStep') }}
        </button>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          class="cursor-pointer rounded-lg bg-[var(--ink)] px-2.5 py-1.5 text-xs text-[var(--paper)]"
          @click="playing ? stopMotion() : playMotion(selectedMotion)"
        >
          {{ playing ? t('lab.stop') : t('lab.play') }}
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs hover:bg-black/5 disabled:cursor-default disabled:opacity-40"
          :disabled="timelineBlocked"
          @click="sendToTimeline"
        >
          {{ t('lab.sendToTimeline') }}
        </button>
      </div>
      <p v-if="timelineBlocked" class="mt-2 text-xs text-[var(--muted)]">
        {{ t('lab.timelineNoParts') }}
      </p>
    </template>

    <!-- Agent VSM -->
    <template v-else>
      <p class="mt-4 text-xs text-[var(--muted)]">{{ t('lab.current') }}</p>
      <p class="mt-1 text-sm font-semibold">{{ visualLabel(visualId) }}</p>
      <h3 class="mt-4 text-sm font-semibold">{{ t('lab.fire') }}</h3>
      <div class="mt-2 grid grid-cols-2 gap-1.5">
        <button
          v-for="ev in AGENT_EVENTS"
          :key="ev"
          type="button"
          class="cursor-pointer rounded-lg border border-[var(--line)] px-2 py-1.5 text-xs hover:bg-black/5"
          @click="fire(ev)"
        >
          {{ t(`lab.events.${ev}`) }}
        </button>
      </div>
    </template>
  </div>
</template>
