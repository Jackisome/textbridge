# TextBridge

<p align="center">
  [<a href="../README.md">English</a>]
  [<a href="README.zh-CN.md">简体中文</a>]
  [日本語]
</p>

`TextBridge`はマルチプラットフォーム対応のテキスト翻訳クライアントプロジェクトです。最初の版本はWindowsシステムレベルのテキスト翻訳を最初の実装方向とし、标准テキストコントロールで「テキスト取得 → 翻訳 → 書戻/フォールバック表示」の闭环を実現することを目指しています。現在のレポジトリは`Electron + Vite + React + TypeScript`に基づいて構築されており、長期的な拡張に適したデスクトップアプリケーションの階層構造に整理されています。

## 現在の開発コンポーネント

### 実行とデスクトップ層

- `Electron`：デスクトップアプリケーションコンテナ、ウィンドウライフサイクルとネイティブ機能エントリ
- `Preload + ContextBridge`：`contextIsolation`を有効にした状態で安全に機能を公開

### フロントエンド層

- `React`：レンダリングプロセスのUIコンポーネント開発
- `React DOM`：ElectronページにReactアプリケーションをマウント
- `Vite`：レンダリング層の開発サーバー、HMRとフロントエンドビルド
- `TypeScript`：メインプロセス、プレロード、レンダリング層の統一型システム
- `Vitest`：ユニットテスト

### 翻訳 Provider

マルチProvider接続をサポートしており、统一インターフェースは`src/shared/types/provider.ts`で定義されています：

- `MiniMax`（ネイティブ実装、完全なエラー処理を含む）
- `Claude`（Anthropic）
- `Gemini`（Google）
- `DeepSeek`
- `Tongyi`（阿里雲）
- `Tencent`（騰訊雲）
- `Google`（Google Cloud Translation）
- `OpenAI-Compatible`（OpenAI互換のサードパーティモデル）
- `Custom`（ユーザー定義エンドポイント）

Provider設定は`src/electron/services/providers/`で統一管理されており、`src/shared/constants/provider-metadata.ts`で各Providerのメタデータを定義しています。

### 開発支援ツール

- `concurrently`：Vite、Electron TypeScript watch、Electronプロセスの並列起動
- `nodemon`：`dist-electron/`の変更を監視しElectronを自動再起動
- `wait-on`：ViteサービスとElectronコンパイル出力の準備完了を待機
- `cross-env`：Electron開発プロセスにクロスプラットフォーム環境変数を注入

## 環境依存

- `Node.js + npm`：レンダリング層、メインプロセス、テストコマンド用
- `.NET SDK 10.x`：`native/win32-helper`のビルド、実行、テスト用

以下のコマンドが使用可能であることを確認することをお勧めします：

```powershell
dotnet --info
npm --version
```

開発環境では`dotnet`が`PATH`にない場合、環境変数で実際のパスを指定できます：

```powershell
$env:TEXTBRIDGE_DOTNET_PATH="C:\Program Files\dotnet\dotnet.exe"
```

## 起動方法

### 開発モード

```powershell
npm run dev
```

開発モードでは以下のことを行います：

- `Vite`開発サーバーを起動、アドレスは固定で`http://127.0.0.1:5173`
- `src/electron/**/*.ts`を監視し継続的に`dist-electron/`にコンパイル
- Electronメインプロセスまたはプレロード出力の変更時にクライアントを自動再起動
- Reactレンダリング層の変更はVite HMRで処理、Electron全体の再起動は不要

### 本番リソースビルド

```powershell
npm run build
```

このコマンドは以下を行います：

- React + Viteを`dist/`にビルド
- Electronメインプロセスとプレロードスクリプトを`dist-electron/`にコンパイル

### ローカルでのビルド結果実行

```powershell
npm start
```

このコマンドはまず完全なビルドを実行してからElectronを起動します。

### 型チェック

```powershell
npm run typecheck
```

### Windows helper独立検証

```powershell
npm run helper:build
npm run helper:test
```

現在のWindows helperは`native/win32-helper/`にあり、目录構造は以下です：

- `Services/`：ビジネスサービス実装（`HealthCheckService`、`CaptureTextService`、`WriteTextService`）
- `Protocols/`：プロトコルリクエスト/レスポンスモデル
- `Interop/`：Windows API相互運用封装（UI Automation、クリップボード、入力シミュレーション）

開発モードでは、Electronメインプロセスが`dotnet run --project native/win32-helper/TextBridge.Win32Helper.csproj`を通じて遅延起動します。現在のターミナルに`dotnet`がない場合、メインプロセスは以下を順番に試行します：

- `TEXTBRIDGE_DOTNET_PATH`
- `DOTNET_ROOT/dotnet.exe`
- `C:/Program Files/dotnet/dotnet.exe`

対応しているプロトコルコマンド：

