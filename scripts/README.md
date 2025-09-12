# 打包脚本使用说明

这个目录包含了用于打包Chrome扩展的脚本。

## 可用脚本

### 1. Node.js 脚本（推荐）

```bash
# 仅打包
npm run package

# 构建并打包
npm run build:package
```

### 2. Shell 脚本

```bash
# 直接运行shell脚本
npm run package:sh

# 使用版本号参数（会自动更新manifest.json并重新构建）
npm run package:sh 1.2.0

# 或者直接执行
./scripts/package.sh

# 或者直接执行并指定版本号
./scripts/package.sh 1.2.0
```

## 脚本说明

### `package-simple.js`
- 使用Node.js编写的简单打包脚本
- 依赖系统的`zip`命令
- 自动读取manifest.json中的版本号
- 生成带时间戳的zip文件名

### `package.sh`
- Bash shell脚本版本
- 支持版本号参数，会自动更新manifest.json并重新构建
- 包含彩色输出和详细的错误处理
- 适合在Unix/Linux/macOS环境下使用
- 支持语义化版本验证（例如：1.2.0）
- 自动备份和恢复manifest.json文件

### `package.js`
- 使用archiver库的完整版本（需要额外依赖）
- 目前项目中未使用，可作为参考

## 输出

所有打包脚本都会：

1. 检查`dist`目录是否存在
2. 创建`packages`目录（如果不存在）
3. 从manifest.json读取版本号
4. 生成格式为`sinan-extension-v{version}-{timestamp}.zip`的文件
5. 将文件保存到`packages`目录

## 使用流程

1. **构建项目**
   ```bash
   npm run build
   ```

2. **打包扩展**
   ```bash
   npm run package
   ```

3. **一键构建打包**
   ```bash
   npm run build:package
   ```

4. **指定版本号打包**（仅限shell脚本）
   ```bash
   # 使用指定版本号，会自动更新manifest.json并重新构建
   npm run package:sh 1.2.0
   ```

## 注意事项

- 确保已安装`zip`命令（大多数系统都默认安装）
- 确保有足够的磁盘空间
- 打包前建议清理不必要的文件
- 上传到Chrome Web Store前请测试扩展功能

## 文件排除

脚本会自动排除以下文件：
- `.DS_Store`（macOS系统文件）
- `.git*`（Git相关文件）
- `__pycache__*`（Python缓存）
- `*.pyc`（Python编译文件）

## 错误排查

如果遇到问题，请检查：

1. `dist`目录是否存在且包含构建文件
2. 系统是否安装了`zip`命令
3. 是否有足够的文件系统权限
4. `manifest.json`是否格式正确

## 自定义

如需自定义打包行为，可以修改脚本中的：
- 输出目录路径
- 文件名格式
- 排除文件列表
- 压缩级别