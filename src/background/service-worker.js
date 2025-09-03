// Sinan Chrome Extension Service Worker

const STORAGE_KEY = 'sinan_config';
const SINAN_FOLDER_NAME = 'Sinan';

// 获取配置
async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      const config = result[STORAGE_KEY];
      if (config) {
        resolve(config);
      } else {
        resolve({
          serverUrl: 'https://sinan.host/api/',
          apiKey: '',
          autoSync: false,
          syncInterval: '30',
        });
      }
    });
  });
}

// 检查书签路径是否包含Sinan文件夹
async function isBookmarkInSinanFolder(bookmarkId) {
  return new Promise((resolve) => {
    chrome.bookmarks.get(bookmarkId, (bookmarks) => {
      if (chrome.runtime.lastError || !bookmarks.length) {
        resolve(false);
        return;
      }

      const bookmark = bookmarks[0];
      
      // 递归检查父级路径
      function checkParentPath(parentId) {
        if (!parentId) {
          resolve(false);
          return;
        }

        chrome.bookmarks.get(parentId, (parents) => {
          if (chrome.runtime.lastError || !parents.length) {
            resolve(false);
            return;
          }

          const parent = parents[0];
          
          // 如果父级文件夹名为Sinan，则在Sinan目录下
          if (parent.title === SINAN_FOLDER_NAME) {
            resolve(true);
            return;
          }

          // 继续检查上级目录
          if (parent.parentId) {
            checkParentPath(parent.parentId);
          } else {
            resolve(false);
          }
        });
      }

      checkParentPath(bookmark.parentId);
    });
  });
}

