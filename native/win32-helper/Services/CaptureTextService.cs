using System.Text.Json.Nodes;
using TextBridge.Win32Helper.Interop;

namespace TextBridge.Win32Helper.Services;

public sealed class CaptureTextService
{
    private readonly IAutomationFacade _automationFacade;
    private readonly IClipboardTextService _clipboardTextService;
    private readonly IInputSimulationService _inputSimulationService;
    private readonly TimeSpan _clipboardReadDelay;

    public CaptureTextService(
        IAutomationFacade automationFacade,
        IClipboardTextService clipboardTextService,
        IInputSimulationService inputSimulationService,
        TimeSpan? clipboardReadDelay = null)
    {
        _automationFacade = automationFacade;
        _clipboardTextService = clipboardTextService;
        _inputSimulationService = inputSimulationService;
        _clipboardReadDelay = clipboardReadDelay ?? TimeSpan.FromMilliseconds(120);
    }

    public async Task<CaptureTextResult> CaptureAsync(
        string method,
        CancellationToken cancellationToken = default)
    {
        if (string.Equals(method, "uia", StringComparison.OrdinalIgnoreCase))
        {
            return _automationFacade.CaptureSelection();
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

            _inputSimulationService.SendCopyShortcut();
            diagnostics["copyShortcutSent"] = true;

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
