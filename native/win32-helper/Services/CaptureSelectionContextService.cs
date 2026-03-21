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

            if (!captureResult.Ok)
            {
                return SelectionContextCaptureResult.Failure(
                    "clipboard",
                    captureResult.ErrorCode ?? "TEXT_CAPTURE_CLIPBOARD_FAILED",
                    captureResult.ErrorMessage ?? "Clipboard copy did not produce updated text.",
                    captureResult.Diagnostics);
            }

            var metadata = _automationFacade.CapturePromptMetadataSnapshot();
            var diagnostics = captureResult.Diagnostics.DeepClone() as JsonObject ?? new JsonObject();

            // Derive anchor and restore target from the metadata snapshot
            var anchor = DeriveAnchorFromMetadata(metadata);
            var restoreTargetToken = metadata.ForegroundWindowHandle != IntPtr.Zero
                ? $"hwnd:{metadata.ForegroundWindowHandle.ToInt64()}"
                : null;
            var capabilities = new SelectionContextCapabilitiesSnapshot(
                CanPositionPromptNearSelection:
                    anchor.Kind is "cursor" or "control-rect" or "window-rect" or "selection-rect",
                CanRestoreTargetAfterPrompt: !string.IsNullOrWhiteSpace(restoreTargetToken),
                CanAutoWriteBackAfterPrompt: false);

            diagnostics["anchorKind"] = anchor.Kind;
            diagnostics["metadataSource"] = "prompt-metadata-snapshot";
            if (anchor.Bounds is not null)
            {
                diagnostics["anchorBounds"] = new JsonObject
                {
                    ["x"] = anchor.Bounds.X,
                    ["y"] = anchor.Bounds.Y,
                    ["width"] = anchor.Bounds.Width,
                    ["height"] = anchor.Bounds.Height
                };
            }

            return SelectionContextCaptureResult.Success(
                "clipboard",
                captureResult.Text ?? string.Empty,
                anchor,
                restoreTargetToken,
                capabilities,
                diagnostics);
        }

        if (!string.Equals(method, "uia", StringComparison.OrdinalIgnoreCase))
        {
            return SelectionContextCaptureResult.Failure(
                method,
                "TEXT_CAPTURE_UNSUPPORTED",
                $"Unsupported selection-context capture method '{method}'.",
                new JsonObject());
        }

        return await Task.FromResult(
            NormalizeUiAutomationCaptureResult(_automationFacade.CaptureSelectionContext()));
    }

    private static PromptAnchorSnapshot DeriveAnchorFromMetadata(PromptMetadataSnapshot metadata)
    {
        // Prefer cursor position when available
        if (metadata.CursorPoint.X != 0 || metadata.CursorPoint.Y != 0)
        {
            return new PromptAnchorSnapshot("cursor");
        }

        // Fall back to foreground window bounds
        if (metadata.ForegroundWindowBounds is (var bx, var by, var bw, var bh))
        {
            return new PromptAnchorSnapshot(
                "window-rect",
                bx,
                by,
                bw,
                bh);
        }

        return new PromptAnchorSnapshot("unknown");
    }

    private static SelectionContextCaptureResult NormalizeUiAutomationCaptureResult(
        SelectionContextCaptureResult result)
    {
        if (!result.Ok ||
            !string.Equals(result.Method, "uia", StringComparison.OrdinalIgnoreCase))
        {
            return result;
        }

        var canAutoWriteBackAfterPrompt =
            result.Capabilities.CanAutoWriteBackAfterPrompt ||
            ShouldAllowAutoWriteBackAfterPrompt(result);

        if (canAutoWriteBackAfterPrompt == result.Capabilities.CanAutoWriteBackAfterPrompt)
        {
            return result;
        }

        return SelectionContextCaptureResult.Success(
            result.Method,
            result.Text ?? string.Empty,
            result.Anchor,
            result.RestoreTargetToken,
            result.Capabilities with
            {
                CanAutoWriteBackAfterPrompt = canAutoWriteBackAfterPrompt
            },
            result.Diagnostics);
    }

    private static bool ShouldAllowAutoWriteBackAfterPrompt(
        SelectionContextCaptureResult result)
    {
        if (!result.Capabilities.CanRestoreTargetAfterPrompt ||
            string.IsNullOrWhiteSpace(result.RestoreTargetToken))
        {
            return false;
        }

        if (result.Anchor.Kind is not "selection-rect" and not "control-rect")
        {
            return false;
        }

        return !IsKnownFallbackOnlyPromptTarget(result.Diagnostics);
    }

    private static bool IsKnownFallbackOnlyPromptTarget(JsonObject diagnostics)
    {
        var elementClassName = GetString(diagnostics, "elementClassName");
        if (string.Equals(elementClassName, "OmniboxViewViews", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var automationId = GetString(diagnostics, "automationId");
        return string.Equals(automationId, "view_1012", StringComparison.OrdinalIgnoreCase);
    }

    private static string? GetString(JsonObject diagnostics, string key)
    {
        try
        {
            return diagnostics[key]?.GetValue<string>();
        }
        catch
        {
            return null;
        }
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
