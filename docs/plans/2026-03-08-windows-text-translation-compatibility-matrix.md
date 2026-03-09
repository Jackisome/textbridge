# Windows Text Translation Compatibility Matrix

## Scope

本文档记录 TextBridge Windows helper 首版的兼容性观察基线，服务于以下目标：

- 验证“快捷键 -> 捕获 -> 翻译 -> 回写/兜底”闭环是否能在标准可编辑控件中稳定工作
- 明确首版承诺范围、观察范围和不承诺范围
- 为后续 `1 -> 2 -> 3` 的兼容性扩展提供失败样本记录模板

## 首版承诺范围

- Windows 记事本
- 常见 Win32 / WPF 标准单行与多行输入框
- 常见系统设置类文本输入区域

## 观察范围

- Chromium 浏览器 `textarea` / 普通输入框
- Electron 应用输入框
- 常见聊天软件输入框

## 不承诺范围

- Office / WPS 富文本编辑区
- IDE 代码编辑器
- 自绘控件 / Canvas 文本区
- 提权窗口或完整性级别高于 TextBridge 的目标窗口

## Matrix

| Scenario | Capture Path | Write-back Path | Expected Result | Manual Check Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Notepad plain text | `uia` | `replace-selection` -> `paste-translation` | 有选区时优先捕获，安全替换失败则粘贴 | Pending | 首版主验证样本 |
| Win32/WPF standard input | `uia` | `replace-selection` -> `paste-translation` | 与记事本同类表现 | Pending | 标准控件主目标 |
| Browser textarea | `uia` -> `clipboard` | `paste-translation` | 捕获/回写可降级到剪贴板与粘贴 | Pending | 观察范围 |
| Electron chat input | `uia` -> `clipboard` | `paste-translation` | 焦点不丢失时尽量完成粘贴 | Pending | 观察范围 |
| VS Code editor | `clipboard` | `popup-fallback` | 不承诺直接替换，失败时应保留结果 | Pending | 不承诺范围 |
| Elevated admin window | blocked | blocked | 返回结构化错误，运行状态可见 helper 失败信息 | Pending | 权限边界验证 |

## 记录字段

每次人工验证至少记录：

- 目标应用与版本
- 窗口标题 / 进程名
- 选中文本是否存在
- 实际使用的捕获方式
- 实际使用的回写方式
- 最终结果：成功 / fallback-required / failed
- helper 错误码
- 主进程日志位置
- helper 日志位置

## Notes

- `replace-selection` 无法安全确认选区时必须失败，不能整框覆盖。
- `popup-fallback` 发生时，应确认译文已进入剪贴板且执行报告已记录。
- 验证过程中请同步参考 [2026-03-09-windows-helper-manual-validation.md](./2026-03-09-windows-helper-manual-validation.md)。
