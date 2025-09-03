<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { onMounted, ref, computed, watch } from 'vue'
import { SinanApiService } from '../../shared/services/api'
import type { BookmarkResp } from '../../shared/types/api'

const bookmarks = ref<BookmarkResp[]>([])
const searchQuery = ref('')
const isLoading = ref(true)
const isRefreshing = ref(false)
const isSearching = ref(false)
const searchDebounceTimer = ref<number>()
const errorAlert = ref<{ show: boolean; message: string }>({
  show: false,
  message: ''
})

// 暗黑模式状态
const isDarkMode = ref(false)

// 计算屏幕可显示的书签数量
const calculateBookmarksLimit = () => {
  const screenWidth = window.innerWidth
  const screenHeight = window.innerHeight

  // 减去页面边距和其他元素的高度
  const pageMargin = 64  // p-8 = 32px * 2
  const titleHeight = 100  // "Welcome back!" 标题和描述区域
  const searchBoxHeight = 88  // 搜索框 + mb-8 间距
  const errorAlertHeight = errorAlert.value.show ? 60 : 0  // 错误提示高度
  const availableHeight = screenHeight - pageMargin - titleHeight - searchBoxHeight - errorAlertHeight

  // 书签卡片尺寸
  const cardHeight = 62 + 16  // h-[62px] + gap-4
  const cardMinWidth = 300 + 16  // minmax(300px) + gap-4

  // 计算每行可放置的卡片数量
  const cardsPerRow = Math.floor((screenWidth - pageMargin) / cardMinWidth)

  // 计算可显示的行数
  const rowsCount = Math.floor(availableHeight / cardHeight)

  // 总书签数量，至少20个，最多200个
  const totalBookmarks = Math.max(20, Math.min(200, cardsPerRow * rowsCount))

  console.log(`屏幕尺寸: ${screenWidth}x${screenHeight}`)
  console.log(`可用高度: ${availableHeight}px (减去标题${titleHeight}px, 搜索框${searchBoxHeight}px, 边距${pageMargin}px)`)
  console.log(`每行卡片数: ${cardsPerRow}, 行数: ${rowsCount}`)
  console.log(`计算的书签数量: ${totalBookmarks}`)

  return totalBookmarks
}

// 搜索书签的函数
const searchBookmarks = async (query: string) => {
  try {
    isSearching.value = true
    errorAlert.value.show = false

    let response
    if (query.trim()) {
      // 有搜索关键词时调用搜索接口
      response = await SinanApiService.searchBookmarks(query.trim())
    } else {
      // 无搜索关键词时获取最常访问的书签
      const limit = calculateBookmarksLimit()
      response = await SinanApiService.getMostVisitedBookmarks({ limit })
    }

    if (response.code === 0) {
      bookmarks.value = response.data
      console.log('搜索完成:', response.data.length, '个书签')
    } else if (response.code === -1) {
      errorAlert.value = {
        show: true,
        message: response.message
      }
      console.error('搜索API返回错误:', response.message)
    }
  } catch (error) {
    console.error('搜索时出错:', error)
    errorAlert.value = {
      show: true,
      message: `搜索失败: ${error instanceof Error ? error.message : String(error)}`
    }
  } finally {
    isSearching.value = false
  }
}

// 防抖搜索
const debouncedSearch = (query: string) => {
  if (searchDebounceTimer.value) {
    clearTimeout(searchDebounceTimer.value)
  }
  
  searchDebounceTimer.value = setTimeout(() => {
    searchBookmarks(query)
  }, 300) // 300ms 防抖
}

const filteredBookmarks = computed(() => {
  // 现在直接返回从 API 获取的书签数据
  return bookmarks.value
})

const loadMostVisitedBookmarks = async () => {
  try {
    errorAlert.value.show = false

    // 动态计算需要的书签数量
    const limit = calculateBookmarksLimit()
    const response = await SinanApiService.getMostVisitedBookmarks({ limit })

    if (response.code === 0) {
      bookmarks.value = response.data
      console.log('加载最常访问书签成功:', response.data.length, '个书签')
    } else if (response.code === -1) {
      errorAlert.value = {
        show: true,
        message: response.message
      }
      console.error('API返回错误:', response.message)
    } else {
      console.error('加载最常访问书签失败:', response.message)
    }
  } catch (error) {
    console.error('加载书签时出错:', error)
    errorAlert.value = {
      show: true,
      message: `网络请求失败: ${error instanceof Error ? error.message : String(error)}`
    }
  } finally {
    isLoading.value = false
    isRefreshing.value = false
  }
}

