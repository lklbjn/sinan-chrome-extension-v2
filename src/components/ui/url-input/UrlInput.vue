<template>
  <div class="url-input">
    <div class="space-y-4">
      <div class="space-y-2">
        <label class="text-sm font-medium">{{ label }}</label>
        <div class="text-xs text-muted-foreground">
          已添加 {{ urls.length }} 个网址
        </div>
      </div>

      <!-- 批量导入区域 -->
      <div class="space-y-2">
        <Textarea
          v-model="batchInput"
          placeholder="批量导入网址，每行一个网址&#10;例如：&#10;https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
          :rows="6"
          class="resize-none"
        />
        <div class="flex gap-2">
          <Button
            @click="handleBatchImport"
            :disabled="!batchInput.trim()"
            size="sm"
          >
            批量导入
          </Button>
          <Button
            @click="clearBatchInput"
            variant="outline"
            size="sm"
          >
            清空
          </Button>
        </div>
      </div>

      <!-- 单个网址添加 -->
      <div class="space-y-2">
        <div class="flex gap-2">
          <Input
            v-model="singleUrl"
            placeholder="输入单个图片网址"
            @keyup.enter="handleSingleAdd"
          />
          <Button
            @click="handleSingleAdd"
            :disabled="!isValidUrl(singleUrl)"
            size="sm"
          >
            添加
          </Button>
        </div>
      </div>

      <!-- 网址列表 -->
      <div v-if="urls.length > 0" class="space-y-2">
        <div class="text-sm font-medium">网址列表</div>
        <div class="space-y-1 max-h-40 overflow-y-auto">
          <div
            v-for="(url, index) in urls"
            :key="index"
            class="flex items-center justify-between p-2 bg-muted rounded-md"
          >
            <div class="flex-1 min-w-0">
              <div class="text-sm truncate">{{ url }}</div>
            </div>
            <Button
              @click="removeUrl(index)"
              variant="ghost"
              size="sm"
              class="ml-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </div>
        <div class="flex gap-2">
          <Button
            @click="clearAllUrls"
            variant="outline"
            size="sm"
          >
            清空所有
          </Button>
          <div class="text-xs text-muted-foreground ml-auto flex items-center">
            每次打开新标签页会随机选择一个网址
          </div>
        </div>
      </div>

      <!-- 验证错误提示 -->
      <div v-if="errorMessage" class="text-sm text-destructive">
        {{ errorMessage }}
      </div>

      <!-- 成功提示 -->
      <div v-if="successMessage" class="text-sm text-green-600">
        {{ successMessage }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Textarea from "@/components/ui/textarea/Textarea.vue";

interface Props {
  modelValue?: string[]
  label?: string
}

interface Emits {
  (e: 'update:modelValue', value: string[]): void
}

const props = withDefaults(defineProps<Props>(), {
  label: '背景图片网址'
})

const emit = defineEmits<Emits>()

const batchInput = ref('')
const singleUrl = ref('')
const errorMessage = ref('')
const successMessage = ref('')

const urls = computed({
  get: () => {
    const value = props.modelValue || []
    console.log('urls.get 获取到的值:', value)
    console.log('props.modelValue:', props.modelValue)
    console.log('props.modelValue 类型:', typeof props.modelValue)
    console.log('是否为数组:', Array.isArray(value))
    console.log('value === null:', value === null)
    console.log('value === undefined:', value === undefined)

    const result = Array.isArray(value) ? value : []
    console.log('最终返回值:', result)
    return result
  },
  set: (value) => {
    console.log('urls.set 开始设置')
    console.log('要设置的值:', value)
    console.log('是否为数组:', Array.isArray(value))

    if (!Array.isArray(value)) {
      console.error('尝试设置非数组值:', value)
      return
    }

    emit('update:modelValue', value)
    console.log('已发送 update:modelValue 事件')
  }
})

// 验证URL格式
const isValidUrl = (url: string): boolean => {
  if (!url.trim()) return false

  try {
    const urlObj = new URL(url.trim())
    const isValid = urlObj.protocol === 'http:' || urlObj.protocol === 'https:'

    // 调试信息
    console.log('isValidUrl 调试:')
    console.log('  原始URL:', url)
    console.log('  修剪后URL:', url.trim())
    console.log('  URL对象:', urlObj)
    console.log('  协议:', urlObj.protocol)
    console.log('  是否有效:', isValid)

    return isValid
  } catch (error) {
    console.log('isValidUrl 捕获异常:', error)
    return false
  }
}

// 验证是否为图片URL
const isImageUrl = (url: string): boolean => {
  if (!isValidUrl(url)) return false

  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']
  const urlLower = url.toLowerCase()

  // 检查URL是否包含图片扩展名（不一定要在结尾）
  const hasImageExtension = imageExtensions.some(ext => urlLower.includes(ext))

  // 调试信息
  console.log('isImageUrl 调试:')
  console.log('  URL:', url)
  console.log('  urlLower:', urlLower)
  console.log('  hasImageExtension:', hasImageExtension)
  console.log('  includes image:', urlLower.includes('image'))
  console.log('  includes img:', urlLower.includes('img'))
  console.log('  includes /images/:', urlLower.includes('/images/'))

  const result = hasImageExtension ||
         urlLower.includes('image') ||
         urlLower.includes('img') ||
         urlLower.includes('photo') ||
         urlLower.includes('picsum') ||
         urlLower.includes('unsplash') ||
         urlLower.includes('/images/') ||
         urlLower.includes('/img/')

  console.log('  最终结果:', result)
  return result
}

// 处理批量导入
const handleBatchImport = () => {
  try {
    errorMessage.value = ''
    successMessage.value = ''

    const urlLines = batchInput.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)

    console.log('批量导入的URL列表:', urlLines)

    const validUrls: string[] = []
    const invalidUrls: string[] = []

    urlLines.forEach(url => {
      try {
        console.log(`验证URL: ${url}`)
        console.log(`  isValidUrl: ${isValidUrl(url)}`)
        console.log(`  isImageUrl: ${isImageUrl(url)}`)

        if (isValidUrl(url) && isImageUrl(url)) {
          validUrls.push(url)
          console.log(`  ✓ 通过图片URL验证`)
        } else if (isValidUrl(url)) {
          // 即使不确定是图片，只要是有效URL就添加
          validUrls.push(url)
          console.log(`  ✓ 通过URL验证（不确定是否为图片）`)
        } else {
          invalidUrls.push(url)
          console.log(`  ✗ 验证失败`)
        }
      } catch (error) {
        console.error(`验证单个URL时发生异常: ${url}`, error)
        invalidUrls.push(url)
      }
    })

    if (validUrls.length > 0) {
      try {
        console.log('当前 urls.value:', urls.value)
        console.log('是否为数组:', Array.isArray(urls.value))

        const currentUrls = Array.isArray(urls.value) ? urls.value : []
        const newUrls = [...currentUrls, ...validUrls]

        console.log('合并后的 URLs:', newUrls)

        // 去重
        const uniqueUrls = [...new Set(newUrls)]
        console.log('去重后的 URLs:', uniqueUrls)

        urls.value = uniqueUrls

        successMessage.value = `成功导入 ${validUrls.length} 个网址`
        batchInput.value = ''

        // 3秒后清除成功提示
        setTimeout(() => {
          successMessage.value = ''
        }, 3000)
      } catch (error) {
        console.error('处理 URLs 时发生异常:', error)
        errorMessage.value = '处理网址时发生错误'
      }
    }

    if (invalidUrls.length > 0) {
      errorMessage.value = `以下网址格式无效：${invalidUrls.slice(0, 3).join(', ')}${invalidUrls.length > 3 ? '...' : ''}`

      // 5秒后清除错误提示
      setTimeout(() => {
        errorMessage.value = ''
      }, 5000)
    }
  } catch (error) {
    console.error('批量导入异常:', error)
    console.error('异常详情:', error instanceof Error ? error.message : error)
    console.error('异常堆栈:', error instanceof Error ? error.stack : '无堆栈信息')
    errorMessage.value = `导入失败: ${error instanceof Error ? error.message : '请检查网址格式'}`
    setTimeout(() => {
      errorMessage.value = ''
    }, 3000)
  }
}

