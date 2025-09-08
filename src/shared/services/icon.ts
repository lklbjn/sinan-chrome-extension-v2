import { StorageService } from './storage'

export class IconService {
  private static googleS2Available: boolean | null = null
  private static readonly DEFAULT_ICON = '/icon48.png'
  
  /**
   * 检查 Google S2 服务是否可用
   */
  private static async isGoogleS2Available(): Promise<boolean> {
    // 如果已经检查过，直接返回缓存结果
    if (this.googleS2Available !== null) {
      return this.googleS2Available
    }
    
    try {
      // 使用一个简单的域名测试 Google S2 服务
      const testUrl = 'https://www.google.com/s2/favicons?domain=google.com&sz=16'
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒超时
      
      const response = await fetch(testUrl, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      })
      
      clearTimeout(timeoutId)
      this.googleS2Available = response.ok
      
      // 缓存结果30分钟
      setTimeout(() => {
        this.googleS2Available = null
      }, 30 * 60 * 1000)
      
      return this.googleS2Available
    } catch (error) {
      console.warn('Google S2 service unavailable:', error)
      this.googleS2Available = false
      
      // 如果失败，缓存失败结果5分钟后重试
      setTimeout(() => {
        this.googleS2Available = null
      }, 5 * 60 * 1000)
      
      return false
    }
  }
  
  /**
   * 从 Sinan 服务获取 favicon
   */
  private static async getSinanFavicon(domain: string): Promise<string> {
    try {
      const config = await StorageService.getConfig()
      
      // 构建 Sinan favicon API URL，确保使用正确的端点
      // config.serverUrl 是 'https://sinan.host/api/'，需要确保正确拼接
      const baseUrl = config.serverUrl.endsWith('/') ? config.serverUrl : config.serverUrl + '/'
      const faviconUrl = `${baseUrl}favicon/icon?domain=${domain}&sz=32`
      
      const headers: HeadersInit = {
        'X-Access-Key': config.apiKey,
        'Authorization': config.apiKey,
      }
      
      console.log('Sinan配置 serverUrl:', config.serverUrl)
      console.log('处理后的 baseUrl:', baseUrl)
      console.log('完整的 faviconUrl:', faviconUrl)
      console.log('请求头:', headers)
      
      const response = await fetch(faviconUrl, {
        method: 'GET',
        headers,
        mode: 'cors',
      })
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        throw new Error(`Sinan favicon API failed: ${response.status} ${response.statusText} - ${errorText}`)
      }
      
      // Sinan API 返回图片文件，直接返回 API URL
      // 浏览器会缓存图片，性能更好
      return faviconUrl
      
    } catch (error) {
      console.error('Failed to get Sinan favicon:', error)
      throw error
    }
  }
  
  /**
   * 获取 favicon URL
   * 优先使用 Google S2，如果不可用则使用 Sinan 服务
   */
  static async getFavicon(url: string): Promise<string> {
    try {
      const domain = new URL(url).hostname
      const config = await StorageService.getConfig()
      
      // 如果用户明确选择了 Sinan 服务，直接使用
      if (config.iconSource === 'sinan') {
        try {
          return await this.getSinanFavicon(domain)
        } catch (error) {
          console.warn('Sinan favicon failed, using default icon:', error)
          return this.DEFAULT_ICON
        }
      }
      
      // 否则使用智能策略：优先 Google S2，失败则使用 Sinan
      if (config.iconSource === 'google-s2') {
        const isGoogleAvailable = await this.isGoogleS2Available()
        
        if (isGoogleAvailable) {
          return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
        } else {
          console.log('Google S2 不可用，回退到 Sinan 服务')
          try {
            return await this.getSinanFavicon(domain)
          } catch (error) {
            console.warn('Sinan favicon failed, using default icon:', error)
            return this.DEFAULT_ICON
          }
        }
      }
      
      // 默认情况
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
      
    } catch (error) {
      console.error('Failed to get favicon:', error)
      return this.DEFAULT_ICON
    }
  }
}