const handleBookmarkClick = async (bookmark: BookmarkResp, event: MouseEvent) => {
  // 阻止默认行为
  event.preventDefault()

  console.log('点击事件详情:', {
    button: event.button,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    bookmark: bookmark.name
  })

  try {
    // 调用increment-usage接口
    const response = await SinanApiService.incrementBookmarkUsage(bookmark.id)

    if (response.code === 0) {
      console.log('书签使用次数已增加:', bookmark.name)
    } else if (response.code === -1) {
      console.error('增加使用次数API错误:', response.message)
      errorAlert.value = {
        show: true,
        message: `更新使用次数失败: ${response.message}`
      }
      // 3秒后自动隐藏错误提示
      setTimeout(() => {
        errorAlert.value.show = false
      }, 3000)
    }
  } catch (error) {
    console.error('增加书签使用次数失败:', error)
  }

  // 根据点击方式打开书签
  if (event.button === 1 || event.ctrlKey || event.metaKey) {
    // 鼠标中键、Ctrl+点击、Cmd+点击：在新标签页打开但不跳转
    console.log('在后台标签页打开书签:', bookmark.url)
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: bookmark.url, active: false })
    } else {
      // 开发环境fallback
      window.open(bookmark.url, '_blank')
    }
  } else {
    // 鼠标左键：在当前标签页打开
    console.log('在当前标签页打开书签:', bookmark.url)
    window.location.href = bookmark.url
  }
}

const handleMouseDown = (bookmark: BookmarkResp, event: MouseEvent) => {
  // 只处理鼠标中键
  if (event.button === 1) {
    event.preventDefault()
    // 直接处理中键点击，避免与click事件冲突
    incrementUsageAndOpenBackground(bookmark)
  }
}

const incrementUsageAndOpenBackground = async (bookmark: BookmarkResp) => {
  try {
    // 调用increment-usage接口
    const response = await SinanApiService.incrementBookmarkUsage(bookmark.id)

    if (response.code === 0) {
      console.log('书签使用次数已增加:', bookmark.name)
    } else if (response.code === -1) {
      console.error('增加使用次数API错误:', response.message)
      errorAlert.value = {
        show: true,
        message: `更新使用次数失败: ${response.message}`
      }
      setTimeout(() => {
        errorAlert.value.show = false
      }, 3000)
    }
  } catch (error) {
    console.error('增加书签使用次数失败:', error)
  }

  // 在后台标签页打开
  console.log('在后台标签页打开书签:', bookmark.url)
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.create({ url: bookmark.url, active: false })
  } else {
    window.open(bookmark.url, '_blank')
  }
}

const handleRefresh = async () => {
  if (isRefreshing.value) return
  isRefreshing.value = true
  await loadMostVisitedBookmarks()
}

const openSinanHomepage = () => {
  const sinanUrl = 'https://sinan.host'
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.create({ url: sinanUrl, active: true })
  } else {
    window.open(sinanUrl, '_blank')
  }
}

const getFavicon = (url: string) => {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch {
    return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>'
  }
}

// 切换暗黑模式
const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value
  if (isDarkMode.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  // 保存到本地存储
  localStorage.setItem('darkMode', isDarkMode.value.toString())
}

