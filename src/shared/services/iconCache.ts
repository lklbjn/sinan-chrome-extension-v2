interface CachedIcon {
  url: string
  faviconUrl: string
  timestamp: number
}

interface IconCacheData {
  icons: Record<string, CachedIcon>
}

export class IconCacheService {
  private static readonly CACHE_KEY = 'sinan_icon_cache'
  private static readonly CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7天过期
  private static readonly MAX_CACHE_SIZE = 1000 // 最大缓存1000个图标

  /**
   * 获取缓存的图标数据
   */
  static async getCachedIcons(): Promise<Map<string, string>> {
    return new Promise((resolve) => {
      const cacheMap = new Map<string, string>()
      
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(this.CACHE_KEY, (result: any) => {
          const cacheData: IconCacheData = result[this.CACHE_KEY] || { icons: {} }
          const now = Date.now()
          
          // 清理过期的缓存
          Object.entries(cacheData.icons).forEach(([url, cachedIcon]) => {
            if (now - cachedIcon.timestamp < this.CACHE_TTL) {
              cacheMap.set(url, cachedIcon.faviconUrl)
            }
          })
          
          console.log(`加载了 ${cacheMap.size} 个缓存图标`)
          resolve(cacheMap)
        })
      } else {
        // Fallback to localStorage for development
        try {
          const stored = localStorage.getItem(this.CACHE_KEY)
          if (stored) {
            const cacheData: IconCacheData = JSON.parse(stored)
            const now = Date.now()
            
            Object.entries(cacheData.icons).forEach(([url, cachedIcon]) => {
              if (now - cachedIcon.timestamp < this.CACHE_TTL) {
                cacheMap.set(url, cachedIcon.faviconUrl)
              }
            })
          }
        } catch (error) {
          console.warn('Failed to load icon cache from localStorage:', error)
        }
        resolve(cacheMap)
      }
    })
  }

  /**
   * 保存单个图标到缓存
   */
  static async saveIconToCache(url: string, faviconUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(this.CACHE_KEY, (result: any) => {
          const cacheData: IconCacheData = result[this.CACHE_KEY] || { icons: {} }
          
          // 添加新的缓存项
          cacheData.icons[url] = {
            url,
            faviconUrl,
            timestamp: Date.now()
          }
          
          // 如果缓存过大，删除最旧的项目
          this.cleanupCache(cacheData)
          
          chrome.storage.local.set({ [this.CACHE_KEY]: cacheData }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError)
            } else {
              resolve()
            }
          })
        })
      } else {
        // Fallback to localStorage for development
        try {
          const stored = localStorage.getItem(this.CACHE_KEY)
          const cacheData: IconCacheData = stored ? JSON.parse(stored) : { icons: {} }
          
          cacheData.icons[url] = {
            url,
            faviconUrl,
            timestamp: Date.now()
          }
          
          this.cleanupCache(cacheData)
          localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData))
          resolve()
        } catch (error) {
          reject(error)
        }
      }
    })
  }

  /**
   * 批量保存图标到缓存
   */
  static async saveBatchToCache(iconMap: Map<string, string>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(this.CACHE_KEY, (result: any) => {
          const cacheData: IconCacheData = result[this.CACHE_KEY] || { icons: {} }
          const now = Date.now()
          
          // 批量添加缓存项
          iconMap.forEach((faviconUrl, url) => {
            cacheData.icons[url] = {
              url,
              faviconUrl,
              timestamp: now
            }
          })
          
          // 清理缓存
          this.cleanupCache(cacheData)
          
          chrome.storage.local.set({ [this.CACHE_KEY]: cacheData }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError)
            } else {
              console.log(`批量保存了 ${iconMap.size} 个图标到缓存`)
              resolve()
            }
          })
        })
      } else {
        // Fallback to localStorage for development
        try {
          const stored = localStorage.getItem(this.CACHE_KEY)
          const cacheData: IconCacheData = stored ? JSON.parse(stored) : { icons: {} }
          const now = Date.now()
          
          iconMap.forEach((faviconUrl, url) => {
            cacheData.icons[url] = {
              url,
              faviconUrl,
              timestamp: now
            }
          })
          
          this.cleanupCache(cacheData)
          localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData))
          resolve()
        } catch (error) {
          reject(error)
        }
      }
    })
  }

  /**
   * 清理过期和过多的缓存
   */
  private static cleanupCache(cacheData: IconCacheData): void {
    const now = Date.now()
    const entries = Object.entries(cacheData.icons)
    
    // 移除过期的缓存
    const validEntries = entries.filter(([, cachedIcon]) => 
      now - cachedIcon.timestamp < this.CACHE_TTL
    )
    
    // 如果仍然超过最大大小，保留最新的项目
    if (validEntries.length > this.MAX_CACHE_SIZE) {
      validEntries.sort(([, a], [, b]) => b.timestamp - a.timestamp)
      validEntries.splice(this.MAX_CACHE_SIZE)
    }
    
    // 重建缓存对象
    cacheData.icons = {}
    validEntries.forEach(([url, cachedIcon]) => {
      cacheData.icons[url] = cachedIcon
    })
  }

  /**
   * 清空所有缓存
   */
  static async clearCache(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove(this.CACHE_KEY, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError)
          } else {
            resolve()
          }
        })
      } else {
        try {
          localStorage.removeItem(this.CACHE_KEY)
          resolve()
        } catch (error) {
          reject(error)
        }
      }
    })
  }
}