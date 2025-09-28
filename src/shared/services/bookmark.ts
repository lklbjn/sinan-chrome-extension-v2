import { SinanApiService } from './api';
import type { BookmarkTreeResp } from '../types/api';

export interface ChromeBookmarkNode {
  id: string;
  parentId?: string;
  index?: number;
  url?: string;
  title: string;
  dateAdded?: number;
  dateGroupModified?: number;
  children?: ChromeBookmarkNode[];
}

export class BookmarkService {
  private static readonly SINAN_FOLDER_NAME = 'Sinan';

  /**
   * 获取所有书签根目录
   */
  private static async getRootBookmarks(): Promise<ChromeBookmarkNode[]> {
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        chrome.bookmarks.getTree((bookmarkTree: ChromeBookmarkNode[]) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(bookmarkTree);
          }
        });
      } else {
        reject(new Error('Chrome bookmarks API is not available'));
      }
    });
  }

  /**
   * 查找所有名为 'Sinan' 的文件夹
   */
  private static findSinanFolders(nodes: ChromeBookmarkNode[]): ChromeBookmarkNode[] {
    const sinanFolders: ChromeBookmarkNode[] = [];

    const traverse = (nodes: ChromeBookmarkNode[]) => {
      for (const node of nodes) {
        if (node.title === this.SINAN_FOLDER_NAME && !node.url && node.children) {
          sinanFolders.push(node);
        }
        if (node.children) {
          traverse(node.children);
        }
      }
    };

    traverse(nodes);
    return sinanFolders;
  }

  /**
   * 删除指定的书签节点
   */
  private static async removeBookmarkNode(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        chrome.bookmarks.removeTree(id, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } else {
        reject(new Error('Chrome bookmarks API is not available'));
      }
    });
  }

  /**
   * 创建书签文件夹
   */
  private static async createBookmarkFolder(parentId: string, title: string): Promise<ChromeBookmarkNode> {
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        chrome.bookmarks.create({
          parentId: parentId,
          title: title
        }, (result: ChromeBookmarkNode) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      } else {
        reject(new Error('Chrome bookmarks API is not available'));
      }
    });
  }

  /**
   * 创建书签
   */
  private static async createBookmark(parentId: string, title: string, url: string): Promise<ChromeBookmarkNode> {
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        chrome.bookmarks.create({
          parentId: parentId,
          title: title,
          url: url
        }, (result: ChromeBookmarkNode) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      } else {
        reject(new Error('Chrome bookmarks API is not available'));
      }
    });
  }

  /**
   * 删除所有其他书签目录下的Sinan文件夹
   */
  static async deleteAllSinanFolders(): Promise<number> {
    try {
      const bookmarkTree = await this.getRootBookmarks();
      const sinanFolders = this.findSinanFolders(bookmarkTree);
      
      console.log(`找到 ${sinanFolders.length} 个Sinan文件夹，准备删除...`);
      
      for (const folder of sinanFolders) {
        console.log(`删除文件夹: ${folder.title} (ID: ${folder.id})`);
        await this.removeBookmarkNode(folder.id);
      }
      
      console.log(`成功删除 ${sinanFolders.length} 个Sinan文件夹`);
      return sinanFolders.length;
    } catch (error) {
      console.error('删除Sinan文件夹时出错:', error);
      throw error;
    }
  }

  /**
   * 递归创建书签树结构
   */
  private static async createBookmarkTreeRecursive(
    parentId: string, 
    bookmarkNodes: BookmarkTreeResp[], 
    depth: number = 0
  ): Promise<void> {
    for (const node of bookmarkNodes) {
      const indent = '  '.repeat(depth);
      console.log(`${indent}创建文件夹: ${node.spaceName}`);
      
      // 创建当前文件夹
      const folder = await this.createBookmarkFolder(parentId, node.spaceName);
      
      // 创建当前文件夹内的书签
      if (node.bookmarks && Array.isArray(node.bookmarks) && node.bookmarks.length > 0) {
        for (const bookmark of node.bookmarks) {
          console.log(`${indent}  创建书签: ${bookmark.name} -> ${bookmark.url}`);
          await this.createBookmark(folder.id, bookmark.name, bookmark.url);
        }
      } else {
        console.log(`${indent}  无书签需要创建`);
      }
      
      // 递归创建子文件夹
      if (node.children && Array.isArray(node.children) && node.children.length > 0) {
        console.log(`${indent}  创建子文件夹 (${node.children.length} 个)...`);
        await this.createBookmarkTreeRecursive(folder.id, node.children, depth + 1);
      }
    }
  }

  /**
   * 创建书签树结构
   */
  static async createBookmarkTree(bookmarkSpaces: BookmarkTreeResp[]): Promise<void> {
    try {
      // 获取"所有书签"目录 (通常是 "2")
      const bookmarkTree = await this.getRootBookmarks();
      const otherBookmarksFolder = bookmarkTree[0]?.children?.find(child => child.id === '2');
      
      if (!otherBookmarksFolder) {
        throw new Error('无法找到"所有书签"目录');
      }

      console.log(`准备在"所有书签"目录下创建书签树...`);

      // 创建主Sinan文件夹
      const mainSinanFolder = await this.createBookmarkFolder(otherBookmarksFolder.id, this.SINAN_FOLDER_NAME);
      console.log(`创建主文件夹: ${mainSinanFolder.title} (ID: ${mainSinanFolder.id})`);

      // 递归创建书签树结构
      await this.createBookmarkTreeRecursive(mainSinanFolder.id, bookmarkSpaces);

      console.log('书签树创建完成!');
    } catch (error) {
      console.error('创建书签树时出错:', error);
      throw error;
    }
  }

  /**
   * 统计书签树中的节点数量
   */
  private static countBookmarkTreeNodes(bookmarkSpaces: BookmarkTreeResp[] | null): { folders: number; bookmarks: number } {
    let folders = 0;
    let bookmarks = 0;

    if (!bookmarkSpaces || bookmarkSpaces.length === 0) {
      return { folders, bookmarks };
    }

    const traverse = (nodes: BookmarkTreeResp[]) => {
      for (const node of nodes) {
        folders++; // 当前文件夹
        bookmarks += (node.bookmarks && Array.isArray(node.bookmarks)) ? node.bookmarks.length : 0; // 当前文件夹的书签
        
        // 递归统计子文件夹
        if (node.children && Array.isArray(node.children) && node.children.length > 0) {
          traverse(node.children);
        }
      }
    };

    traverse(bookmarkSpaces);
    return { folders, bookmarks };
  }

  /**
   * 重新同步书签 - 删除旧的并创建新的书签树
   */
  static async resyncBookmarks(): Promise<{ deleted: number; created: { folders: number; bookmarks: number } }> {
    console.log('=== 开始重新同步书签 (支持多级目录) ===');
    
    try {
      // 1. 删除所有现有的Sinan文件夹
      console.log('步骤1: 删除现有Sinan文件夹...');
      const deletedCount = await this.deleteAllSinanFolders();
      console.log(`步骤1完成: 删除了 ${deletedCount} 个文件夹`);
      
      // 2. 从API获取最新的书签数据
      console.log('步骤2: 从API获取书签数据...');
      const bookmarkTreeResponse = await SinanApiService.getBookmarkTree();
      
      if (bookmarkTreeResponse.code !== 0) {
        throw new Error(`API响应错误 (code: ${bookmarkTreeResponse.code}): ${bookmarkTreeResponse.message}`);
      }

      // 统计书签树结构
      const { folders, bookmarks } = this.countBookmarkTreeNodes(bookmarkTreeResponse.data);
      const rootSpacesCount = bookmarkTreeResponse.data?.length || 0;
      console.log(`步骤2完成: 获取到 ${rootSpacesCount} 个根级空间，总计 ${folders} 个文件夹和 ${bookmarks} 个书签`);

      // 3. 创建新的书签树
      console.log('步骤3: 创建新的书签树...');
      if (bookmarkTreeResponse.data && bookmarkTreeResponse.data.length > 0) {
        await this.createBookmarkTree(bookmarkTreeResponse.data);
      } else {
        console.log('步骤3: 无书签数据需要创建');
      }
      console.log('步骤3完成: 书签树创建完成');
      
      console.log('=== 重新同步完成 ===');
      return {
        deleted: deletedCount,
        created: { folders, bookmarks }
      };
    } catch (error) {
      console.error('=== 重新同步失败 ===');
      console.error('错误详情:', error);
      if (error instanceof Error) {
        console.error('错误消息:', error.message);
        console.error('错误堆栈:', error.stack);
      }
      throw error;
    }
  }
}