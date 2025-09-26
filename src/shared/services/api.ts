import { StorageService } from './storage';
import type {
  AddBookmarkReq,
  ResultBookmarkResp,
  ResultListBookmarkResp,
  ResultListBookmarkTreeResp,
  ResultListSnSpace,
  ResultListTagResp,
  ResultString,
  MostVisitedParams,
} from '../types/api';

export class SinanApiService {
  private static async fetchWithConfig(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<Response> {
    const config = await StorageService.getConfig();
    
    const url = `${config.serverUrl}${endpoint}`;
    console.log('发起API请求:', url);
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Access-Key': config.apiKey,
      ...options.headers,
    };

    console.log('请求头:', headers);

    const response = await fetch(url, {
      ...options,
      headers,
      mode: 'cors',
    });

    console.log('响应状态:', response.status, response.statusText);
    console.log('响应头:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API响应错误:', errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    return response;
  }

  static async refreshInstance(): Promise<void> {
    // fetch版本不需要实例管理
  }

  static async addBookmark(bookmark: AddBookmarkReq): Promise<ResultBookmarkResp> {
    const response = await this.fetchWithConfig('/api/bookmark', {
      method: 'POST',
      body: JSON.stringify(bookmark),
    });
    return response.json();
  }

  static async getBookmarkTree(pinyin: boolean = true): Promise<ResultListBookmarkTreeResp> {
    const params = new URLSearchParams({ pinyin: pinyin.toString() });
    const response = await this.fetchWithConfig(`/api/bookmark?${params}`);
    return response.json();
  }

  static async searchBookmarks(search?: string): Promise<ResultListBookmarkResp> {
    const params = search ? new URLSearchParams({ search }) : '';
    const endpoint = `/api/bookmarks${params ? `?${params}` : ''}`;
    const response = await this.fetchWithConfig(endpoint);
    return response.json();
  }

  static async incrementBookmarkUsage(bookmarkId: string): Promise<ResultString> {
    const params = new URLSearchParams({ id: bookmarkId });
    const response = await this.fetchWithConfig(`/api/increment-usage?${params}`, {
      method: 'GET',
    });
    return response.json();
  }

  static async getMostVisitedBookmarks(params: MostVisitedParams): Promise<ResultListBookmarkResp> {
    const searchParams = new URLSearchParams({
      limit: params.limit.toString(),
      ...(params.search && { search: params.search }),
    });
    const response = await this.fetchWithConfig(`/api/most-visited?${searchParams}`);
    return response.json();
  }

  static async getSpaces(): Promise<ResultListSnSpace> {
    const response = await this.fetchWithConfig('/api/spaces');
    return response.json();
  }

  static async getTags(): Promise<ResultListTagResp> {
    const response = await this.fetchWithConfig('/api/tags');
    return response.json();
  }

  static async testConnection(): Promise<boolean> {
    try {
      await this.getBookmarkTree();
      return true;
    } catch (error) {
      console.error('连接测试失败:', error);
      return false;
    }
  }
}