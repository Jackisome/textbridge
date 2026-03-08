# Windows Text Translation Compatibility Matrix

## Scope

本文档记录 TextBridge Windows MVP 的手工兼容性检查矩阵，用于验证“捕获 -> 翻译 -> 回写/兜底”链路在常见应用中的表现。

## Matrix

| Scenario | Capture Path | Write-back Path | Expected Result | Manual Check Status |
| --- | --- | --- | --- | --- |
| Notepad plain text | `UIA` | `replace-selection` | 直接替换选中文本，失败时进入 popup fallback | Pending |
| VS Code editor | `UIA` -> `clipboard` fallback | `paste-translation` | 当标准替换不可用时粘贴翻译结果 | Pending |
| Browser textarea | `UIA` | `replace-selection` | 保持焦点并完成替换 | Pending |
| Rich text control | `UIA` -> `clipboard` fallback | `popup-fallback` | 保留翻译结果并允许复制/重试插回 | Pending |
| Password / protected field | blocked | blocked | 不写回敏感字段，报告失败原因 | Pending |

## Notes

- MVP 阶段优先验证标准文本控件和常见编辑器，不承诺覆盖所有自绘控件。
- 当写回链路失败时，必须提供“复制结果”和“重试插回”两个兜底动作。
- 兼容性矩阵应在真实辅助进程接入后持续更新。
