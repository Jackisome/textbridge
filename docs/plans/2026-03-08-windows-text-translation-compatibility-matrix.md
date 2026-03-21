# Windows Text Translation Compatibility Matrix

**Date:** 2026-03-19
**Status:** Active baseline - verified samples updated through 2026-03-19

## Scope

本矩阵用于记录 Windows helper 首版在不同目标输入控件中的真实表现。首版承诺范围仅限“标准可编辑控件”，其余目标先按观察样本记录，不把偶发成功当成承诺兼容。

本版本在原有应用级分类基础上，新增**控件类型维度**和**技术挑战分类**，以更精准地指导捕获/回写策略选择。

## Result Labels

- `Pass`：捕获、翻译、写回链路可稳定完成
- `Fallback`：自动写回失败，但 popup fallback 与剪贴板保留可用
- `Blocked`：由于权限、控件能力或 helper 故障，无法进入有效闭环
- `Not Run`：尚未进行人工验证

---

## 1. Technical Challenge Taxonomy

### 1.1 UI Automation 限制类

| 挑战 | 影响控件 | 表现 | 建议策略 |
|-----|---------|------|---------|
| TextPattern 选区返回空 | RichEdit20W/50W, contenteditable | `GetSelection()` 返回空数组，但视觉有选区 | 自动切换 Clipboard |
| 无 ValuePattern | 某些自定义控件 | 无法读写控件值 | Clipboard 兜底 |
| 框架根窗口拦截 | Chromium, Electron | UIA 只能看到外层窗口，无法穿透到渲染进程 | 优先 Clipboard |

### 1.2 跨进程/跨语言边界类

| 挑战 | 影响控件 | 表现 | 建议策略 |
|-----|---------|------|---------|
| 渲染进程隔离 | Chromium, Electron | 外层只能看到 `Chrome_WidgetWin_1`，看不到 DOM | 强制 Clipboard 路径 |
| 无 UIA Provider | Qt (无原生 UIA), Java Swing (无 Access Bridge) | 无法通过 UIA 访问控件 | 纯 Clipboard 路径 |
| UAC 完整性级别 | 管理员权限窗口 | 访问被拒绝 | 返回明确错误，不尝试提权 |

### 1.3 IME 输入处理类

| 挑战 | 影响 | 表现 | 建议策略 |
|-----|------|------|---------|
| 组合字符串丢失 | 所有控件 (CJK 输入场景) | 正在输入的拼音/五笔被截断，只捕获已提交的文本 | 捕获前等待 IME 组合状态稳定 |
| 组合窗口独立存在 | Windows 10/11 IME | 组合窗口是独立 HWND，不随文本框聚焦 | 检测到 IME 状态时增加延迟 |

### 1.4 安全限制类

| 挑战 | 影响 | 表现 | 建议策略 |
|-----|------|------|---------|
| 密码框屏蔽 | WPF PasswordBox, Win32 ES_PASSWORD | UIA 拒绝返回实际文本 | 检测到密码框时跳过文本获取 |
| 安全输入字段 | 银行插件, 信用卡字段 | 同上 | 同上 |

### 1.5 渲染引擎/富文本类

| 挑战 | 影响控件 | 表现 | 建议策略 |
|-----|---------|------|---------|
| 自绘控件无 HWND | 游戏, IDE 代码编辑器, Canvas 应用 | 无标准 Win32 控件可供枚举，完全依赖剪贴板 | 纯 Clipboard 路径 |
| 富文本格式保留 | Word, WPS, RichTextBox | 粘贴纯文本可能丢失格式或格式混乱 | 提示用户可能存在格式问题 |
| ContentEditable DOM 嵌套 | 复杂 Web 富文本编辑器 | UIA 选区坐标与 DOM 选区坐标不一致 | 强制 Clipboard 路径 |

---

## 2. Compatibility Matrix (by Control Type)

