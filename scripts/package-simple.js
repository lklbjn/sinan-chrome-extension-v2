#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 项目根目录
const projectRoot = path.resolve(__dirname, '..');
const distPath = path.join(projectRoot, 'dist');
const outputDir = path.join(projectRoot, 'packages');

console.log('🚀 开始打包Chrome扩展...');

// 检查dist目录是否存在
if (!fs.existsSync(distPath)) {
  console.error('❌ dist目录不存在，请先运行 npm run build');
  process.exit(1);
}

// 创建packages目录
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log('📁 已创建packages目录');
}

// 读取manifest.json获取版本号
let version = 'unknown';
try {
  const manifestPath = path.join(distPath, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    version = manifest.version || 'unknown';
    console.log(`📋 检测到扩展版本: v${version}`);
  }
} catch (error) {
  console.warn('⚠️ 无法读取manifest.json版本信息:', error.message);
}

// 生成文件名
const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
const filename = `sinan-extension-v${version}-${timestamp}.zip`;
const outputPath = path.join(outputDir, filename);

console.log(`📦 输出文件: ${filename}`);

try {
  // 使用系统的zip命令
  const command = `cd "${distPath}" && zip -r "${outputPath}" . -x "*.DS_Store" "*.git*"`;
  console.log('🔄 正在压缩文件...');
  
  execSync(command, { stdio: 'pipe' });
  
  // 获取文件大小
  const stats = fs.statSync(outputPath);
  const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
  
  console.log('✅ 打包完成！');
  console.log(`📊 文件大小: ${sizeInMB} MB`);
  console.log(`📁 输出路径: ${outputPath}`);
  console.log('');
  console.log('🎉 扩展包已准备就绪，可以上传到Chrome Web Store！');
  console.log('');
  console.log('💡 提示:');
  console.log('  - 上传前请检查manifest.json中的版本号');
  console.log('  - 确保所有必需的权限都已正确配置');
  console.log('  - 测试扩展的所有功能是否正常工作');

} catch (error) {
  console.error('❌ 打包失败:', error.message);
  console.error('');
  console.error('💡 可能的解决方案:');
  console.error('  - 确保系统已安装zip命令');
  console.error('  - 检查dist目录是否有读取权限');
  console.error('  - 确保packages目录有写入权限');
  process.exit(1);
}