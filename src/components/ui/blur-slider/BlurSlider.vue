<template>
  <div class="blur-slider space-y-2">
    <div class="flex items-center justify-between">
      <label class="text-sm font-medium">{{ label }}</label>
      <span class="text-xs text-muted-foreground">{{ props.modelValue }}px</span>
    </div>

    <div class="space-y-2">
      <!-- 预览区域 -->
      <div class="relative h-16 rounded-md overflow-hidden border border-border">
        <!-- 背景图片 -->
        <img
          src="https://picsum.photos/seed/preview/400/100.jpg"
          alt="预览背景"
          class="absolute inset-0 w-full h-full object-cover"
        />

        <!-- 毛玻璃效果预览层 -->
        <div
          class="absolute inset-0 bg-white/50 flex items-center justify-center text-xs text-foreground"
          :style="blurStyle"
        >
          毛玻璃效果预览
        </div>
      </div>

      <!-- 快捷选项 -->
      <div class="grid grid-cols-5 gap-1">
        <button
          v-for="preset in presets"
          :key="preset.value"
          @click="setPreset(preset.value)"
          class="px-2 py-1 text-xs rounded border border-border hover:bg-muted transition-colors text-center"
          :class="{ 'bg-primary text-primary-foreground': props.modelValue === preset.value }"
        >
          {{ preset.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: number
  label?: string
  min?: number
  max?: number
  step?: number
}

interface Emits {
  (e: 'update:modelValue', value: number): void
}

const props = withDefaults(defineProps<Props>(), {
  label: '毛玻璃力度',
  min: 0,
  max: 20,
  step: 1
})

const emit = defineEmits<Emits>()

const presets = [
  { value: 0, label: '无' },
  { value: 5, label: '轻微' },
  { value: 10, label: '适中' },
  { value: 15, label: '强烈' },
  { value: 20, label: '最强' }
]

const blurStyle = computed(() => {
  if (props.modelValue === 0) {
    return ''
  }
  return `backdrop-filter: blur(${props.modelValue}px); -webkit-backdrop-filter: blur(${props.modelValue}px);`
})

const setPreset = (value: number) => {
  emit('update:modelValue', value)
}
</script>

<style scoped>
input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: hsl(var(--primary));
  cursor: pointer;
  border-radius: 50%;
}

input[type="range"]::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: hsl(var(--primary));
  cursor: pointer;
  border-radius: 50%;
  border: none;
}
</style>