| 控件类型 | Category | 捕获优先级 | 回写优先级 | 典型失败模式 | 当前状态 | 首版承诺 |
|---------|----------|----------|-----------|-------------|---------|---------|
| Win32 Edit (单行) | 标准控件 | UIA TextPattern → Clipboard | ValuePattern.SetValue → Paste | RichEdit 选区不一致 | Not Run | 是 |
| Win32 RichEdit20W/50W | 标准控件 | UIA TextPattern → Clipboard | ValuePattern.SetValue → Paste | TextPattern 返回空选区，格式混入纯文本 | Not Run | 是 |
| Win32 SysListView32 (编辑中单元格) | 标准控件 | Clipboard | Paste | 内嵌编辑控件 UIA 遍历可能不完整 | Not Run | 是 |
| WinForms TextBox | .NET WinForms | UIA TextPattern → Clipboard | ValuePattern.SetValue → Paste | 第三方控件库可能不支持 UIA | Not Run | 是 |
| WinForms RichTextBox | .NET WinForms | UIA TextPattern → Clipboard | ValuePattern.SetValue → Paste | RTF 格式处理复杂 | Not Run | 是 |
| WPF TextBox | WPF 控件 | UIA TextPattern → Clipboard | ValuePattern.SetValue → Paste | 密码框拒绝暴露文本 | Not Run | 是 |
| WPF RichTextBox | WPF 控件 | UIA TextPattern → Clipboard | ValuePattern.SetValue → Paste | FlowDocument 格式处理复杂 | Not Run | 是 |
| Chromium `<input type=”text”>` | Web 控件 | Clipboard | Paste | 渲染进程隔离导致 UIA 返回空 | Not Run | 观察 |
| Chromium `<textarea>` | Web 控件 | UIA TextPattern → Clipboard | replace-selection → Paste | DOM 复杂度较低时可成功；不要外推到 contenteditable | Pass | 2026-03-18 Chrome 观察样本已验证，`replace-selection` 成功；仍属于观察样本 |
| Chromium `contenteditable` | Web 控件 | Clipboard | Paste | DOM 选区与 UIA 选区坐标错位 | Not Run | 观察 |
| Electron Renderer (聊天输入框等) | Electron 控件 | Clipboard | Paste | 渲染进程隔离，同 Chromium | Not Run | 观察 |
| Java Swing JTextField/JTextArea | Java 控件 | Clipboard | Clipboard | 无 Java Access Bridge 或未启用 | Not Run | 观察 |
| Java Swing JEditorPane (HTML) | Java 控件 | Clipboard | Clipboard | UIA 支持极差，几乎无可靠选区 | Not Run | 观察 |
| Qt QLineEdit | Qt 控件 | Clipboard | Clipboard | 无原生 UIA Provider | Not Run | 观察 |
| Qt QTextEdit | Qt 控件 | Clipboard | Clipboard | 同上 | Not Run | 观察 |
| DirectX/游戏内嵌聊天 | 游戏控件 | Clipboard | Clipboard | 无标准 HWND，自绘渲染 | Not Run | 否 |
| Unity/UWE 游戏 | 游戏控件 | Clipboard | Clipboard | 同上 | Not Run | 否 |
| 管理员权限窗口 | 负向样本 | Blocked | Blocked | UAC 完整性级别拦截 | Not Run | 否 |
| 触控键盘 (TabTip.exe) | 系统控件 | Blocked | Blocked | 独立进程，输入走虚拟按键管道 | Not Run | 否 |
| Windows 记事本 | 标准控件 - 验证基准 | UIA TextPattern → Clipboard | replace-selection → Paste | 首版主验证目标 | Pass | 2026-03-19 已验证，两次直接 replace-selection 成功；目标摘要为 `processName=Notepad` / `controlType=Document` / `framework=Win32` |
| 系统设置搜索框 | 标准控件 | UIA → Clipboard | ValuePattern → Paste | 焦点漂移风险 | Not Run | 是 |

---

## 3. Per-Control-Type Detailed Notes

