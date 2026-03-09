# Windows Helper Manual Validation

## 目标

本文档用于在 Windows 开发环境中手工验证 TextBridge 的真实 helper 链路，重点覆盖：

- 全局快捷键是否真正触发 quick translation
- `native/win32-helper` 是否被主进程惰性拉起并保持可观测
- 标准可编辑控件中的捕获、翻译、写回与 fallback 是否符合预期
- 日志和运行状态面板是否足够支持故障判断

## 启动前提

需要先确认：

- `npm install` 已完成
- `.NET SDK 10.x` 可用
- 当前系统为 Windows

建议先执行：

```powershell
dotnet --info
npm run typecheck
```

## 启动方式

开发环境下使用：

```powershell
npm run dev
```

这会同时启动：

- Vite renderer
- Electron 主进程 TypeScript watch
- Electron 应用本体

Windows helper 不会在 Electron 启动时立即常驻，而是在首次触发系统交互请求时惰性启动。

## 调试日志

开发环境默认开启 `debug` 级别日志。可通过以下位置观察：

- 主进程诊断日志：
  `app.getPath('userData')/logs/diagnostic.log`
- helper 日志：
  开发环境下默认位于 `native/win32-helper/bin/Debug/net10.0-windows/logs/win32-helper.log`

额外说明：

- helper 协议响应只走 `stdout`
- helper 诊断日志只走 `stderr` 和 helper 日志文件
- 设置页运行状态面板会同步展示 `helperState`、`helperLastErrorCode` 和 `helperPid`

## 标准验证流程

### 1. 先确认 UI 基线

1. 打开 TextBridge 设置页。
2. 进入“运行状态”区块。
3. 确认能看到：
   - 当前 Provider
   - 已注册快捷键
   - `Helper 状态`
   - `最近 Helper 错误`
   - `Helper PID`

预期：

- 应用刚启动时 `helperState` 通常为 `idle`
- 在没有触发任何翻译前，`helperPid` 通常为 `未启动`

### 2. 验证记事本标准输入框

1. 打开 Windows 记事本。
2. 输入一段英文，例如 `Hello from TextBridge`.
3. 选中其中一部分文本。
4. 按下快速翻译快捷键。
5. 回到 TextBridge 设置页，刷新或重新查看运行状态。

预期：

- helper 从 `idle` 变为 `ready` 或曾短暂经过 `starting`
- 最近执行记录出现 `quick-translation`
- `captureMethod` 为 `uia` 或 `clipboard`
- `writeBackMethod` 为 `replace-selection`、`paste-translation` 或 `popup-fallback`

如果直接回写失败，也应满足：

- 最近执行状态为 `fallback-required`
- 译文已被复制到剪贴板
- 运行状态能看到最近错误信息

### 3. 验证剪贴板 fallback

1. 选择一个 `UIA` 选区能力较弱但允许复制的文本框。
2. 选中文本。
3. 触发快速翻译快捷键。

预期：

- `captureMethod` 最终可能变为 `clipboard`
- helper 日志中可看到复制快捷键与剪贴板读取相关记录

### 4. 验证写回 fallback

1. 选择一个可粘贴但不易安全做局部替换的输入框。
2. 触发快速翻译。

预期：

- `replace-selection` 失败时不应整框覆盖
- `paste-translation` 若成功，最近执行应标记为 `completed`
- 若 `paste-translation` 也失败，应进入 `popup-fallback`

### 5. 验证权限边界

1. 以管理员权限启动一个目标窗口。
2. 保持 TextBridge 以普通权限运行。
3. 在该目标窗口中尝试触发翻译。

预期：

- 不应静默成功
- 运行状态和日志里应出现明确的 helper 错误
- 这类窗口当前不属于首版承诺范围

## 失败样本记录方式

当验证失败时，至少记录以下信息：

- 日期与时间
- 目标应用名称与版本
- 窗口标题
- 选中文本是否明确存在
- 按下的快捷键
- 运行状态面板中的：
  - `helperState`
  - `helperLastErrorCode`
  - 最近执行状态
- `diagnostic.log` 相关片段
- `win32-helper.log` 相关片段

## 推荐验证命令

在准备提测或阶段收口前，建议依次执行：

```powershell
npm test
npm run typecheck
dotnet test native/win32-helper/TextBridge.Win32Helper.Tests/TextBridge.Win32Helper.Tests.csproj
npm run build
```

## 当前已知缺口

- context translation 仍缺完整的独立弹窗交互与 IPC 回传
- fallback 结果页目前仍以主窗口承接，不是完整的独立弹窗流
- 首版完成标准以标准可编辑控件为主，观察范围和不承诺范围请参考兼容矩阵
