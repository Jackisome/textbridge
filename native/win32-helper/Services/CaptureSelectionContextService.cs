using System.Text.Json.Nodes;
using TextBridge.Win32Helper.Interop;

namespace TextBridge.Win32Helper.Services;

public sealed class CaptureSelectionContextService
{
    private readonly ISelectionContextAutomationFacade _automationFacade;
    private readonly CaptureTextService? _captureTextService;

    public CaptureSelectionContextService(
        ISelectionContextAutomationFacade automationFacade,
        CaptureTextService? captureTextService = null)
    {
        _automationFacade = automationFacade;
        _captureTextService = captureTextService;
    }

    public async Task<SelectionContextCaptureResult> CaptureAsync(
        string method,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (string.Equals(method, "clipboard", StringComparison.OrdinalIgnoreCase))
        {
            if (_captureTextService is null)
            {
                return SelectionContextCaptureResult.Failure(
                    method,
                    "TEXT_CAPTURE_UNSUPPORTED",
                    "Clipboard selection-context capture is unavailable.",
                    new JsonObject());
            }

            var captureResult = await _captureTextService.CaptureAsync(
                "clipboard",
                cancellationToken);

            return captureResult.Ok
                ? SelectionContextCaptureResult.Success(
                    "clipboard",
                    captureResult.Text ?? string.Empty,
                    new PromptAnchorSnapshot("unknown"),
                    restoreTargetToken: null,
                    SelectionContextCapabilitiesSnapshot.None,
                    captureResult.Diagnostics)
                : SelectionContextCaptureResult.Failure(
                    "clipboard",
                    captureResult.ErrorCode ?? "TEXT_CAPTURE_CLIPBOARD_FAILED",
                    captureResult.ErrorMessage ?? "Clipboard copy did not produce updated text.",
                    captureResult.Diagnostics);
        }

        if (!string.Equals(method, "uia", StringComparison.OrdinalIgnoreCase))
        {
            return SelectionContextCaptureResult.Failure(
                method,
                "TEXT_CAPTURE_UNSUPPORTED",
                $"Unsupported selection-context capture method '{method}'.",
                new JsonObject());
        }

        return await Task.FromResult(_automationFacade.CaptureSelectionContext());
    }
}

public sealed record SelectionContextCaptureResult(
    bool Ok,
    string Method,
    string? Text,
    PromptAnchorSnapshot Anchor,
    string? RestoreTargetToken,
    SelectionContextCapabilitiesSnapshot Capabilities,
    string? ErrorCode,
    string? ErrorMessage,
    JsonObject Diagnostics)
{
    public static SelectionContextCaptureResult Success(
        string method,
        string text,
        PromptAnchorSnapshot anchor,
        string? restoreTargetToken,
        SelectionContextCapabilitiesSnapshot capabilities,
        JsonObject diagnostics)
    {
        return new SelectionContextCaptureResult(
            true,
            method,
            text,
            anchor,
            restoreTargetToken,
            capabilities,
            null,
            null,
            CloneDiagnostics(diagnostics));
    }

    public static SelectionContextCaptureResult Failure(
        string method,
        string errorCode,
        string errorMessage,
        JsonObject diagnostics)
    {
        return new SelectionContextCaptureResult(
            false,
            method,
            null,
            new PromptAnchorSnapshot("unknown"),
            null,
            SelectionContextCapabilitiesSnapshot.None,
            errorCode,
            errorMessage,
            CloneDiagnostics(diagnostics));
    }

    public JsonObject ToPayload()
    {
        var payload = new JsonObject
        {
            ["method"] = Method,
            ["anchor"] = Anchor.ToPayload(),
            ["capabilities"] = Capabilities.ToPayload(),
            ["diagnostics"] = CloneDiagnostics(Diagnostics)
        };

        if (!string.IsNullOrWhiteSpace(Text))
        {
            payload["text"] = Text;
        }

        if (!string.IsNullOrWhiteSpace(RestoreTargetToken))
        {
            payload["restoreTarget"] = new JsonObject
            {
                ["token"] = RestoreTargetToken
            };
        }

        return payload;
    }

    private static JsonObject CloneDiagnostics(JsonObject diagnostics)
    {
        return diagnostics.DeepClone() as JsonObject ?? new JsonObject();
    }
}
