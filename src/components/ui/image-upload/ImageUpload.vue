<template>
  <div class="image-upload">
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label class="text-sm font-medium">{{ label }}</label>
        <span v-if="currentImage" class="text-xs text-muted-foreground">
          已上传图片
        </span>
      </div>

      <!-- 单张图片预览 -->
      <div v-if="currentImage" class="relative">
        <img
          :src="currentImage"
          alt="背景图片"
          class="w-full h-48 object-cover rounded-md border border-border"
        />
        <button
          type="button"
          @click="removeImage"
          class="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 初始上传区域 -->
      <div
        v-else
        class="border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
        @click="triggerFileInput"
        @dragover.prevent
        @dragenter.prevent
        @drop.prevent="handleDrop"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto h-8 w-8 text-muted-foreground mb-2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p class="text-sm text-muted-foreground mb-1">
          点击上传或拖拽图片到此处
        </p>
        <p class="text-xs text-muted-foreground">
          支持 JPG、PNG、GIF、WebP，最大 5MB
        </p>
      </div>

      <!-- 隐藏的文件输入 -->
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        class="hidden"
        @change="handleFileSelect"
      />

      <!-- 上传状态提示 -->
      <div v-if="uploadStatus.message" class="text-xs" :class="uploadStatus.type === 'error' ? 'text-destructive' : 'text-green-600'">
        {{ uploadStatus.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  modelValue?: string
  label?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  label: '上传图片'
})

const emit = defineEmits<Emits>()

const fileInput = ref<HTMLInputElement>()
const uploadStatus = ref<{ type: 'success' | 'error' | ''; message: string }>({
  type: '',
  message: ''
})

const currentImage = computed({
  get: () => {
    const value = props.modelValue
    return value || ''
  },
  set: (value) => {
    emit('update:modelValue', value)
  }
})

// 触发文件选择
const triggerFileInput = () => {
  fileInput.value?.click()
}

// 处理文件选择
const handleFileSelect = async (event: Event) => {
  console.log('文件选择触发')
  const target = event.target as HTMLInputElement
  const files = target.files
  console.log('选择的文件:', files)

  if (files && files.length > 0) {
    const file = files[0]
    console.log('处理第一个文件:', file.name)
    await handleFile(file)

    // 重置文件输入，允许重复选择同一文件
    target.value = ''
  } else {
    console.log('没有选择文件')
  }
}

// 处理拖拽
const handleDrop = async (event: DragEvent) => {
  console.log('拖拽文件触发')
  const files = event.dataTransfer?.files
  console.log('拖拽的文件:', files)

  if (files && files.length > 0) {
    const file = files[0]
    console.log('处理第一个拖拽文件:', file.name)
    await handleFile(file)
  } else {
    console.log('没有拖拽文件')
  }
}

// 处理文件
const handleFile = async (file: File) => {
  try {
    console.log('开始处理文件:', file.name, file.size, file.type)

    // 验证文件
    validateImageFile(file)
    console.log('文件验证通过')

    uploadStatus.value = {
      type: '',
      message: '正在上传...'
    }

    // 读取文件为base64
    const reader = new FileReader()

    reader.onload = (event) => {
      console.log('文件读取完成，开始处理')
      const base64 = event.target?.result as string
      console.log('Base64长度:', base64.length)

      // 直接设置新图片，替换之前的图片
      currentImage.value = base64
      console.log('图片已更新')

      uploadStatus.value = {
        type: 'success',
        message: '图片上传成功'
      }

      // 3秒后清除提示
      setTimeout(() => {
        uploadStatus.value = { type: '', message: '' }
      }, 3000)
    }

    reader.onerror = (error) => {
      console.error('FileReader错误:', error)
      throw new Error('图片读取失败')
    }

    reader.onabort = () => {
      console.error('FileReader被中止')
      throw new Error('图片读取被中止')
    }

    console.log('开始读取文件...')
    reader.readAsDataURL(file)

  } catch (error) {
    console.error('处理文件时出错:', error)
    uploadStatus.value = {
      type: 'error',
      message: error instanceof Error ? error.message : '上传失败'
    }
  }
}

// 验证图片文件
const validateImageFile = (file: File) => {
  console.log('验证文件:', file.type, file.size)
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  const maxSize = 5 * 1024 * 1024 // 5MB

  if (!validTypes.includes(file.type)) {
    console.error('不支持的文件类型:', file.type)
    throw new Error('仅支持 JPG、PNG、GIF、WebP 格式的图片')
  }

  if (file.size > maxSize) {
    console.error('文件过大:', file.size)
    throw new Error('图片大小不能超过 5MB')
  }

  console.log('文件验证通过')
}

// 移除图片
const removeImage = () => {
  currentImage.value = ''
  uploadStatus.value = {
    type: 'success',
    message: '图片已删除'
  }

  // 3秒后清除提示
  setTimeout(() => {
    uploadStatus.value = { type: '', message: '' }
  }, 3000)
}
</script>