#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 项目根目录
const projectRoot = path.resolve(__dirname, '..');
const distPath = path.join(projectRoot, 'dist');
const outputDir = path.join(projectRoot, 'packages');

// 检查dist目录是否存在
if (!fs.existsSync(distPath)) {
  console.error('❌ dist目录不存在，请先运行 npm run build');
  process.exit(1);
}

// 创建packages目录
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 读取manifest.json获取版本号
let version = 'unknown';
try {
  const manifestPath = path.join(distPath, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    version = manifest.version || 'unknown';
  }
} catch (error) {
  console.warn('⚠️ 无法读取manifest.json版本信息:', error.message);
}

// 生成文件名
const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
const filename = `sinan-extension-v${version}-${timestamp}.zip`;
const outputPath = path.join(outputDir, filename);

console.log('🚀 开始打包Chrome扩展...');
console.log(`📁 源目录: ${distPath}`);
console.log(`📦 输出文件: ${outputPath}`);

// 创建归档
const output = createWriteStream(outputPath);
const archive = archiver('zip', {
  zlib: { level: 9 } // 最高压缩级别
});

// 监听归档事件
output.on('close', () => {
  const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log('✅ 打包完成！');
  console.log(`📊 文件大小: ${sizeInMB} MB`);
  console.log(`📁 输出路径: ${outputPath}`);
  console.log('');
  console.log('🎉 扩展包已准备就绪，可以上传到Chrome Web Store！');
});

archive.on('warning', (err) => {
  if (err.code === 'ENOENT') {
    console.warn('⚠️ 警告:', err.message);
  } else {
    throw err;
  }
});

archive.on('error', (err) => {
  console.error('❌ 打包失败:', err.message);
  process.exit(1);
});

// 开始打包
archive.pipe(output);

// 添加dist目录下的所有文件
archive.directory(distPath, false);

// 完成归档
archive.finalize();