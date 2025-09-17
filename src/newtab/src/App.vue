<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Textarea from "@/components/ui/textarea/Textarea.vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Skeleton from "@/components/ui/skeleton/Skeleton.vue";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { onMounted, ref, computed, watch } from 'vue'
import { SinanApiService } from '../../shared/services/api'
import { IconService } from '../../shared/services/icon'
import { StorageService } from '../../shared/services/storage'
import { IconCacheService } from '../../shared/services/iconCache'
import { BookmarkCacheService } from '../../shared/services/bookmarkCache'
import type { BookmarkResp, SnSpace } from '../../shared/types/api'
const originalConfig = ref<any>({})
// 表单状态持久化
const formValues = ref({
  serverUrl: 'https://sinan.host',
  apiKey: '',
  autoSync: false,
  syncInterval: '30',
  iconSource: 'google-s2' as 'google-s2' | 'sinan',
})

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

// 背景图片配置状态
const showBackgroundSettings = ref(false)
const backgroundConfig = ref({
  mode: 'bing' as 'bing' | 'custom',
  customUrls: [] as string[],
  currentCustomUrl: '',
  opacity: 0.7 // 默认透明度70%
})

// 当前背景图片URL
const backgroundImageUrl = ref('')

// 新增书签对话框状态
const showAddBookmarkDialog = ref(false)
const newBookmark = ref({
  name: '',
  url: '',
  description: '',
  namespaceId: ''
})

// namespace相关状态
const namespaces = ref<SnSpace[]>([])
const isLoadingNamespaces = ref(false)

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
      
      // 如果是获取最常访问的书签（无搜索关键词），保存到缓存
      if (!query.trim()) {
        const limit = calculateBookmarksLimit()
        await BookmarkCacheService.saveBookmarksToCache(response.data, limit)
      }
      
      // 异步加载书签图标，不阻塞UI
      preloadFaviconsAsync(response.data)
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

// 从缓存加载书签
const loadBookmarksFromCache = async (limit: number) => {
  try {
    const cachedBookmarks = await BookmarkCacheService.getCachedBookmarks(limit)
    if (cachedBookmarks && cachedBookmarks.length > 0) {
      bookmarks.value = cachedBookmarks
      console.log('从缓存加载书签成功:', cachedBookmarks.length, '个书签')
      
      // 异步加载缓存书签的图标
      preloadFaviconsAsync(cachedBookmarks)
      
      // 设置加载完成，显示缓存内容
      isLoading.value = false
      return true
    }
    return false
  } catch (error) {
    console.error('加载缓存书签失败:', error)
    return false
  }
}

const loadMostVisitedBookmarks = async (useCache = true) => {
  try {
    errorAlert.value.show = false

    // 动态计算需要的书签数量
    const limit = calculateBookmarksLimit()
    
    // 首先尝试从缓存加载（如果启用）
    if (useCache) {
      const cacheLoaded = await loadBookmarksFromCache(limit)
      // 如果缓存加载成功，继续在后台获取最新数据
      if (cacheLoaded) {
        console.log('缓存加载成功，后台获取最新数据...')
      }
    }

    // 获取最新的书签数据
    const response = await SinanApiService.getMostVisitedBookmarks({ limit })

    if (response.code === 0) {
      bookmarks.value = response.data
      console.log('加载最常访问书签成功:', response.data.length, '个书签')
      
      // 保存到缓存
      await BookmarkCacheService.saveBookmarksToCache(response.data, limit)
      
      // 异步加载书签图标，不阻塞UI
      preloadFaviconsAsync(response.data)
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
    
    // 如果没有使用缓存且出错，尝试使用缓存
    if (useCache && bookmarks.value.length === 0) {
      const limit = calculateBookmarksLimit()
      const cacheLoaded = await loadBookmarksFromCache(limit)
      if (cacheLoaded) {
        console.log('网络请求失败，使用缓存数据')
      } else {
        errorAlert.value = {
          show: true,
          message: `网络请求失败: ${error instanceof Error ? error.message : String(error)}`
        }
      }
    } else if (!useCache) {
      errorAlert.value = {
        show: true,
        message: `网络请求失败: ${error instanceof Error ? error.message : String(error)}`
      }
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
  // 刷新时不使用缓存，强制从服务器获取最新数据
  await loadMostVisitedBookmarks(false)
}

const openSinanHomepage = () => {
  const rawUrl = formValues.value.serverUrl || 'https://sinan.host';
  try {
    const urlObj = new URL(rawUrl);
    const sinanUrl = `${urlObj.protocol}//${urlObj.hostname}`;
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: sinanUrl, active: true })
    } else {
      window.open(sinanUrl, '_blank')
    }
  } catch (e) {
    // 如果 rawUrl 不是合法的URL，可以做相应处理
    console.error('无效的URL:', rawUrl);
  }
}

