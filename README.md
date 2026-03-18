# TextBridge

<p align="center">
  [English]
  [<a href="docs/README.zh-CN.md">简体中文</a>]
  [<a href="docs/README.ja-JP.md">日本語</a>]
</p>

`TextBridge` is a multi-platform text translation client project. The first version targets Windows system-level text translation as its initial implementation direction, aiming to complete the closed loop of "get text -> translate -> write back / fallback display" in standard text controls. The repository is built on `Electron + Vite + React + TypeScript` and has been organized into a desktop application layered structure suitable for long-term expansion.

## Current Development Components

### Runtime and Desktop Layer

- `Electron`: Desktop application container, window lifecycle, and native capability entry point
- `Preload + ContextBridge`: Safely expose capabilities with `contextIsolation` enabled

### Frontend Layer

- `React`: Rendering process UI component development
- `React DOM`: Mount React application to Electron page
- `Vite`: Rendering layer dev server, HMR, and frontend build
- `TypeScript`: Unified type system for main process, preload, and rendering layer
- `Vitest`: Unit testing

### Translation Providers

Multi-Provider access is supported, with unified interface defined in `src/shared/types/provider.ts`:

- `MiniMax` (native implementation, with complete error handling)
- `Claude` (Anthropic)
- `Gemini` (Google)
- `DeepSeek`
- `Tongyi` (Alibaba Cloud)
- `Tencent` (Tencent Cloud)
- `Google` (Google Cloud Translation)
- `OpenAI-Compatible` (third-party models compatible with OpenAI interface)
- `Custom` (user-defined endpoint)

Provider configurations are uniformly managed by `src/electron/services/providers/`, and `src/shared/constants/provider-metadata.ts` defines metadata for each Provider.

### Development Utilities

- `concurrently`: Parallel startup of Vite, Electron TypeScript watch, and Electron process
- `nodemon`: Monitor `dist-electron/` changes and automatically restart Electron
- `wait-on`: Wait for Vite service and Electron compilation output to be ready
- `cross-env`: Inject cross-platform environment variables for Electron development process

## Environment Dependencies

- `Node.js + npm`: For rendering layer, main process, and test commands
- `.NET SDK 10.x`: For building, running, and testing `native/win32-helper`

It is recommended to first verify that the following commands are available:

```powershell
dotnet --info
npm --version
```

If `dotnet` is not in `PATH` in the development environment, you can specify the actual path via environment variable:

```powershell
$env:TEXTBRIDGE_DOTNET_PATH="C:\Program Files\dotnet\dotnet.exe"
```

## How to Run

### Development Mode

```powershell
npm run dev
```

Development mode does the following:

- Start `Vite` dev server at fixed address `http://127.0.0.1:5173`
- Monitor `src/electron/**/*.ts` and continuously compile to `dist-electron/`
- Automatically restart the client when Electron main process or preload output changes
- React rendering layer changes go through Vite HMR, no need to restart the entire Electron

### Build Production Assets

```powershell
npm run build
```

This command will:

- Build React + Vite to `dist/`
- Compile Electron main process and preload scripts to `dist-electron/`

### Run Build Locally

```powershell
npm start
```

This command first executes a full build, then starts Electron.

### Type Check

```powershell
npm run typecheck
```

### Windows Helper Standalone Validation

```powershell
npm run helper:build
npm run helper:test
```

The current Windows helper is located at `native/win32-helper/`, with directory structure:

- `Services/`: Business service implementations (`HealthCheckService`, `CaptureTextService`, `WriteTextService`)
- `Protocols/`: Protocol request/response models
- `Interop/`: Windows API interop wrappers (UI Automation, Clipboard, Input Simulation)

In development mode, the Electron main process lazily starts via `dotnet run --project native/win32-helper/TextBridge.Win32Helper.csproj`. If `dotnet` is not in the current terminal's `PATH`, the main process will try in order:

