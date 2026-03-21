# TextBridge Windows 打包设计

## 概述

为 TextBridge 项目添加 Windows 平台打包能力，生成可分发的 exe 安装包和便携版。

## 技术选型

| 工具 | 选择 | 理由 |
|------|------|------|
| 打包工具 | **electron-builder** | 社区主流、配置简洁、NSIS 支持开箱即用 |
| 安装程序 | **NSIS** | Windows 广泛支持、可生成安装向导 |
| .NET 运行时 | **自包含 (self-contained)** | 用户无需预装 .NET SDK，开箱即用 |

## 构建流程

打包命令 `npm run package` 依次执行：

1. `npm run build` — 构建前端 (Vite + React) 和 Electron 主进程
2. `npm run helper:publish` — 发布自包含 .NET helper（win-x64 Release）
3. `electron-builder --win --dir` — 打包为 Windows 便携目录
4. （可选）`electron-builder --win` — 生成 NSIS 安装包

### 构建步骤详解

#### Step 1: 构建前端和 Electron

```powershell
npm run build
```

- `build:renderer`: Vite 构建 React 应用到 `dist/`
- `build:electron`: TypeScript 编译主进程到 `dist-electron/`

#### Step 2: 发布 .NET Helper（自包含）

```powershell
npm run helper:publish
```

已有命令 `-c Release -r win-x64 --self-contained false`，需改为 `--self-contained true`：

```powershell
dotnet publish native/win32-helper/TextBridge.Win32Helper.csproj -c Release -r win-x64 --self-contained true -o release/win-unpacked/resources/helper
```

#### Step 3: electron-builder 打包

```powershell
npm run package
```

## 输出产物

```
release/
└── win-unpacked/
    ├── TextBridge.exe                    # 便携版可执行文件
    ├── resources/
    │   ├── app/                          # 打包后的 Electron 应用
    │   │   ├── dist/                     # 前端构建产物
    │   │   └── dist-electron/            # Electron 主进程构建产物
    │   └── helper/                       # 自包含 .NET helper
    │       └── TextBridge.Win32Helper.exe
    └── ...
```

## package.json 配置变更

### 新增依赖

```json
"devDependencies": {
  "electron-builder": "^26.0.0"
}
```

### 新增脚本

```json
"scripts": {
  "package": "npm run build && npm run helper:publish && electron-builder --win --dir",
  "package:installer": "npm run build && npm run helper:publish && electron-builder --win"
}
```

### 新增 electron-builder 配置

```json
"build": {
  "appId": "com.textbridge.app",
  "productName": "TextBridge",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**/*",
    "dist-electron/**/*",
    "!node_modules/**/*"
  ],
  "extraResources": [
    {
      "from": "release/win-unpacked/resources/helper",
      "to": "helper",
      "filter": ["**/*"]
    }
  ],
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      }
    ],
    "icon": "build/icons/icon-256.png"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true
  }
}
```

## 实现任务

| # | 任务 | 状态 |
|---|------|------|
| 1 | 安装 electron-builder 依赖 | 待执行 |
| 2 | 添加 package.json scripts 和 build 配置 | 待执行 |
| 3 | 修改 helper:publish 为自包含模式 | 待执行 |
| 4 | 验证 `npm run package` 成功生成 exe | 待执行 |
| 5 | 更新 README 文档（打包说明） | 待执行 |

## 验证方法

```powershell
npm run package
# 验证 release/win-unpacked/TextBridge.exe 存在
# 验证 release/win-unpacked/resources/helper/TextBridge.Win32Helper.exe 存在
.\release\win-unpacked\TextBridge.exe  # 运行测试
```

## 后续扩展

- macOS 打包：添加 `electron-builder --mac` 配置
- Linux 打包：添加 `electron-builder --linux` 配置
- 自动更新：集成 electron-updater