### Latest Verified Samples

- `2026-03-18` Chromium `<textarea>`：主日志确认 `capture-text` 成功后，`write-text(method=replace-selection)` 直接成功，`selectionMatchedExpected=true`、`targetStable=true`、`valueChanged=true`、`translatedTextDetected=true`
- `2026-03-19` Windows 记事本：两次独立触发均直接走 `replace-selection` 成功，说明当前 helper 已覆盖标准 Win32 文本编辑目标，不再只依赖 Chrome 观察样本
- `2026-03-21` Chromium 地址栏 / omnibox + `context-translation`：仅观察到 `capture-selection-context` 通过 `clipboard` 降级成功，但修复后返回 `anchorKind=cursor`/`window-rect`（而非 `unknown`）且包含有效的 `restoreTarget` token；restore 逻辑已升级为支持复合 token 和 UI Automation 控制 refocus，仍为 fallback-only 样本，不能计为 `Pass`
- 当前下一轮优先验证目标：`系统设置搜索框`、`WPF TextBox`、`Win32 RichEdit20W/50W`

### Win32 Edit/RichEdit

- **UIA 支持**: Edit 控件通常通过 `IAccessible` → UIA 转换层暴露 TextPattern，选区支持良好
- **RichEdit 特殊性**: RichEdit20W/50W 的 TextPattern 实现不完整，`GetSelection()` 可能返回空范围，即使视觉上有选区。建议先尝试 UIA，失败后立即回退到 Clipboard
- **多行 vs 单行**: Multiline Edit 的 ValuePattern.SetValue 需要考虑换行符处理；当前 helper 已在校验阶段做 `CRLF/LF` 归一化，避免多行文本因换行表示差异被误判失败
- **记事本状态**: Windows 记事本已人工验证 `Pass`，当前主路径是 `uia capture -> replace-selection`

### Chromium / Electron

- **进程隔离**: Chromium 的渲染进程是独立的，UIA 从外部只能看到 `Chrome_WidgetWin_1` 窗口，无法穿透到 DOM 层
- **ContentEditable**: 富文本编辑器通常使用 contenteditable div，选区存在于 DOM 中，UIA 无法获取
- **Textarea 观察样本已通过**: Chrome `<textarea>` 已观察到 `UIA TextPattern + replace-selection` 成功，不应再把所有 Chromium 输入框一概视为“只能 Clipboard”
- **地址栏 / Omnibox 需单独看待**: Chrome 地址栏在当前 `context-translation` 样本里没有拿到可恢复的选择上下文，`capture-selection-context` 会退化成 `clipboard` 路径；修复后（2026-03-21）clipboard 降级现在返回 `anchorKind=cursor`/`window-rect` 且包含有效的 restore token，但 control refocus 在 Chromium 渲染进程隔离下仍可能不可靠；omnibox 不要和 `<textarea>` 的成功表现混为一谈
- **复杂 DOM 仍优先 Clipboard**: `contenteditable`、复杂聊天输入框和 Electron 渲染层输入控件依旧优先按 Clipboard 路径评估，不把 `<textarea>` 的成功外推到整类目标

### Java Swing

- **Java Access Bridge**: JBSProvider.dll 提供了 UIA 到 AT-SPI 的桥接，但默认可能未安装或未启用
- **测试验证方法**: 检查 `jabswitch -enable` 是否执行，或查看 `AccessibleContext` 是否暴露正确信息
- **可靠性**: 即使 Access Bridge 可用，TextPattern 支持也有限，Clipboard 是更稳定的选择

### Qt Apps

- **无原生 UIA**: Qt 官方不提供 UIA Provider，Qt Assistant 说”Qt accessibility goes through AT-SPI on Linux, MSAA on Windows”
- **MSAA 到 UIA 转换**: Windows 提供有限的 MSAA → UIA 转换，但 Qt 控件的文本编辑信息转换不完整
- **结论**: Qt 应用几乎总是需要 Clipboard 路径

