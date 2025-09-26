<template>
  <div class="multi-select">
    <div class="relative">
      <button
        type="button"
        class="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        @click="toggleDropdown"
        @keydown.escape="closeDropdown"
        @keydown.enter.prevent="toggleDropdown"
        @keydown.space.prevent="toggleDropdown"
        @keydown.arrow-down.prevent="openDropdown"
      >
        <div class="flex items-center gap-1 max-w-full">
          <div
            v-if="selectedItems.length === 0"
            class="text-muted-foreground"
          >
            {{ placeholder }}
          </div>
          <!-- 显示第一个标签 -->
          <div
            v-if="selectedItems.length > 0"
            class="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs"
            :style="{ backgroundColor: selectedItems[0].color + '20', color: selectedItems[0].color }"
          >
            {{ selectedItems[0].name }}
            <button
              type="button"
              class="ml-1 h-3 w-3 rounded-full hover:bg-current hover:bg-opacity-20"
              @click.stop="removeItem(selectedItems[0].id)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <!-- 显示剩余数量 -->
          <div
            v-if="selectedItems.length > 1"
            class="inline-flex items-center rounded-sm px-2 py-0.5 text-xs bg-muted text-muted-foreground"
          >
            +{{ selectedItems.length - 1 }}
          </div>
        </div>
        <div class="ml-2 h-4 w-4 opacity-50">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            :class="{ 'rotate-180': isOpen }"
            class="transition-transform duration-200"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      <!-- Dropdown -->
      <div
        v-if="isOpen"
        class="absolute z-50 bottom-full mb-1 w-full rounded-md border bg-popover p-1 shadow-md max-h-[200px] overflow-y-auto"
      >
        <div
          v-for="item in items"
          :key="item.id"
          class="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
          @click="toggleItem(item)"
        >
          <div class="flex items-center space-x-2">
            <div
              class="h-4 w-4 rounded border-2 flex items-center justify-center"
              :class="{
                'bg-primary border-primary': isSelected(item.id),
                'border-input': !isSelected(item.id)
              }"
            >
              <svg
                v-if="isSelected(item.id)"
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="text-primary-foreground"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div class="flex items-center space-x-2">
              <div
                class="w-3 h-3 rounded-full"
                :style="{ backgroundColor: item.color }"
              />
              <span>{{ item.name }}</span>
            </div>
          </div>
        </div>
        <div v-if="items.length === 0" class="px-2 py-1.5 text-sm text-muted-foreground">
          暂无标签
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { TagResp } from '../../../shared/types/api'

interface Props {
  items: TagResp[]
  modelValue: string[]
  placeholder?: string
}

interface Emits {
  (e: 'update:modelValue', value: string[]): void
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '选择标签'
})

const emit = defineEmits<Emits>()

const isOpen = ref(false)

const selectedItems = computed(() =>
  props.items.filter(item => props.modelValue.includes(item.id))
)

const isSelected = (id: string) => props.modelValue.includes(id)

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const openDropdown = () => {
  isOpen.value = true
}

const closeDropdown = () => {
  isOpen.value = false
}

const toggleItem = (item: TagResp) => {
  const newValue = isSelected(item.id)
    ? props.modelValue.filter(id => id !== item.id)
    : [...props.modelValue, item.id]

  emit('update:modelValue', newValue)
}

const removeItem = (id: string) => {
  const newValue = props.modelValue.filter(selectedId => selectedId !== id)
  emit('update:modelValue', newValue)
}

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.multi-select')) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>