// 上传书签到服务器
async function uploadBookmarkToServer(bookmark) {
  try {
    const config = await getConfig();
    
    if (!config.apiKey || !config.serverUrl) {
      console.log('API配置不完整，跳过上传书签');
      return;
    }

    const bookmarkData = {
      name: bookmark.title,
      url: bookmark.url,
      description: '',
    };

    console.log('上传书签到服务器:', bookmarkData);

    const response = await fetch(`${config.serverUrl}/api/bookmark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': config.apiKey,
      },
      body: JSON.stringify(bookmarkData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('书签上传成功:', result);

  } catch (error) {
    console.error('上传书签失败:', error);
  }
}

// 监听书签创建事件
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  console.log('检测到书签创建:', bookmark);

  // 如果不是URL书签（即是文件夹），跳过
  if (!bookmark.url) {
    console.log('跳过文件夹创建事件');
    return;
  }

  // 检查是否在Sinan文件夹下
  const isInSinanFolder = await isBookmarkInSinanFolder(id);
  
  if (isInSinanFolder) {
    console.log('书签在Sinan目录下，跳过上传');
    return;
  }

  console.log('书签不在Sinan目录下，准备上传到服务器');
  
  // 检查是否启用了自动同步
  const config = await getConfig();
  if (!config.autoSync) {
    console.log('自动同步未启用，跳过上传');
    return;
  }

  // 上传书签到服务器
  await uploadBookmarkToServer(bookmark);
});

// 定时同步相关
const SYNC_ALARM_NAME = 'sinan-sync';

// 获取所有书签根目录
async function getRootBookmarks() {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((bookmarkTree) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(bookmarkTree);
      }
    });
  });
}

// 查找所有名为 'Sinan' 的文件夹
function findSinanFolders(nodes) {
  const sinanFolders = [];

  const traverse = (nodes) => {
    for (const node of nodes) {
      if (node.title === SINAN_FOLDER_NAME && !node.url && node.children) {
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

// 删除书签节点
async function removeBookmarkNode(id) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.removeTree(id, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

// 创建书签文件夹
async function createBookmarkFolder(parentId, title) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.create({
      parentId: parentId,
      title: title
    }, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result);
      }
    });
  });
}

// 创建书签
async function createBookmark(parentId, title, url) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.create({
      parentId: parentId,
      title: title,
      url: url
    }, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result);
      }
    });
  });
}

// 删除所有Sinan文件夹
async function deleteAllSinanFolders() {
  try {
    const bookmarkTree = await getRootBookmarks();
    const sinanFolders = findSinanFolders(bookmarkTree);
    
    console.log(`找到 ${sinanFolders.length} 个Sinan文件夹，准备删除...`);
    
    for (const folder of sinanFolders) {
      console.log(`删除文件夹: ${folder.title} (ID: ${folder.id})`);
      await removeBookmarkNode(folder.id);
    }
    
    console.log(`成功删除 ${sinanFolders.length} 个Sinan文件夹`);
    return sinanFolders.length;
  } catch (error) {
    console.error('删除Sinan文件夹时出错:', error);
    throw error;
  }
}

// 创建书签树结构
async function createBookmarkTree(bookmarkSpaces) {
  try {
    // 获取"所有书签"目录 (通常是 "2")
    const bookmarkTree = await getRootBookmarks();
    const otherBookmarksFolder = bookmarkTree[0]?.children?.find(child => child.id === '2');
    
    if (!otherBookmarksFolder) {
      throw new Error('无法找到"所有书签"目录');
    }

    console.log(`准备在"所有书签"目录下创建 ${bookmarkSpaces.length} 个书签空间...`);

    // 创建主Sinan文件夹
    const mainSinanFolder = await createBookmarkFolder(otherBookmarksFolder.id, SINAN_FOLDER_NAME);
    console.log(`创建主文件夹: ${mainSinanFolder.title} (ID: ${mainSinanFolder.id})`);

    // 创建每个书签空间
    for (const space of bookmarkSpaces) {
      console.log(`创建空间文件夹: ${space.spaceName}`);
      const spaceFolder = await createBookmarkFolder(mainSinanFolder.id, space.spaceName);
      
      // 创建空间内的书签
      for (const bookmark of space.bookmarks) {
        console.log(`  创建书签: ${bookmark.name} -> ${bookmark.url}`);
        await createBookmark(spaceFolder.id, bookmark.name, bookmark.url);
      }
    }

    console.log('书签树创建完成!');
  } catch (error) {
    console.error('创建书签树时出错:', error);
    throw error;
  }
}

// 执行同步书签操作
async function performSync() {
  console.log('=== 开始定时同步书签 ===');
  
  try {
    const config = await getConfig();
    
    if (!config.apiKey || !config.serverUrl) {
      console.log('API配置不完整，跳过定时同步');
      return;
    }

    // 1. 删除所有现有的Sinan文件夹
    console.log('步骤1: 删除现有Sinan文件夹...');
    const deletedCount = await deleteAllSinanFolders();
    console.log(`步骤1完成: 删除了 ${deletedCount} 个文件夹`);
    
    // 2. 从API获取最新的书签数据
    console.log('步骤2: 从API获取书签数据...');
    const response = await fetch(`${config.serverUrl}/api/bookmark?pinyin=true`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': config.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const bookmarkTreeResponse = await response.json();
    console.log('API响应:', bookmarkTreeResponse);
    
    if (bookmarkTreeResponse.code !== 0) {
      throw new Error(`API响应错误 (code: ${bookmarkTreeResponse.code}): ${bookmarkTreeResponse.message}`);
    }

    console.log(`步骤2完成: 获取到 ${bookmarkTreeResponse.data.length} 个书签空间`);

    // 3. 创建新的书签树
    console.log('步骤3: 创建新的书签树...');
    await createBookmarkTree(bookmarkTreeResponse.data);
    console.log('步骤3完成: 书签树创建完成');
    
    // 4. 更新最后同步时间
    const newConfig = { ...config, lastSyncTime: Date.now() };
    chrome.storage.sync.set({ [STORAGE_KEY]: newConfig });
    
    console.log('=== 定时同步完成 ===');
    console.log(`定时同步成功！同步了 ${bookmarkTreeResponse.data.length} 个书签空间`);

  } catch (error) {
    console.error('=== 定时同步失败 ===');
    console.error('错误详情:', error);
    console.error(`定时同步失败: ${error.message}`);
  }
}

// 设置同步定时器
async function setupSyncAlarm() {
  const config = await getConfig();
  
  // 先清除现有定时器
  await chrome.alarms.clear(SYNC_ALARM_NAME);
  
  if (!config.autoSync) {
    console.log('自动同步未启用，已清除定时器');
    return;
  }

  const intervalMinutes = parseInt(config.syncInterval);
  console.log(`设置定时同步，间隔: ${intervalMinutes} 分钟`);
  
  // 创建新的定时器
  chrome.alarms.create(SYNC_ALARM_NAME, {
    delayInMinutes: intervalMinutes,
    periodInMinutes: intervalMinutes
  });
  
  // 验证定时器是否创建成功
  const alarms = await chrome.alarms.getAll();
  const syncAlarm = alarms.find(alarm => alarm.name === SYNC_ALARM_NAME);
  if (syncAlarm) {
    console.log('定时器创建成功:', syncAlarm);
  } else {
    console.error('定时器创建失败');
  }
}

// 监听定时器触发
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SYNC_ALARM_NAME) {
    console.log('定时同步触发');
    await performSync();
  }
});

// 监听存储变化，更新定时器
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'sync' && changes[STORAGE_KEY]) {
    console.log('配置发生变化，重新设置定时器');
    await setupSyncAlarm();
  }
});

// 扩展启动时设置定时器
chrome.runtime.onStartup.addListener(async () => {
  console.log('扩展启动，设置定时同步');
  await setupSyncAlarm();
});

// 扩展安装时设置定时器
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('扩展安装/更新，设置定时同步:', details.reason);
  await setupSyncAlarm();
});

// 搜索书签
async function searchBookmarks(query) {
  return new Promise((resolve) => {
    chrome.bookmarks.search(query, (results) => {
      if (chrome.runtime.lastError) {
        console.error('搜索书签失败:', chrome.runtime.lastError);
        resolve([]);
      } else {
        // 只返回有URL的书签（非文件夹）
        const filteredResults = results
          .filter(bookmark => bookmark.url)
          .slice(0, 10); // 限制结果数量
        resolve(filteredResults);
      }
    });
  });
}

// Omnibox事件监听器
chrome.omnibox.onInputStarted.addListener(() => {
  console.log('Omnibox输入开始');
});

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  if (!text.trim()) {
    suggest([]);
    return;
  }

  try {
    const bookmarks = await searchBookmarks(text);
    const suggestions = bookmarks.map(bookmark => ({
      content: bookmark.url,
      description: `${bookmark.title} - ${bookmark.url}`
    }));
    
    suggest(suggestions);
  } catch (error) {
    console.error('生成建议失败:', error);
    suggest([]);
  }
});

chrome.omnibox.onInputEntered.addListener((text, disposition) => {
  // 如果text是完整的URL，直接打开
  if (text.startsWith('http://') || text.startsWith('https://')) {
    switch (disposition) {
      case 'currentTab':
        chrome.tabs.update({ url: text });
        break;
      case 'newForegroundTab':
        chrome.tabs.create({ url: text });
        break;
      case 'newBackgroundTab':
        chrome.tabs.create({ url: text, active: false });
        break;
    }
  } else {
    // 如果不是URL，进行搜索并打开第一个结果
    searchBookmarks(text).then(bookmarks => {
      if (bookmarks.length > 0) {
        const url = bookmarks[0].url;
        switch (disposition) {
          case 'currentTab':
            chrome.tabs.update({ url: url });
            break;
          case 'newForegroundTab':
            chrome.tabs.create({ url: url });
            break;
          case 'newBackgroundTab':
            chrome.tabs.create({ url: url, active: false });
            break;
        }
      }
    });
  }
});

// Service Worker启动时初始化
(async () => {
  console.log('Sinan Chrome Extension Service Worker 已启动');
  
  // 初始化定时器设置
  try {
    await setupSyncAlarm();
    console.log('定时同步初始化完成');
  } catch (error) {
    console.error('定时同步初始化失败:', error);
  }
})();