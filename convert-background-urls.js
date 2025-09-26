// 转换背景图片URL从对象格式到数组格式
// 在浏览器扩展的开发者工具中运行此脚本

console.log('=== 背景图片URL转换脚本开始 ===');

// 存储键名
const STORAGE_KEY = 'sinan_config';
const BACKGROUND_URLS_KEY = `${STORAGE_KEY}_backgroundUrls`;

// 转换函数
async function convertBackgroundUrls() {
  try {
    // 1. 读取当前存储的数据
    console.log('读取当前存储的背景URL数据...');

    const result = await new Promise((resolve) => {
      chrome.storage.local.get([BACKGROUND_URLS_KEY], resolve);
    });

    const currentData = result[BACKGROUND_URLS_KEY];
    console.log('当前存储的数据:', currentData);

    // 2. 检查数据格式
    if (!currentData) {
      console.log('没有找到背景URL数据，无需转换');
      return;
    }

    // 3. 如果已经是数组格式，则不需要转换
    if (Array.isArray(currentData)) {
      console.log('数据已经是数组格式，无需转换');
      return;
    }

    // 4. 如果是对象格式，转换为数组
    if (typeof currentData === 'object' && currentData !== null) {
      console.log('检测到对象格式，开始转换...');

      // 将对象转换为数组
      const urlArray = [];

      // 按照数字键排序并提取URL
      const keys = Object.keys(currentData).sort((a, b) => parseInt(a) - parseInt(b));

      for (const key of keys) {
        const url = currentData[key];
        if (url && typeof url === 'string' && url.trim()) {
          urlArray.push(url.trim());
        }
      }

      console.log('转换后的数组:', urlArray);

      // 5. 保存转换后的数据
      if (urlArray.length > 0) {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({
            [BACKGROUND_URLS_KEY]: urlArray
          }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });

        console.log('✅ 成功转换并保存背景URL数据');
        console.log('转换结果:', urlArray);
      } else {
        console.log('❌ 没有有效的URL可以转换');
      }
    } else {
      console.log('数据格式不是对象，无法转换:', typeof currentData);
    }

  } catch (error) {
    console.error('❌ 转换过程中出现错误:', error);
  }
}

// 验证转换结果的函数
async function verifyConversion() {
  try {
    console.log('\n=== 验证转换结果 ===');

    const result = await new Promise((resolve) => {
      chrome.storage.local.get([BACKGROUND_URLS_KEY], resolve);
    });

    const data = result[BACKGROUND_URLS_KEY];
    console.log('验证 - 当前存储的数据:', data);
    console.log('验证 - 数据类型:', Array.isArray(data) ? '数组' : typeof data);

    if (Array.isArray(data)) {
      console.log('✅ 数据已成功转换为数组格式');
      console.log('数组长度:', data.length);
      data.forEach((url, index) => {
        console.log(`  [${index}]: ${url}`);
      });
    } else {
      console.log('❌ 数据仍不是数组格式');
    }
  } catch (error) {
    console.error('验证过程中出现错误:', error);
  }
}

// 执行转换
convertBackgroundUrls().then(() => {
  // 验证转换结果
  return verifyConversion();
}).then(() => {
  console.log('\n=== 背景图片URL转换脚本完成 ===');
}).catch((error) => {
  console.error('脚本执行失败:', error);
});