- `TEXTBRIDGE_DOTNET_PATH`
- `DOTNET_ROOT/dotnet.exe`
- `C:/Program Files/dotnet/dotnet.exe`

Protocol commands currently connected:

- `health-check`: Returns helper capability list
- `capture-text`: Text capture, supports `uia` (UI Automation) and `clipboard` two modes
- `write-text`: Text write-back
- `clipboard-write`: Clipboard write

For detailed manual validation steps, see:

- [docs/plans/2026-03-09-windows-helper-manual-validation.md](docs/plans/2026-03-09-windows-helper-manual-validation.md)
- [docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md](docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md)

## Directory Structure

- `src/electron/main.ts`: Electron main process entry
- `src/electron/preload.ts`: Preload script
- `src/electron/ipc/`: IPC channel definitions and handler registration
- `src/electron/services/`: Main process service layer (translation execution, shortcuts, system tray, window management)
- `src/electron/services/providers/`: Translation provider implementations (MiniMax, Claude, Gemini, etc.)
- `src/electron/platform/win32/`: Windows platform adaptation (Win32 protocol, helper session)
- `src/renderer/app/main.tsx`: React rendering entry
- `src/renderer/app/App.tsx`: React page component
- `src/renderer/features/runtime-status/`: Runtime status panel
- `src/renderer/pages/`: Page-level views (settings page, fallback result page, context popup page)
- `src/core/`: Pure business layer (use cases, entities, contracts)
- `src/shared/`: Cross-process shared types and constants
- `vite.config.ts`: Vite configuration
- `tsconfig.json`: React / Vite TypeScript configuration
- `tsconfig.electron.json`: Electron main process TypeScript configuration
- `index.html`: Vite and Electron shared entry page
- `dist/`: Vite frontend build output
- `dist-electron/`: Electron TypeScript compilation output
- `native/win32-helper/`: Windows native helper (.NET 10.x)

## Product Positioning

- Multi-platform expansion oriented, currently focused on desktop client, first version prioritizes Windows
- Resides in system tray, triggers quick translation or context-enhanced translation via global shortcuts
- Text acquisition prioritizes `UI Automation`, falls back to clipboard collaboration on failure
- Write-back prioritizes replacing or inserting into the original control, falls back to popup display and copy result on failure
- Platform differences are uniformly converged to `src/electron/platform/`, current implementation is concentrated in `src/electron/platform/win32/`

## Remaining Work

### 1. Windows Text Translation Capability Expansion (Highest Priority)

**Plan**: [docs/plans/2026-03-19-windows-text-translation-expansion-plan.md](docs/plans/2026-03-19-windows-text-translation-expansion-plan.md)

**Goal**: Expand Windows text translation capability without breaking current standard control success path, and explicitly layer the handling strategy for "standard editable controls" vs "terminal/IDE/complex rendering targets".

| # | Task | Status |
|---|------|--------|
| 1 | Solidify target classification and strategy boundaries - add `targetFamily`/`fallbackOnly` in `AutomationFacade`, fast-fail Tier C targets in `WriteTextService` | Pending |
| 2 | Complete safe replacement for standard Win32/WPF text controls - RichEdit/WPF TextBox `TextPattern` selection replacement | Pending |
| 3 | Surface helper target strategy to platform logs and execution reports - extend `StdIoHost` diagnostics with `targetFamily`/`fallbackOnly` | Pending |
| 4 | Maintain business layer fallback semantics - `fallbackOnly=true` targets go directly to popup, no more invalid write-back retries | Pending |
| 5 | Execute manual validation per matrix and document evidence - validate Tier A/B/C targets and update `compatibility-matrix.md` | Pending |

**Recommended execution order**: Task 1 → Task 3 → Task 4 → Task 2 → Task 5

### 2. Translation Provider Refactor

**Plan**: [docs/plans/2026-03-08-provider-refactor-implementation.md](docs/plans/2026-03-08-provider-refactor-implementation.md)