- `health-check`：helper機能リストを返す
- `capture-text`：テキストキャプチャ、`uia`（UI Automation）と`clipboard`の2つの方式をサポート
- `write-text`：テキスト書戻
- `clipboard-write`：クリップボード書き込み

手動検証の詳細な手順は以下を参照：

- [docs/plans/2026-03-09-windows-helper-manual-validation.md](plans/2026-03-09-windows-helper-manual-validation.md)
- [docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md](plans/2026-03-08-windows-text-translation-compatibility-matrix.md)

### パッケージビルド

```powershell
# ポータブル版をビルド（インストール不要）
npm run package

# NSIS インストーラーをビルド
npm run package:installer
```

出力：
- ポータブル版：`release/win-unpacked/TextBridge.exe`
- インストーラー：`release/TextBridge Setup 1.0.0.exe`

## ディレクトリ説明

- `src/electron/main.ts`：Electronメインプロセスエントリ
- `src/electron/preload.ts`：プレロードスクリプト
- `src/electron/ipc/`：IPCチャネル定義とhandler登録
- `src/electron/services/`：メインプロセスサービス層（翻訳実行、ショートカット、システムトレイ、ウィンドウ管理）
- `src/electron/services/providers/`：翻訳Provider実装（MiniMax、Claude、Geminiなど）
- `src/electron/platform/win32/`：Windowsプラットフォーム适配（Win32プロトコル、helperセッション）
- `src/renderer/app/main.tsx`：Reactレンダリングエントリ
- `src/renderer/app/App.tsx`：Reactページコンポーネント
- `src/renderer/features/runtime-status/`：実行状態パネル
- `src/renderer/pages/`：ページレベルビュー（設定ページ、フォールバック結果ページ、コンテキストポップアップページ）
- `src/core/`：純粋ビジネス層（use cases、entities、contracts）
- `src/shared/`：クロスプロセス共有型と定数
- `vite.config.ts`：Vite設定
- `tsconfig.json`：React / Vite TypeScript設定
- `tsconfig.electron.json`：ElectronメインプロセスTypeScript設定
- `index.html`：ViteとElectronの共用エントリページ
- `dist/`：Viteフロントエンドビルド成果物
- `dist-electron/`：Electron TypeScriptコンパイル成果物
- `native/win32-helper/`：Windowsネイティブhelper（.NET 10.x）

## 製品ポジショニング

- マルチプラットフォーム拡張向け、現在はデスクトップクライアントを中心に、最初の版本はWindows優先
- システムトレイに常駐し、グローバルショートカットでクイック翻訳またはコンテキスト強化翻訳をトリガー
- テキスト取得は`UI Automation`を優先、失敗時はクリップボードコラボレーションにフォールバック
- 書戻は元のコントロールの置換または挿入を優先、失敗時はポップアップ表示とコピー結果にフォールバック
- プラットフォーム差異は`src/electron/platform/`に統一收敛、現在の実装は`src/electron/platform/win32/`に集中

## 残りの作業

### 1. Windows テキスト翻訳能力拡張（最高優先度）

**計画ドキュメント**: [docs/plans/2026-03-19-windows-text-translation-expansion-plan.md](docs/plans/2026-03-19-windows-text-translation-expansion-plan.md)

**目標**: 現在の標準コントロール成功パスを壊すことなく、Windows テキスト翻訳能力を拡張し、「標準編集コントロール」と「ターミナル/IDE/複雑レンダリングターゲット」の処理戦略を明確にレイヤー化する。

| # | タスク | 状態 |
|---|------|------|
| 1 | ターゲット分類と戦略境界の固化 - `AutomationFacade` に `targetFamily`/`fallbackOnly` 分類を追加し、`WriteTextService` で Tier C ターゲットを高速失敗 | 未開始 |
| 2 | 標準 Win32/WPF テキストコントロールの安全な置換能力を補完 - RichEdit/WPF TextBox `TextPattern` 選択置換 | 未開始 |
| 3 | helper ターゲット戦略をプラットフォームログと実行レポートに露出 - `StdIoHost` diagnostics を拡張し、`targetFamily`/`fallbackOnly` を露出 | 未開始 |
| 4 | ビジネスレイヤーの fallback セマンティクスを維持 - `fallbackOnly=true` ターゲットは直接 popup へ、無効な書き戻しの再試行を停止 | 未開始 |
| 5 | マトリックスに従った手動検証を実行し証拠を記録 - Tier A/B/C ターゲットの検証と `compatibility-matrix.md` の更新 | 未開始 |

**推奨実行順序**: Task 1 → Task 3 → Task 4 → Task 2 → Task 5

### 2. 翻訳 Provider リファクタリング

**計画ドキュメント**: [docs/plans/2026-03-08-provider-refactor-implementation.md](docs/plans/2026-03-08-provider-refactor-implementation.md)