### WPF

- **原生 UIA 支持**: WPF 从设计之初就考虑了 UIA，TextBox/RichTextBox 的 TextPattern 实现完整
- **密码框**: WPF PasswordBox 的 UIA 实现会阻止文本暴露，这是设计行为，不是 bug
- **RichTextBox**: FlowDocument 结构复杂，建议写回时使用纯文本粘贴而非 ValuePattern.SetValue

### DirectX / Game Engines

- **无标准控件**: 游戏使用 DirectX/OpenGL 直接渲染到屏幕，不创建标准 Win32 控件
- **文本聊天**: 部分游戏内嵌聊天窗口，但这些窗口由游戏自己绘制，UIA 看不到内部结构
- **唯一可行方案**: Clipboard 模拟（游戏通常允许全局快捷键和剪贴板操作）

### IME (Input Method Editor) 组合输入

- **问题现象**: 用户在用拼音输入法输入”你好”时，组合窗口显示”nihao”，但实际文本尚未提交
- **UIA 表现**: 组合期间 TextPattern 可能返回空或只返回已提交的部分
- **当前实现差距**: CaptureTextService 没有检测 IME 组合状态的逻辑，组合中的文本会被截断
- **建议**: 增加 `IMMGetCompositionString` 或检测 `WM_IME_COMPOSITION` 消息的逻辑

### 安全输入 (密码/信用卡)

- **密码框行为**: Win32 ES_PASSWORD 样式、WinForms UseSystemPasswordChar、WPF PasswordBox 都故意阻止 UIA 文本暴露
- **风险**: 当前 SetFocusedValue 没有检查目标是否是密码框，理论上可能误写入
- **建议**: 在 CaptureTextService 中增加密码框检测逻辑，发现后返回 `TEXT_CAPTURE_SECURE_FIELD` 并终止

---

## 4. Required Evidence Per Run

每条人工验证记录至少要包含：

- 目标应用名称与版本
- 输入控件类型或窗口类名
- 使用的快捷键
- 是否有明确选区
- 最终结果标签
- 运行状态面板中的 `helperState`
- 主进程日志关键行
- helper 日志关键行
- 若失败，记录 `errorCode`

## 5. Suggested Capture Template

```text
Target:
Window title / class:
Control type:
Selected text:
Shortcut:
Observed result:
Runtime helper state:
Main log excerpt:
Helper log excerpt:
Final label:
Notes:
```

## 6. Current Known Constraints

- 与 TextBridge 同权限级别的目标窗口才在首版保证范围内
- `replace-selection` 当前仅在可安全确认选区时才允许；否则会退回 `paste-translation` 或 popup fallback
- 降级到模拟复制/粘贴时，首版不恢复原剪贴板
- `context` 快捷键已具备独立 prompt 浮窗，锚点定位已实现（2026-03-21 fix commit `2edddbd`），弹窗位置现在基于 `selection-rect` / `control-rect` / `cursor` 计算
- Chromium 地址栏 / omnibox 当前未进入 `context-translation` 的自动回写承诺范围，仍为 fallback-only 样本；但 clipboard 降级路径现在返回 `anchorKind=cursor` 或 `window-rect`（而非 `unknown`），且包含有效的 `restoreTarget` token；restore 已升级为复合 token + UI Automation 控制 refocus（2026-03-21 fix commit `7a5b0fd`）
- **新增**: Clipboard 路径不会尝试检测 IME 组合状态，组合中的文本可能丢失
- **新增**: 密码框/安全字段当前不会主动检测和跳过，存在理论风险
- **新增**: 多行文本校验已做换行归一化，但这只保证 helper 的安全校验不过度误杀，不代表所有富文本/自绘控件都进入承诺范围
- **2026-03-21 修复**: `quick-translation` 和 `context-translation` 的主窗口焦点回归问题已通过 `runWithReleasedMainWindow` 解决（commit `b588805`）
