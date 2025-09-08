import { StorageService } from './storage'

export class IconService {
  private static readonly DEFAULT_ICON = '/icon48.png'
  
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
   * 根据用户配置选择图标服务
   */
  static async getFavicon(url: string): Promise<string> {
    try {
      const domain = new URL(url).hostname
      const config = await StorageService.getConfig()
      
      console.log('[IconService] 获取图标配置:', config.iconSource, '域名:', domain)
      
      // 如果用户明确选择了 Sinan 服务，直接使用
      if (config.iconSource === 'sinan') {
        try {
          return await this.getSinanFavicon(domain)
        } catch (error) {
          console.warn('Sinan favicon failed, using default icon:', error)
          return this.DEFAULT_ICON
        }
      }
      
      // 如果用户选择了 Google S2，直接返回 Google S2 URL
      // 不再进行可用性检查，让浏览器自己处理
      if (config.iconSource === 'google-s2') {
        const googleUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
        console.log('[IconService] 使用 Google S2 服务:', googleUrl)
        return googleUrl
      }
      
      // 默认使用 Google S2
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
      
    } catch (error) {
      console.error('Failed to get favicon:', error)
      return this.DEFAULT_ICON
    }
  }
}