**目標**: 翻訳 provider アーキテクチャ、設定モデル、設定ページをリファクタリングし、claude、deepseek、minimax、gemini、google、tencent、tongyi、custom、mock をサポート。

| # | タスク | 状態 |
|---|------|------|
| 1 | provider 共有タイプとデフォルト設定の再構築 - `ProviderId` タイプ、`providers` 設定構造 | レビュー待ち |
| 2 | 設定永続化と正規化ロジックの書き直し | 未開始 |
| 3 | 各 provider HTTP アダプタの実装 | 未開始 |
| 4 | 設定ページ UI のリファクタリング | 未開始 |

### 3. 手動検証とドキュメントメンテナンス

| ターゲット | 説明 | 状態 |
|------|------|------|
| Windows 設定検索ボックス | Tier A ターゲットの手動検証 | 検証待ち |
| WPF TextBox | Tier A ターゲットの手動検証 | 検証待ち |
| Win32 RichEdit20W/50W | Tier A ターゲットの手動検証 | 検証待ち |
| VS Code / Terminal サンプル | Tier C fallback-only 動作の確認 | 検証待ち |
| 互換性マトリックス | 検証結果に基づく更新 | 未開始 |

### 4. 完了したプロジェクト（参照）

- ✅ Windows MVP コア構造（Tasks 1-11 of 2026-03-08 implementation）
- ✅ Windows Helper 統合（Tasks 1-8 of 2026-03-09 helper integration）
- ✅ 多言語 README サポート（English, 简体中文, 日本語）
- ✅ MiniMax Provider ネイティブ実装
- ✅ 翻訳フォールバック用のOSネイティブトースト通知（Electron Notification API）
- ✅ 翻訳時のロードインジケーター（透明クリック幕等窗口、カーソル旁に回しアニメーション、quick translation と強化翻訳をサポート）

---

## MVP境界

- 現在のレポジトリはWindows MVPの主要な構造境界を完了しています：共有DTO、provider境界、Win32プロトコル适配、fallback意思決定、quick/context runner、設定と実行状態UIスケルトン。
- `native/win32-helper`は実際のWindows helperホストに接続されており、`health-check`、`capture-text`、`write-text`、`clipboard-write`の4つのコマンドを実装しています。
- 現在の最初の版本の約束は標準編集コントロールを優先的にカバーすること。`replace-selection`はまだ保守的な戦略を維持しており、選択範囲を安全に確認できない場合は明確に失敗し、貼り付け/ポップアップfallbackに切り替えします。
- fallback結果ページとコンテキスト入力ページはすでにページスケルトンを備えていますが、完全な独立ポップアップインタラクティブとIPC送り返しは実際のウィンドウフローで引く続き配線が必要です。
- 実行状態パネルはデフォルトで登録されたショートカット、現在のprovider、helper状態、最近の実行サマリーを表示し、完全な原文または訳文を保存しません。

## 現在の検証状態

- `npm test`：core use case、provider boundary、helperプロトコル、helperセッション、win32 adapter、settings service、shortcut service、quick/context runner、runtime status panelとfallback意思決定をカバー。
- `npm run typecheck`：renderer、electron、shared、core間のクロスタイプ контрактを検証。
- `dotnet test native/win32-helper/TextBridge.Win32Helper.Tests/TextBridge.Win32Helper.Tests.csproj`：helperホスト、health-check、capture、write-back、clipboard-writeの最小動作をカバー。
- `npm run build`：Vite rendererビルドとElectron TypeScriptコンパイル成果物パスを検証。
- メインプロセス診断ログはデフォルトで`app.getPath('userData')/logs/diagnostic.log`に出力。
- helper診断ログはデフォルトで`native/win32-helper/bin/Debug/net10.0-windows/logs/win32-helper.log`に出力되며、`TEXTBRIDGE_HELPER_LOG_PATH`でオーバーライド也可能。
- Windows実際のソフトウェア互換性チェックと手動検証手順は以下を参照：
  - [docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md](plans/2026-03-08-windows-text-translation-compatibility-matrix.md)
  - [docs/plans/2026-03-09-windows-helper-manual-validation.md](plans/2026-03-09-windows-helper-manual-validation.md)

詳細な設計は[docs/plans/2026-03-08-windows-text-translation-client-design.md](plans/2026-03-08-windows-text-translation-client-design.md)を参照。

現在のhelper設計と実装計画は以下を参照：

- [docs/plans/2026-03-09-windows-helper-integration-design.md](docs/plans/2026-03-09-windows-helper-integration-design.md)
- [docs/plans/2026-03-09-windows-helper-integration-implementation.md](docs/plans/2026-03-09-windows-helper-integration-implementation.md)

## 開発提案

- 新しいシステム機能は優先的にメインプロセスに配置し、`preload`を通じてReactに公開
- レンダリングプロセスで直接`nodeIntegration`を有効にしない
- `dist/`または`dist-electron/`の生成ファイルを手動で修正しない
