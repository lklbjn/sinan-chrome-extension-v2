// Newtab背景服务
export class NewtabBackgroundService {
  // 处理本地图片上传
  static async uploadLocalImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (event) => {
        try {
          const base64 = event.target?.result as string
          resolve(base64)
        } catch (error) {
          reject(new Error('图片处理失败'))
        }
      }

      reader.onerror = () => {
        reject(new Error('图片读取失败'))
      }

      reader.readAsDataURL(file)
    })
  }

  // 获取Bing每日一图
  static async getBingDailyImage(): Promise<string> {
    try {
      const response = await fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN')
      const data = await response.json()

      if (data.images && data.images.length > 0) {
        const imageData = data.images[0]
        const imageUrl = `https://www.bing.com${imageData.url}`
        return imageUrl
      } else {
        throw new Error('无法获取Bing图片')
      }
    } catch (error) {
      console.error('获取Bing每日一图失败:', error)
      throw error
    }
  }

  // 获取当前背景图片URL
  static async getCurrentBackgroundImageUrl(config: any): Promise<string> {
    if (config.newtabBackgroundSource === 'local' && config.newtabBackgroundImage) {
      return config.newtabBackgroundImage
    } else if (config.newtabBackgroundSource === 'bing') {
      try {
        return await this.getBingDailyImage()
      } catch (error) {
        console.error('获取Bing图片失败，使用默认背景:', error)
        return ''
      }
    }

    return ''
  }

  // 获取毛玻璃CSS样式
  static getBackdropFilterCSS(blurEnabled: boolean, blurIntensity: number): string {
    if (!blurEnabled) {
      return ''
    }
    return `backdrop-filter: blur(${blurIntensity}px); -webkit-backdrop-filter: blur(${blurIntensity}px);`
  }

  // 验证图片文件
  static validateImageFile(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    const maxSize = 5 * 1024 * 1024 // 5MB

    if (!validTypes.includes(file.type)) {
      throw new Error('仅支持 JPG、PNG、GIF、WebP 格式的图片')
    }

    if (file.size > maxSize) {
      throw new Error('图片大小不能超过 5MB')
    }

    return true
  }
}