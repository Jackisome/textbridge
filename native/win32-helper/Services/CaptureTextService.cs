using System.Text.Json.Nodes;
using TextBridge.Win32Helper.Interop;

namespace TextBridge.Win32Helper.Services;

public sealed class CaptureTextService
{
    private static readonly HashSet<string> TransientShellWindowClasses =
    [
        "XamlExplorerHostIslandWindow",
        "MultitaskingViewFrame",
        "TaskSwitcherWnd"
    ];

    private readonly IAutomationFacade _automationFacade;
    private readonly IClipboardTextService _clipboardTextService;
    private readonly IInputSimulationService _inputSimulationService;
    private readonly IFocusedElementInspectionService? _focusedElementInspectionService;
    private readonly TimeSpan _clipboardReadDelay;
    private readonly TimeSpan _focusStabilizationTimeout;
    private readonly TimeSpan _focusStabilizationPollInterval;

    public CaptureTextService(
        IAutomationFacade automationFacade,
        IClipboardTextService clipboardTextService,
        IInputSimulationService inputSimulationService,
        TimeSpan? clipboardReadDelay = null,
        IFocusedElementInspectionService? focusedElementInspectionService = null,
        TimeSpan? focusStabilizationTimeout = null,
        TimeSpan? focusStabilizationPollInterval = null)
    {
        _automationFacade = automationFacade;
        _clipboardTextService = clipboardTextService;
        _inputSimulationService = inputSimulationService;
        _focusedElementInspectionService = focusedElementInspectionService;
        _clipboardReadDelay = clipboardReadDelay ?? TimeSpan.FromMilliseconds(120);
        _focusStabilizationTimeout = focusStabilizationTimeout ?? TimeSpan.FromMilliseconds(200);
        _focusStabilizationPollInterval = focusStabilizationPollInterval ?? TimeSpan.FromMilliseconds(20);
    }

    public async Task<CaptureTextResult> CaptureAsync(
        string method,
        CancellationToken cancellationToken = default)
    {
        if (string.Equals(method, "uia", StringComparison.OrdinalIgnoreCase))
        {
            return await CaptureFromUiAutomationAsync(cancellationToken);
        }

        if (string.Equals(method, "clipboard", StringComparison.OrdinalIgnoreCase))
        {
            return await CaptureFromClipboardAsync(cancellationToken);
        }

        return CaptureTextResult.Failure(
            method,
            "TEXT_CAPTURE_UNSUPPORTED",
            $"Unsupported capture method '{method}'.",
            new JsonObject());
    }

    private async Task<CaptureTextResult> CaptureFromUiAutomationAsync(
        CancellationToken cancellationToken)
    {
        var inputSimulationResult = _inputSimulationService.WaitForModifiersToBeReleased();
        var stabilizationDiagnostics = await WaitForStableForegroundWindowAsync(
            cancellationToken);
        var captureResult = _automationFacade.CaptureSelection();
        var diagnostics = MergeDiagnostics(
            captureResult.Diagnostics,
            stabilizationDiagnostics);

        AppendInputSimulationDiagnostics(diagnostics, inputSimulationResult);

        return captureResult with
        {
            Diagnostics = diagnostics
        };
    }