// 处理单个网址添加
const handleSingleAdd = () => {
  try {
    errorMessage.value = ''
    successMessage.value = ''

    const url = singleUrl.value.trim()

    if (!url) {
      errorMessage.value = '请输入网址'
      return
    }

    if (!isValidUrl(url)) {
      errorMessage.value = '网址格式无效'
      return
    }

    if (urls.value.includes(url)) {
      errorMessage.value = '该网址已存在'
      return
    }

    const newUrls = [...urls.value, url]
    urls.value = newUrls
    singleUrl.value = ''

    successMessage.value = '网址添加成功'

    // 3秒后清除提示
    setTimeout(() => {
      successMessage.value = ''
      errorMessage.value = ''
    }, 3000)
  } catch (error) {
    errorMessage.value = '添加失败'
    setTimeout(() => {
      errorMessage.value = ''
    }, 3000)
  }
}

// 移除单个网址
const removeUrl = (index: number) => {
  try {
    const currentUrls = Array.isArray(urls.value) ? urls.value : []
    const newUrls = currentUrls.filter((_, i) => i !== index)
    urls.value = newUrls

    successMessage.value = '网址已删除'
    setTimeout(() => {
      successMessage.value = ''
    }, 2000)
  } catch (error) {
    console.error('删除网址时发生异常:', error)
  }
}

// 清空所有网址
const clearAllUrls = () => {
  urls.value = []
  successMessage.value = '已清空所有网址'

  setTimeout(() => {
    successMessage.value = ''
  }, 2000)
}

// 清空批量输入
const clearBatchInput = () => {
  batchInput.value = ''
  errorMessage.value = ''
}

// 监听 props.modelValue 变化
watch(() => props.modelValue, (newValue, oldValue) => {
  console.log('props.modelValue 变化:')
  console.log('  旧值:', oldValue)
  console.log('  新值:', newValue)
  console.log('  新值类型:', typeof newValue)
  console.log('  新值是否为数组:', Array.isArray(newValue))
}, { deep: true })

// 监听错误信息，自动清除
watch(errorMessage, (newError) => {
  if (newError) {
    setTimeout(() => {
      errorMessage.value = ''
    }, 5000)
  }
})
</script>