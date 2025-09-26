export interface SinanConfig {
  serverUrl: string; // API接口地址
  webUrl: string; // 服务地址（主页地址）
  apiKey: string;
  autoSync: boolean;
  syncInterval: string;
  iconSource: 'google-s2' | 'sinan';
  lastSyncTime?: number;
  lastSelectedNamespaceId?: string;
  lastSelectedTagIds?: string[];

  // Newtab背景配置
  newtabBackgroundEnabled: boolean;
  newtabBackgroundSource: 'local' | 'blank' | 'bing' | 'urls';
  newtabBackgroundImage?: string;
  newtabBackgroundUrls?: string; // 存储为JSON字符串
  newtabBackgroundBingUrl?: string;
  newtabBlurEnabled: boolean;
  newtabBlurIntensity: number;

  // 欢迎词配置
  welcomeTitle: string;
  welcomeSubtitle: string;

  // 默认搜索引擎配置
  defaultSearchEngine: string;
}

const DEFAULT_CONFIG: SinanConfig = {
  serverUrl: 'https://sinan.host/api/',
  webUrl: 'https://sinan.host',
  apiKey: '',
  autoSync: false,
  syncInterval: '30',
  iconSource: 'google-s2',

  // Newtab背景默认配置
  newtabBackgroundEnabled: true,
  newtabBackgroundSource: 'blank',
  newtabBackgroundImage: '',
  newtabBackgroundUrls: '',
  newtabBackgroundBingUrl: 'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1',
  newtabBlurEnabled: false,
  newtabBlurIntensity: 10,

  // 欢迎词默认配置
  welcomeTitle: 'Welcome to Sinan',
  welcomeSubtitle: "Let's hurry to our destination.",

  // 默认搜索引擎默认配置
  defaultSearchEngine: 'baidu',
};

export class StorageService {
  private static readonly STORAGE_KEY = 'sinan_config';

  static async getConfig(): Promise<SinanConfig> {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(this.STORAGE_KEY, async (result: any) => {
          const config = result[this.STORAGE_KEY];
          let finalConfig = config ? { ...DEFAULT_CONFIG, ...config } : DEFAULT_CONFIG;

          // 从local storage获取背景图片和URLs
          try {
            console.log('[StorageService] 开始读取local storage背景数据');
            const localResult = await new Promise<any>((localResolve) => {
              chrome.storage.local.get([
                `${this.STORAGE_KEY}_backgroundImage`,
                `${this.STORAGE_KEY}_backgroundUrls`
              ], localResolve);
            });

            console.log('[StorageService] 从local storage读取到的数据:', localResult);

            const backgroundImage = localResult[`${this.STORAGE_KEY}_backgroundImage`];
            const backgroundUrls = localResult[`${this.STORAGE_KEY}_backgroundUrls`];

            console.log('[StorageService] 解析后的背景图片:', backgroundImage);
            console.log('[StorageService] 解析后的背景URLs:', backgroundUrls);

            if (backgroundImage) {
              finalConfig.newtabBackgroundImage = backgroundImage;
            }
            if (backgroundUrls) {
              finalConfig.newtabBackgroundUrls = backgroundUrls;
            }
          } catch (error) {
            console.warn('[StorageService] 读取背景数据失败:', error);
          }

          console.log('[StorageService] 读取配置:', finalConfig);
          console.log('[StorageService] iconSource:', finalConfig.iconSource);
          resolve(finalConfig);
        });
      } else {
        // Fallback to localStorage for development
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
          resolve({ ...DEFAULT_CONFIG, ...JSON.parse(stored) });
        } else {
          resolve(DEFAULT_CONFIG);
        }
      }
    });
  }

  static async saveConfig(config: Partial<SinanConfig>): Promise<void> {
    const currentConfig = await this.getConfig();
    const newConfig = { ...currentConfig, ...config };

    // 分离配置：小配置用sync，大数据用local
    const { newtabBackgroundImage, newtabBackgroundUrls, ...syncConfig } = newConfig;

    console.log('[StorageService] 保存配置:', syncConfig);
    console.log('[StorageService] 保存的 iconSource:', syncConfig.iconSource);
    console.log('[StorageService] 保存的背景图片:', newtabBackgroundImage);
    console.log('[StorageService] 保存的背景URLs:', JSON.stringify(newtabBackgroundUrls));
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        // 先保存主要配置到sync
        chrome.storage.sync.set(
          { [this.STORAGE_KEY]: syncConfig },
          () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }

            // 保存背景数据到local
            const localData = {
              [`${this.STORAGE_KEY}_backgroundImage`]: newtabBackgroundImage || '',
              [`${this.STORAGE_KEY}_backgroundUrls`]: newtabBackgroundUrls || '[]'
            }
            console.log('[StorageService] 保存到local storage的数据:', localData);

            chrome.storage.local.set(
              localData,
              () => {
                if (chrome.runtime.lastError) {
                  console.error('[StorageService] local storage保存失败:', chrome.runtime.lastError);
                  reject(chrome.runtime.lastError);
                } else {
                  console.log('[StorageService] local storage保存成功');
                  resolve();
                }
              }
            );
          }
        );
      } else {
        // Fallback to localStorage for development
        try {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newConfig));
          resolve();
        } catch (error) {
          reject(error);
        }
      }
    });
  }

  static async updateLastSyncTime(): Promise<void> {
    await this.saveConfig({ lastSyncTime: Date.now() });
  }

  static async saveLastSelected(namespaceId?: string, tagIds?: string[]): Promise<void> {
    await this.saveConfig({
      lastSelectedNamespaceId: namespaceId,
      lastSelectedTagIds: tagIds
    });
  }

  static async getLastSelected(): Promise<{ namespaceId?: string; tagIds?: string[] }> {
    const config = await this.getConfig();
    return {
      namespaceId: config.lastSelectedNamespaceId,
      tagIds: config.lastSelectedTagIds
    };
  }

  static async clearConfig(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.remove(this.STORAGE_KEY, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }

          // 同时清理local storage中的背景数据
          chrome.storage.local.remove([
            `${this.STORAGE_KEY}_backgroundImage`,
            `${this.STORAGE_KEY}_backgroundUrls`
          ], () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      } else {
        // Fallback to localStorage for development
        try {
          localStorage.removeItem(this.STORAGE_KEY);
          resolve();
        } catch (error) {
          reject(error);
        }
      }
    });
  }
}