**Goal**: Refactor translation provider architecture, settings model, and settings page to support claude, deepseek, minimax, gemini, google, tencent, tongyi, custom, mock with unified boundary.

| # | Task | Status |
|---|------|--------|
| 1 | Rebuild provider shared types and default settings - `ProviderId` type, `providers` config structure | Pending Review |
| 2 | Rewrite settings persistence and normalization logic | Pending |
| 3 | Implement HTTP adapters for each provider | Pending |
| 4 | Refactor settings page UI | Pending |

### 3. Manual Validation and Documentation

| Target | Description | Status |
|--------|-------------|--------|
| Windows Settings Search Box | Manual validation of Tier A target | Pending |
| WPF TextBox | Manual validation of Tier A target | Pending |
| Win32 RichEdit20W/50W | Manual validation of Tier A target | Pending |
| VS Code / Terminal samples | Confirm Tier C fallback-only behavior | Pending |
| Compatibility Matrix | Update based on validation results | Pending |

### 4. Completed Items (Reference)

- ✅ Windows MVP core structure (Tasks 1-11 of 2026-03-08 implementation)
- ✅ Windows Helper integration (Tasks 1-8 of 2026-03-09 helper integration)
- ✅ Multi-language README support (English, Simplified Chinese, Japanese)
- ✅ MiniMax Provider native implementation

---

## MVP Boundaries

- The repository has completed the main structural boundaries of Windows MVP: shared DTOs, provider boundaries, Win32 protocol adaptation, fallback decisions, quick/context runner, and settings and runtime status UI skeletons.
- `native/win32-helper` has been connected to a real Windows helper host, implementing `health-check`, `capture-text`, `write-text`, and `clipboard-write` four types of commands.
- The current first version commitment prioritizes covering standard editable controls; `replace-selection` still maintains a conservative strategy, explicitly failing when the selection cannot be safely confirmed and switching to paste/popup fallback.
- Fallback result page and context input page already have page skeletons, but complete independent popup interaction and IPC callback still need to be wired in the real window flow.
- Runtime status panel displays registered shortcuts, current provider, helper status, and recent execution summary by default, without saving complete source or translated text.

## Current Verification Status

- `npm test`: Covers core use case, provider boundary, helper protocol, helper session, win32 adapter, settings service, shortcut service, quick/context runner, runtime status panel, and fallback decisions.
- `npm run typecheck`: Verifies cross-layer type contracts between renderer, electron, shared, and core.
- `dotnet test native/win32-helper/TextBridge.Win32Helper.Tests/TextBridge.Win32Helper.Tests.csproj`: Covers minimum behavior of helper host, health-check, capture, write-back, and clipboard-write.
- `npm run build`: Verifies Vite renderer build and Electron TypeScript compilation output paths.
- Main process diagnostic logs are output to `app.getPath('userData')/logs/diagnostic.log` by default.
- Helper diagnostic logs are output to `native/win32-helper/bin/Debug/net10.0-windows/logs/win32-helper.log` by default, and can also be overridden via `TEXTBRIDGE_HELPER_LOG_PATH`.
- For Windows real software compatibility checks and manual validation steps, see:
  - [docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md](docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md)
  - [docs/plans/2026-03-09-windows-helper-manual-validation.md](docs/plans/2026-03-09-windows-helper-manual-validation.md)

For detailed design, see [docs/plans/2026-03-08-windows-text-translation-client-design.md](docs/plans/2026-03-08-windows-text-translation-client-design.md).

For current helper design and implementation plans, see:

- [docs/plans/2026-03-09-windows-helper-integration-design.md](docs/plans/2026-03-09-windows-helper-integration-design.md)
- [docs/plans/2026-03-09-windows-helper-integration-implementation.md](docs/plans/2026-03-09-windows-helper-integration-implementation.md)

## Development Suggestions

- New system capabilities are preferentially placed in the main process, then exposed to React through `preload`
- Do not enable `nodeIntegration` directly in the rendering process
- Do not manually modify generated files in `dist/` or `dist-electron/`