    private async Task<CaptureTextResult> CaptureFromClipboardAsync(
        CancellationToken cancellationToken)
    {
        var diagnostics = new JsonObject();
        var initialClipboardText = _clipboardTextService.ReadText();

        try
        {
            if (!string.IsNullOrWhiteSpace(initialClipboardText))
            {
                diagnostics["clipboardInitialTextLength"] = initialClipboardText.Length;
            }

            var inputSimulationResult = _inputSimulationService.SendCopyShortcut();
            diagnostics["copyShortcutSent"] = true;
            AppendInputSimulationDiagnostics(diagnostics, inputSimulationResult);

            var pollingInterval = TimeSpan.FromMilliseconds(25);
            var deadline = DateTimeOffset.UtcNow + _clipboardReadDelay;

            while (true)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var text = _clipboardTextService.ReadText();
                if (
                    !string.IsNullOrWhiteSpace(text) &&
                    !string.Equals(text, initialClipboardText, StringComparison.Ordinal))
                {
                    diagnostics["clipboardChanged"] = true;
                    diagnostics["clipboardTextLength"] = text.Length;
                    return CaptureTextResult.Success("clipboard", text, diagnostics);
                }

                if (DateTimeOffset.UtcNow >= deadline)
                {
                    break;
                }

                await Task.Delay(pollingInterval, cancellationToken);
            }

            diagnostics["clipboardChanged"] = false;
            return CaptureTextResult.Failure(
                "clipboard",
                "TEXT_CAPTURE_CLIPBOARD_FAILED",
                "Clipboard copy did not produce updated text.",
                diagnostics);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            diagnostics["exceptionType"] = ex.GetType().Name;
            return CaptureTextResult.Failure(
                "clipboard",
                "TEXT_CAPTURE_CLIPBOARD_FAILED",
                ex.Message,
                diagnostics);
        }
    }

    private static void AppendInputSimulationDiagnostics(
        JsonObject diagnostics,
        InputSimulationResult inputSimulationResult)
    {
        diagnostics["hadPressedModifiers"] = inputSimulationResult.HadPressedModifiers;
        diagnostics["modifierReleaseWaitMs"] = inputSimulationResult.ModifierReleaseWaitMs;
        diagnostics["modifierReleaseTimedOut"] = inputSimulationResult.ModifierReleaseTimedOut;
    }

    private async Task<JsonObject> WaitForStableForegroundWindowAsync(
        CancellationToken cancellationToken)
    {
        if (_focusedElementInspectionService is null)
        {
            return new JsonObject();
        }

        var currentSnapshot = _focusedElementInspectionService.InspectFocusedElement();
        var stabilizationReason = GetFocusStabilizationReason(currentSnapshot);

        if (stabilizationReason is null)
        {
            return new JsonObject();
        }

        var diagnostics = new JsonObject
        {
            ["transientShellWindowDetected"] = true,
            ["focusStabilizationReason"] = stabilizationReason
        };
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

        while (stopwatch.Elapsed < _focusStabilizationTimeout)
        {
            cancellationToken.ThrowIfCancellationRequested();
            await Task.Delay(_focusStabilizationPollInterval, cancellationToken);

            currentSnapshot = _focusedElementInspectionService.InspectFocusedElement();
            if (GetFocusStabilizationReason(currentSnapshot) is null)
            {
                diagnostics["focusStabilizationWaitMs"] = (int)stopwatch.ElapsedMilliseconds;
                diagnostics["focusStabilizationTimedOut"] = false;
                return diagnostics;
            }
        }

        diagnostics["focusStabilizationWaitMs"] = (int)stopwatch.ElapsedMilliseconds;
        diagnostics["focusStabilizationTimedOut"] = true;
        return diagnostics;
    }

    private static string? GetFocusStabilizationReason(FocusedElementSnapshot snapshot)
    {
        var processName = snapshot.Diagnostics["processName"]?.GetValue<string>();
        var windowClassName = snapshot.Diagnostics["windowClassName"]?.GetValue<string>();
        var windowTitle = snapshot.Diagnostics["windowTitle"]?.GetValue<string>();

        if (string.Equals(processName, "explorer", StringComparison.OrdinalIgnoreCase) &&
            !string.IsNullOrWhiteSpace(windowClassName) &&
            TransientShellWindowClasses.Contains(windowClassName))
        {
            return "shell-window";
        }

        if (string.Equals(processName, "electron", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(windowTitle, "TextBridge", StringComparison.Ordinal))
        {
            return "textbridge-window";
        }

        return null;
    }

    private static JsonObject MergeDiagnostics(
        JsonObject primary,
        JsonObject secondary)
    {
        var merged = primary.DeepClone() as JsonObject ?? new JsonObject();

        foreach (var pair in secondary)
        {
            if (pair.Value is not null)
            {
                merged[pair.Key] = pair.Value.DeepClone();
            }
        }

        return merged;
    }
}

public sealed record CaptureTextResult(
    bool Ok,
    string Method,
    string? Text,
    string? ErrorCode,
    string? ErrorMessage,
    JsonObject Diagnostics)
{
    public static CaptureTextResult Success(
        string method,
        string text,
        JsonObject diagnostics)
    {
        return new CaptureTextResult(
            true,
            method,
            text,
            null,
            null,
            CloneDiagnostics(diagnostics));
    }

    public static CaptureTextResult Failure(
        string method,
        string errorCode,
        string errorMessage,
        JsonObject diagnostics)
    {
        return new CaptureTextResult(
            false,
            method,
            null,
            errorCode,
            errorMessage,
            CloneDiagnostics(diagnostics));
    }

    public JsonObject ToPayload()
    {
        var payload = new JsonObject
        {
            ["method"] = Method,
            ["diagnostics"] = CloneDiagnostics(Diagnostics)
        };

        if (!string.IsNullOrEmpty(Text))
        {
            payload["text"] = Text;
        }

        return payload;
    }

    private static JsonObject CloneDiagnostics(JsonObject diagnostics)
    {
        return diagnostics.DeepClone() as JsonObject ?? new JsonObject();
    }
}