onMounted(() => {
  // 从本地存储读取暗黑模式设置
  const savedDarkMode = localStorage.getItem('darkMode')
  if (savedDarkMode === 'true') {
    isDarkMode.value = true
    document.documentElement.classList.add('dark')
  } else if (savedDarkMode === 'false') {
    isDarkMode.value = false
    document.documentElement.classList.remove('dark')
  } else {
    // 如果没有保存的设置，使用系统偏好
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    isDarkMode.value = prefersDark
    if (prefersDark) {
      document.documentElement.classList.add('dark')
    }
  }

  loadMostVisitedBookmarks()

  // 监听窗口大小变化，重新计算书签数量
  let resizeTimeout: number
  const handleResize = () => {
    clearTimeout(resizeTimeout)
    resizeTimeout = setTimeout(() => {
      if (!isLoading.value && !isRefreshing.value) {
        loadMostVisitedBookmarks()
      }
    }, 300) // 防抖300ms
  }

  window.addEventListener('resize', handleResize)

  // 监听系统主题变化
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleThemeChange = (e: MediaQueryListEvent) => {
    // 只有在用户没有手动设置过时才自动切换
    if (localStorage.getItem('darkMode') === null) {
      isDarkMode.value = e.matches
      if (e.matches) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }
  mediaQuery.addEventListener('change', handleThemeChange)

  // 组件卸载时清理事件监听
  return () => {
    window.removeEventListener('resize', handleResize)
    mediaQuery.removeEventListener('change', handleThemeChange)
    clearTimeout(resizeTimeout)
    if (searchDebounceTimer.value) {
      clearTimeout(searchDebounceTimer.value)
    }
  }
})

// 监听搜索输入变化
watch(searchQuery, (newQuery) => {
  debouncedSearch(newQuery)
}, { immediate: false })
</script>

<template>
  <div class="min-h-screen bg-background text-foreground p-8">
    <!-- 顶部区域 -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-4xl font-bold mb-2">Welcome back!</h1>
        <p class="text-muted-foreground">你从哪个应用开始以下是你最常用的应用</p>
      </div>
      <div class="flex items-center gap-2">
        <!-- Sinan 主页按钮 -->
        <Button variant="outline" size="icon" @click="openSinanHomepage" class="h-10 w-10">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9,22 9,12 15,12 15,22" />
          </svg>
        </Button>
        <!-- 暗黑模式切换按钮 -->
        <Button variant="outline" size="icon" @click="toggleDarkMode" class="h-10 w-10">
          <!-- 太阳图标（浅色模式） -->
          <svg v-if="isDarkMode" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          <!-- 月亮图标（暗黑模式） -->
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </Button>
        <!-- 刷新按钮 -->
        <Button variant="outline" size="icon" @click="handleRefresh" :disabled="isRefreshing" class="h-10 w-10">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          :class="{ 'animate-spin': isRefreshing }">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
        </Button>
      </div>
    </div>

    <!-- 搜索框 -->
    <div class="mb-8 max-w-md mx-auto relative">
      <Input v-model="searchQuery" placeholder="搜索书签名称、网址、描述或标签..." class="w-full" />
      <div v-if="isSearching" class="absolute right-3 top-1/2 transform -translate-y-1/2">
        <svg class="animate-spin h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    </div>

    <!-- 错误提示 -->
    <Alert v-if="errorAlert.show" variant="destructive" class="mb-6 max-w-2xl">
      <AlertDescription>
        {{ errorAlert.message }}
      </AlertDescription>
    </Alert>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="flex items-center justify-center h-64">
      <div class="text-muted-foreground">加载中...</div>
    </div>

    <!-- 书签网格 -->
    <div v-else-if="filteredBookmarks.length > 0" class="grid gap-4 auto-fill-grid">
      <div v-for="bookmark in filteredBookmarks" :key="bookmark.id" @click="handleBookmarkClick(bookmark, $event)"
        @mousedown="handleMouseDown(bookmark, $event)" @contextmenu.prevent :class="[
                'flex items-center gap-3 p-3 rounded-lg border bg-card text-card-foreground transition-all cursor-pointer overflow-hidden',
                bookmark.star 
                  ? 'shadow-sm hover:shadow-[0_0_20px_rgba(251,191,36,0.3)] border-amber-200/50 dark:border-amber-400/30 dark:hover:shadow-[0_0_20px_rgba(251,191,36,0.2)]' 
                  : 'shadow-sm hover:shadow-md dark:hover:shadow-lg'
              ]">
        <div class="flex items-center gap-3 h-full w-full overflow-hidden">
          <img :src="getFavicon(bookmark.url)" :alt="bookmark.name" class="w-8 h-8 rounded flex-shrink-0"
            @error="($event.target as HTMLImageElement).style.display = 'none'" />
          <div class="flex-1 min-w-0 overflow-hidden">
            <p class="text-sm font-medium truncate max-w-full">{{ bookmark.name }}</p>
            <p class="text-xs text-muted-foreground truncate max-w-full">{{ bookmark.url }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 无书签状态 -->
    <div v-else class="flex flex-col items-center justify-center h-64 text-muted-foreground">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-4">
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
      </svg>
      <p class="text-lg mb-2">暂无常用书签</p>
      <p class="text-sm">开始使用书签后，这里会显示您最常访问的内容</p>
    </div>
  </div>
</template>

<style scoped>
.auto-fill-grid {
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}

@media (max-width: 640px) {
  .auto-fill-grid {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 1920px) {
  .auto-fill-grid {
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  }
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 确保文本容器不会超出边界 */
.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* 确保 flex 容器正确处理溢出 */
.min-w-0 {
  min-width: 0;
}
</style>
