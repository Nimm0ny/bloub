<script setup lang="ts">
import { computed } from 'vue'
import { nombre } from '@/i18n'

/**
 * Curseur etiquete du laboratoire. Native `range`, comme le zoom de la piste :
 * clavier, pas, lecteur d'ecran. La valeur est un nombre, l'unite est de
 * l'etiquette, pas du composant.
 */
const value = defineModel<number>({ required: true })
const props = withDefaults(
  defineProps<{
    label: string
    min: number
    max: number
    step?: number
    decimals?: number
  }>(),
  { step: 0.01, decimals: 1 }
)

const shown = computed(() => nombre(value.value, props.decimals))

function onInput(e: Event) {
  value.value = Number((e.target as HTMLInputElement).value)
}
</script>

<template>
  <label class="block">
    <span class="flex items-baseline justify-between gap-2 text-xs">
      <span class="text-[var(--muted)]">{{ label }}</span>
      <span class="tabular-nums text-[var(--ink)]">{{ shown }}</span>
    </span>
    <input
      type="range"
      class="mt-1 h-1 w-full cursor-pointer accent-[var(--ink)]"
      :min="min"
      :max="max"
      :step="step"
      :value="value"
      :aria-label="label"
      :aria-valuetext="shown"
      @input="onInput"
    />
  </label>
</template>