// 打开新增书签对话框
const openAddBookmarkDialog = async () => {
  showAddBookmarkDialog.value = true
  await loadNamespaces()
  
  // 尝试读取剪切板内容
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      const clipboardText = await navigator.clipboard.readText()
      const trimmedText = clipboardText.trim()
      
      // 检查剪切板内容是否是有效的URL
      if (trimmedText && (trimmedText.startsWith('http://') || trimmedText.startsWith('https://') || trimmedText.startsWith('www.'))) {
        // 如果是www开头，自动添加https://
        const url = trimmedText.startsWith('www.') ? `https://${trimmedText}` : trimmedText
        newBookmark.value.url = url
        console.log('从剪切板获取URL:', url)
        
        // 自动获取网页标题
        setTimeout(() => {
          fetchTitleFromUrl()
        }, 100) // 延迟一点执行，确保URL已经设置
      }
    }
  } catch (error) {
    console.log('读取剪切板失败:', error)
    // 忽略剪切板读取错误，不影响用户体验
  }
}

// 关闭新增书签对话框
const closeAddBookmarkDialog = () => {
  showAddBookmarkDialog.value = false
  // 重置表单
  newBookmark.value = {
    name: '',
    url: '',
    description: '',
    namespaceId: ''
  }
}

// 获取网址标题和描述
const fetchTitleFromUrl = async () => {
  const url = newBookmark.value.url.trim()
  
  // 如果URL为空，则不自动获取
  if (!url) {
    return
  }
  
  try {
    // 验证URL格式
    const urlObject = new URL(url.startsWith('http') ? url : `https://${url}`)
    
    // 发起请求获取页面内容
    const response = await fetch(urlObject.toString(), {
      method: 'GET',
      mode: 'cors',
    })
    
    if (response.ok) {
      const html = await response.text()
      
      // 只有在书签名称为空时才自动获取标题
      if (!newBookmark.value.name.trim()) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
        if (titleMatch && titleMatch[1]) {
          const title = titleMatch[1].trim()
          if (title) {
            newBookmark.value.name = title
            console.log('自动获取网页标题:', title)
          }
        }
      }
      
      // 只有在描述为空时才自动获取描述
      if (!newBookmark.value.description.trim()) {
        // 尝试获取多种description meta标签
        const descriptionPatterns = [
          /<meta\s+name=["\']description["\']\s+content=["\']([^"\']*)["\'][^>]*>/i,
          /<meta\s+content=["\']([^"\']*)["\'][^>]*\s+name=["\']description["\']/i,
          /<meta\s+property=["\']og:description["\']\s+content=["\']([^"\']*)["\'][^>]*>/i,
          /<meta\s+name=["\']twitter:description["\']\s+content=["\']([^"\']*)["\'][^>]*>/i
        ]
        
        for (const pattern of descriptionPatterns) {
          const descMatch = html.match(pattern)
          if (descMatch && descMatch[1]) {
            const description = descMatch[1].trim()
            if (description && description.length > 10) { // 确保描述有意义
              newBookmark.value.description = description
              console.log('自动获取网页描述:', description)
              break
            }
          }
        }
      }
    }
  } catch (error) {
    console.log('获取网页信息失败:', error)
    // 如果获取失败，尝试使用URL的域名作为名称（仅在名称为空时）
    if (!newBookmark.value.name.trim()) {
      try {
        const urlObject = new URL(url.startsWith('http') ? url : `https://${url}`)
        const hostname = urlObject.hostname.replace('www.', '')
        newBookmark.value.name = hostname
        console.log('使用域名作为书签名称:', hostname)
      } catch (urlError) {
        console.log('URL解析失败:', urlError)
      }
    }
  }
}

// 获取所有namespace
const loadNamespaces = async () => {
  if (isLoadingNamespaces.value) return
  
  isLoadingNamespaces.value = true
  try {
    const response = await SinanApiService.getSpaces()
    if (response.code === 0) {
      namespaces.value = response.data
      console.log('加载namespace成功:', response.data.length, '个空间')
      
      // 如果没有选中的namespace，默认选择第一个
      if (namespaces.value.length > 0 && !newBookmark.value.namespaceId) {
        newBookmark.value.namespaceId = namespaces.value[0].id
      }
    } else {
      console.error('获取namespace列表失败:', response.message)
      errorAlert.value = {
        show: true,
        message: `获取空间列表失败: ${response.message}`
      }
      setTimeout(() => {
        errorAlert.value.show = false
      }, 3000)
    }
  } catch (error) {
    console.error('获取namespace列表时出错:', error)
    errorAlert.value = {
      show: true,
      message: `获取空间列表失败: ${error instanceof Error ? error.message : String(error)}`
    }
    setTimeout(() => {
      errorAlert.value.show = false
    }, 3000)
  } finally {
    isLoadingNamespaces.value = false
  }
}

// 获取Bing每日一图
const getBingWallpaper = async (): Promise<string> => {
  try {
    // 使用Bing壁纸API
    const response = await fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN')
    const data = await response.json()
    const imageUrl = `https://www.bing.com${data.images[0].url}`
    return imageUrl
  } catch (error) {
    console.error('获取Bing壁纸失败:', error)
    // 返回默认的Bing壁纸URL
    return 'https://www.bing.com/th?id=OHR.BlueJays_ZH-CN0010006677_1920x1080.jpg'
  }
}

// 随机选择自定义图片
const getRandomCustomImage = (): string => {
  const urls = backgroundConfig.value.customUrls.filter(url => url.trim())
  if (urls.length === 0) {
    return ''
  }
  const randomIndex = Math.floor(Math.random() * urls.length)
  return urls[randomIndex]
}

// 设置背景图片
const setBackgroundImage = async () => {
  try {
    if (backgroundConfig.value.mode === 'bing') {
      backgroundImageUrl.value = await getBingWallpaper()
    } else {
      backgroundImageUrl.value = getRandomCustomImage()
    }
    
    // 保存当前配置到本地存储
    saveBackgroundConfig()
  } catch (error) {
    console.error('设置背景图片失败:', error)
  }
}

// 保存背景配置到本地存储
const saveBackgroundConfig = () => {
  localStorage.setItem('backgroundConfig', JSON.stringify(backgroundConfig.value))
}

// 从本地存储加载背景配置
const loadBackgroundConfig = () => {
  const savedConfig = localStorage.getItem('backgroundConfig')
  if (savedConfig) {
    try {
      backgroundConfig.value = JSON.parse(savedConfig)
    } catch (error) {
      console.error('解析背景配置失败:', error)
    }
  }
}

// 添加自定义图片URL
const addCustomUrl = () => {
  const url = backgroundConfig.value.currentCustomUrl.trim()
  if (url && !backgroundConfig.value.customUrls.includes(url)) {
    backgroundConfig.value.customUrls.push(url)
    backgroundConfig.value.currentCustomUrl = ''
    saveBackgroundConfig()
  }
}

// 移除自定义图片URL
const removeCustomUrl = (index: number) => {
  backgroundConfig.value.customUrls.splice(index, 1)
  saveBackgroundConfig()
}

// 更新透明度
const updateOpacity = () => {
  saveBackgroundConfig()
}

// 应用背景配置
const applyBackgroundConfig = async () => {
  await setBackgroundImage()
  closeBackgroundSettings()
}

// 打开背景设置面板
const openBackgroundSettings = () => {
  showBackgroundSettings.value = true
}

// 关闭背景设置面板
const closeBackgroundSettings = () => {
  showBackgroundSettings.value = false
}

// 添加书签
const addBookmark = async () => {
  if (!newBookmark.value.name.trim() || !newBookmark.value.url.trim()) {
    errorAlert.value = {
      show: true,
      message: '书签名称和网址不能为空'
    }
    setTimeout(() => {
      errorAlert.value.show = false
    }, 3000)
    return
  }

  try {
    const response = await SinanApiService.addBookmark({
      name: newBookmark.value.name.trim(),
      url: newBookmark.value.url.trim(),
      description: newBookmark.value.description.trim() || undefined,
      namespaceId: newBookmark.value.namespaceId || undefined
    })

    if (response.code === 0) {
      console.log('书签添加成功:', response.data)
      closeAddBookmarkDialog()
      // 刷新书签列表
      await loadMostVisitedBookmarks(false)
    } else {
      errorAlert.value = {
        show: true,
        message: `添加书签失败: ${response.message}`
      }
      setTimeout(() => {
        errorAlert.value.show = false
      }, 3000)
    }
  } catch (error) {
    console.error('添加书签失败:', error)
    errorAlert.value = {
      show: true,
      message: `添加书签失败: ${error instanceof Error ? error.message : String(error)}`
    }
    setTimeout(() => {
      errorAlert.value.show = false
    }, 3000)
  }
}


// 默认图标 - 使用扩展的图标
const DEFAULT_ICON = '/icon48.png'

// 缓存图标URL
const faviconCache = ref<Map<string, string>>(new Map())
// 跟踪正在加载的图标
const loadingFavicons = ref<Set<string>>(new Set())

// 异步加载图标，不阻塞UI
const loadFaviconAsync = async (url: string) => {
  if (faviconCache.value.has(url) || loadingFavicons.value.has(url)) {
    return
  }
  
  loadingFavicons.value.add(url)
  
  try {
    console.log('[Newtab] 开始加载图标:', url)
    const faviconUrl = await IconService.getFavicon(url)
    console.log('[Newtab] 获取到图标URL:', faviconUrl)
    faviconCache.value.set(url, faviconUrl)
    
    // 保存到持久化缓存
    await IconCacheService.saveIconToCache(url, faviconUrl)
  } catch (error) {
    console.warn('Failed to load favicon for', url, error)
    // 设置默认图标
    faviconCache.value.set(url, DEFAULT_ICON)
    // 也保存默认图标到缓存
    await IconCacheService.saveIconToCache(url, DEFAULT_ICON)
  } finally {
    loadingFavicons.value.delete(url)
  }
}

// 获取缓存的图标URL，如果没有缓存则返回默认图标
const getCachedFavicon = (url: string): string => {
  return faviconCache.value.get(url) || DEFAULT_ICON
}

// 检查图标是否正在加载
const isFaviconLoading = (url: string): boolean => {
  return loadingFavicons.value.has(url)
}

// 检查图标是否已加载
const isFaviconLoaded = (url: string): boolean => {
  return faviconCache.value.has(url)
}

// 从持久化缓存加载图标
const loadCachedIcons = async () => {
  try {
    console.log('加载缓存的图标...')
    const cachedIcons = await IconCacheService.getCachedIcons()
    
    // 将缓存的图标添加到内存缓存
    cachedIcons.forEach((faviconUrl, url) => {
      faviconCache.value.set(url, faviconUrl)
    })
    
    console.log(`成功加载 ${cachedIcons.size} 个缓存图标`)
  } catch (error) {
    console.error('加载缓存图标失败:', error)
  }
}

// 异步加载书签图标，不阻塞UI
const preloadFaviconsAsync = (bookmarkList: BookmarkResp[]) => {
  bookmarkList.forEach((bookmark) => {
    loadFaviconAsync(bookmark.url)
  })
  
  // 可选：等待所有图标加载完成后批量保存到缓存
  // 这样可以减少频繁的存储操作
  Promise.all(
    bookmarkList.map(bookmark => loadFaviconAsync(bookmark.url))
  ).then(() => {
    // 批量保存当前缓存状态
    saveCacheState()
  }).catch(error => {
    console.warn('Some icons failed to load:', error)
    // 即使有失败的，也保存成功加载的
    saveCacheState()
  })
}

// 保存当前缓存状态
const saveCacheState = async () => {
  try {
    if (faviconCache.value.size > 0) {
      await IconCacheService.saveBatchToCache(faviconCache.value)
    }
  } catch (error) {
    console.error('保存图标缓存失败:', error)
  }
}

// 确保当书签显示时图标开始加载
const ensureFaviconLoading = (url: string) => {
  if (!isFaviconLoaded(url) && !isFaviconLoading(url)) {
    loadFaviconAsync(url)
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

onMounted(async () => {
  const config = await StorageService.getConfig()
  originalConfig.value = { ...config }
  
  // 加载背景配置
  loadBackgroundConfig()
  // 设置背景图片
  await setBackgroundImage()
  
  // 更新持久化表单值
  formValues.value = {
    serverUrl: config.serverUrl,
    apiKey: config.apiKey,
    autoSync: config.autoSync,
    syncInterval: config.syncInterval,
    iconSource: config.iconSource,
  }

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

  // 首先加载缓存的图标
  await loadCachedIcons()

  // 然后加载最常访问的书签
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
  <div 
    class="min-h-screen bg-background text-foreground p-8 relative"
    :style="{
      backgroundImage: backgroundImageUrl ? `url('${backgroundImageUrl}')` : 'none',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed'
    }"
  >
    <!-- 背景遮罩层，提高文字可读性 -->
    <div 
      class="absolute inset-0 backdrop-blur-sm" 
      v-if="backgroundImageUrl"
      :style="{ opacity: backgroundConfig.opacity, backgroundColor: 'var(--background)' }"
    ></div>
    
    <!-- 内容容器 -->
    <div class="relative z-10">
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
        <!-- 新增书签按钮 -->
        <Button variant="outline" size="icon" @click="openAddBookmarkDialog" class="h-10 w-10">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14M5 12h14" />
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
        <!-- 背景设置按钮 -->
        <Button variant="outline" size="icon" @click="openBackgroundSettings" class="h-10 w-10">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
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
          <!-- 图标加载状态：skeleton -> 加载完成的图标 -->
          <div class="w-8 h-8 flex-shrink-0 flex items-center justify-center">
            <Skeleton 
              v-if="isFaviconLoading(bookmark.url) || !isFaviconLoaded(bookmark.url)" 
              class="w-8 h-8 rounded" 
              @vue:mounted="ensureFaviconLoading(bookmark.url)"
            />
            <img 
              v-else
              :src="getCachedFavicon(bookmark.url)" 
              :alt="bookmark.name" 
              class="w-8 h-8 rounded"
              @error="($event.target as HTMLImageElement).style.display = 'none'" 
            />
          </div>
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
    </div> <!-- 关闭相对定位的内容容器 -->

    <!-- 背景设置面板 -->
    <div v-if="showBackgroundSettings" class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- 背景遮罩 -->
      <div class="fixed inset-0 backdrop-blur-sm bg-black/20" @click="closeBackgroundSettings"></div>
      
      <!-- 对话框内容 -->
      <div class="relative bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">背景图片设置</h2>
          <Button variant="ghost" size="icon" @click="closeBackgroundSettings" class="h-6 w-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </Button>
        </div>
        
        <div class="space-y-4">
          <!-- 模式选择 -->
          <div>
            <label class="text-sm font-medium mb-2 block">背景图片模式</label>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  v-model="backgroundConfig.mode" 
                  value="bing" 
                  class="w-4 h-4 text-primary"
                >
                <span>Bing每日一图</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  v-model="backgroundConfig.mode" 
                  value="custom" 
                  class="w-4 h-4 text-primary"
                >
                <span>自定义图片</span>
              </label>
            </div>
          </div>
          
          <!-- 自定义图片设置 -->
          <div v-if="backgroundConfig.mode === 'custom'">
            <label class="text-sm font-medium mb-2 block">自定义图片URL</label>
            <div class="flex gap-2">
              <Input 
                v-model="backgroundConfig.currentCustomUrl" 
                placeholder="输入图片URL" 
                class="flex-1"
                @keypress.enter="addCustomUrl"
              />
              <Button @click="addCustomUrl" :disabled="!backgroundConfig.currentCustomUrl.trim()">
                添加
              </Button>
            </div>
            
            <!-- 图片URL列表 -->
            <div v-if="backgroundConfig.customUrls.length > 0" class="mt-3 space-y-2">
              <div 
                v-for="(url, index) in backgroundConfig.customUrls" 
                :key="index"
                class="flex items-center justify-between p-2 bg-muted rounded text-sm"
              >
                <span class="truncate flex-1 mr-2">{{ url }}</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  @click="removeCustomUrl(index)"
                  class="h-6 w-6 p-0"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </Button>
              </div>
            </div>
          </div>

          <!-- 透明度设置 -->
          <div>
            <label class="text-sm font-medium mb-2 block">背景图片透明度</label>
            <div class="flex items-center gap-3">
              <input 
                type="range" 
                v-model="backgroundConfig.opacity" 
                min="0" 
                max="1" 
                step="0.1"
                class="flex-1 h-2 bg-muted rounded-full appearance-none cursor-pointer"
                @input="updateOpacity"
              >
              <span class="text-sm text-muted-foreground min-w-[40px] text-right">
                {{ Math.round(backgroundConfig.opacity * 100) }}%
              </span>
            </div>
            <div class="text-xs text-muted-foreground mt-1">
              0% 完全透明 - 100% 完全不透明
            </div>
          </div>
        </div>
        
        <!-- 按钮区域 -->
        <div class="flex justify-end gap-2 mt-6">
          <Button variant="outline" @click="closeBackgroundSettings">
            取消
          </Button>
          <Button @click="applyBackgroundConfig">
            应用
          </Button>
        </div>
      </div>
    </div>

    <!-- 新增书签对话框 -->
    <div v-if="showAddBookmarkDialog" class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- 背景遮罩 -->
      <div class="fixed inset-0 backdrop-blur-sm bg-black/20" @click="closeAddBookmarkDialog"></div>
      
      <!-- 对话框内容 -->
      <div class="relative bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">添加新书签</h2>
          <Button variant="ghost" size="icon" @click="closeAddBookmarkDialog" class="h-6 w-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </Button>
        </div>
        
        <div class="space-y-4">
          <div>
            <label class="text-sm font-medium mb-1 block">网址 *</label>
            <Input 
              v-model="newBookmark.url" 
              placeholder="https://example.com" 
              class="w-full"
              @blur="fetchTitleFromUrl"
            />
          </div>
          
          <div>
            <label class="text-sm font-medium mb-1 block">书签名称 *</label>
            <Input 
              v-model="newBookmark.name" 
              placeholder="输入书签名称" 
              class="w-full"
            />
          </div>
          
          <div>
            <label class="text-sm font-medium mb-1 block">描述</label>
            <Textarea 
              v-model="newBookmark.description" 
              placeholder="输入描述（可选）" 
              class="w-full resize-none max-h-[4.5rem] overflow-y-auto"
              rows="3"
            />
          </div>
          
          <div>
            <label class="text-sm font-medium mb-1 block">选择空间</label>
            <Select v-model="newBookmark.namespaceId">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择一个空间" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem 
                  v-for="namespace in namespaces" 
                  :key="namespace.id" 
                  :value="namespace.id"
                >
                  {{ namespace.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <!-- 按钮区域 -->
        <div class="flex justify-end gap-2 mt-6">
          <Button variant="outline" @click="closeAddBookmarkDialog">
            取消
          </Button>
          <Button @click="addBookmark">
            添加书签
          </Button>
        </div>
      </div>
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
