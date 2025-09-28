<template>
  <div class="blur-slider space-y-4">
    <div class="flex items-center justify-between">
      <label class="text-sm font-medium">{{ label }}</label>
      <span class="text-xs text-muted-foreground">{{ props.modelValue }}px</span>
    </div>

    <div class="space-y-4">
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

      <!-- 无级调节滑块 -->
      <div class="space-y-2 relative">
        <div class="flex items-center justify-between">
          <span class="text-xs text-muted-foreground">{{ props.min }}px</span>
          <span class="text-xs text-muted-foreground">{{ props.max }}px</span>
        </div>
        <div class="relative">
          <input
            type="range"
            :min="props.min"
            :max="props.max"
            :step="props.step"
            :value="props.modelValue"
            @input="handleSliderInput"
            @mousemove="updateTooltipPosition"
            @mouseenter="showTooltip = true"
            @mouseleave="showTooltip = false"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            ref="sliderRef"
          />
          <!-- 实时数值指示器 -->
          <div
            v-if="showTooltip"
            class="absolute -top-8 transform -translate-x-1/2 bg-primary text-primary-foreground px-2 py-1 rounded-md text-xs font-medium shadow-lg z-10 transition-all duration-200"
            :style="tooltipStyle"
          >
            {{ props.modelValue }}px
            <div class="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-primary rotate-45"></div>
          </div>
        </div>
      </div>

      <!-- 快捷选项（可选） -->
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
import { computed, ref, onMounted, nextTick, watch } from 'vue'

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

const sliderRef = ref<HTMLInputElement>()
const showTooltip = ref(false)
const tooltipPosition = ref(0)

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

// 更新进度条样式函数
const updateProgressStyle = () => {
  if (sliderRef.value) {
    const value = parseInt(sliderRef.value.value)
    const min = parseInt(sliderRef.value.min)
    const max = parseInt(sliderRef.value.max)
    const percentage = ((value - min) / (max - min)) * 100
    sliderRef.value.style.setProperty('--progress', `${percentage}%`)
  }
}

const handleSliderInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  const value = parseInt(target.value)
  emit('update:modelValue', value)
  updateTooltipPosition(event)
  updateProgressStyle()
}

const setPreset = (value: number) => {
  emit('update:modelValue', value)
  // 更新工具提示位置和进度条样式
  if (sliderRef.value) {
    const min = parseInt(sliderRef.value.min)
    const max = parseInt(sliderRef.value.max)
    const percentage = (value - min) / (max - min)
    tooltipPosition.value = percentage * 100
    updateProgressStyle()
  }
}

const updateTooltipPosition = (event: Event) => {
  if (!sliderRef.value) return
  
  const target = event.target as HTMLInputElement
  const value = parseInt(target.value)
  const min = parseInt(target.min)
  const max = parseInt(target.max)
  
  // 计算滑块位置百分比
  const percentage = (value - min) / (max - min)
  tooltipPosition.value = percentage * 100
}

const tooltipStyle = computed(() => {
  return {
    left: `${tooltipPosition.value}%`
  }
})

onMounted(() => {
  nextTick(() => {
    if (sliderRef.value) {
      // 初始化工具提示位置和进度条样式
      const value = parseInt(sliderRef.value.value)
      const min = parseInt(sliderRef.value.min)
      const max = parseInt(sliderRef.value.max)
      const percentage = (value - min) / (max - min)
      tooltipPosition.value = percentage * 100
      updateProgressStyle()
    }
  })
})

// 监听modelValue变化，更新进度条样式
watch(() => props.modelValue, () => {
  updateProgressStyle()
})
</script>

<style scoped>
input[type="range"] {
  background: linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) var(--progress, 0%), hsl(var(--muted)) var(--progress, 0%), hsl(var(--muted)) 100%);
  border-radius: 8px;
  height: 6px;
  outline: none;
  transition: background 0.2s ease;
}

input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  background: hsl(var(--primary));
  cursor: pointer;
  border-radius: 50%;
  border: 2px solid hsl(var(--background));
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

input[type="range"]::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: hsl(var(--primary));
  cursor: pointer;
  border-radius: 50%;
  border: 2px solid hsl(var(--background));
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

input[type="range"]::-moz-range-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

input[type="range"]::-webkit-slider-track {
  background: transparent;
  border: none;
}

input[type="range"]::-moz-range-track {
  background: transparent;
  border: none;
}

/* 实时数值指示器样式优化 */
.relative .absolute {
  pointer-events: none;
}

/* 预设按钮样式优化 */
.grid button {
  transition: all 0.2s ease;
}

.grid button:hover {
  transform: translateY(-1px);
}

.grid button:active {
  transform: translateY(0);
}
</style>