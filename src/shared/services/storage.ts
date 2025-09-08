export interface SinanConfig {
  serverUrl: string;
  apiKey: string;
  autoSync: boolean;
  syncInterval: string;
  iconSource: 'google-s2' | 'sinan';
  lastSyncTime?: number;
}

const DEFAULT_CONFIG: SinanConfig = {
  serverUrl: 'https://sinan.host/api/',
  apiKey: '',
  autoSync: false,
  syncInterval: '30',
  iconSource: 'google-s2',
};

export class StorageService {
  private static readonly STORAGE_KEY = 'sinan_config';

  static async getConfig(): Promise<SinanConfig> {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(this.STORAGE_KEY, (result: any) => {
          const config = result[this.STORAGE_KEY];
          const finalConfig = config ? { ...DEFAULT_CONFIG, ...config } : DEFAULT_CONFIG;
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
    console.log('[StorageService] 保存配置:', newConfig);
    console.log('[StorageService] 保存的 iconSource:', newConfig.iconSource);
    
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set(
          { [this.STORAGE_KEY]: newConfig },
          () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
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

  static async clearConfig(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.remove(this.STORAGE_KEY, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
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