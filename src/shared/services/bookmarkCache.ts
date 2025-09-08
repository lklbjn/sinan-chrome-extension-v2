import type { BookmarkResp } from '../types/api'

interface CachedBookmarks {
  bookmarks: BookmarkResp[]
  timestamp: number
  limit: number
}

export class BookmarkCacheService {
  private static readonly CACHE_KEY = 'sinan_bookmarks_cache'
  private static readonly CACHE_TTL = 5 * 60 * 1000 // 5分钟过期

  /**
   * 获取缓存的书签列表
   */
  static async getCachedBookmarks(limit: number): Promise<BookmarkResp[] | null> {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(this.CACHE_KEY, (result: any) => {
          const cached: CachedBookmarks = result[this.CACHE_KEY]
          
          if (!cached) {
            resolve(null)
            return
          }
          
          const now = Date.now()
          // 检查缓存是否过期
          if (now - cached.timestamp > this.CACHE_TTL) {
            console.log('[BookmarkCache] 缓存已过期，清除缓存')
            this.clearCache()
            resolve(null)
            return
          }
          
          // 检查limit是否匹配（如果缓存的数据量少于请求的数量，仍然可以使用）
          if (cached.limit >= limit || cached.bookmarks.length >= limit) {
            console.log(`[BookmarkCache] 使用缓存书签，数量: ${cached.bookmarks.length}`)
            resolve(cached.bookmarks.slice(0, limit))
          } else {
            console.log(`[BookmarkCache] 缓存数量不足 (缓存:${cached.bookmarks.length}, 需要:${limit})`)
            resolve(null)
          }
        })
      } else {
        // Fallback to localStorage for development
        try {
          const stored = localStorage.getItem(this.CACHE_KEY)
          if (stored) {
            const cached: CachedBookmarks = JSON.parse(stored)
            const now = Date.now()
            
            if (now - cached.timestamp > this.CACHE_TTL) {
              localStorage.removeItem(this.CACHE_KEY)
              resolve(null)
              return
            }
            
            if (cached.limit >= limit || cached.bookmarks.length >= limit) {
              resolve(cached.bookmarks.slice(0, limit))
            } else {
              resolve(null)
            }
          } else {
            resolve(null)
          }
        } catch (error) {
          console.warn('Failed to load bookmark cache from localStorage:', error)
          resolve(null)
        }
      }
    })
  }

  /**
   * 保存书签列表到缓存
   */
  static async saveBookmarksToCache(bookmarks: BookmarkResp[], limit: number): Promise<void> {
    const cacheData: CachedBookmarks = {
      bookmarks,
      timestamp: Date.now(),
      limit
    }

    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [this.CACHE_KEY]: cacheData }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError)
          } else {
            console.log(`[BookmarkCache] 保存书签缓存成功，数量: ${bookmarks.length}`)
            resolve()
          }
        })
      } else {
        // Fallback to localStorage for development
        try {
          localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData))
          console.log(`[BookmarkCache] 保存书签缓存成功，数量: ${bookmarks.length}`)
          resolve()
        } catch (error) {
          reject(error)
        }
      }
    })
  }

  /**
   * 清除书签缓存
   */
  static async clearCache(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove(this.CACHE_KEY, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError)
          } else {
            console.log('[BookmarkCache] 清除书签缓存成功')
            resolve()
          }
        })
      } else {
        try {
          localStorage.removeItem(this.CACHE_KEY)
          console.log('[BookmarkCache] 清除书签缓存成功')
          resolve()
        } catch (error) {
          reject(error)
        }
      }
    })
  }
}