using System.Text.Json.Nodes;
using TextBridge.Win32Helper.Interop;

namespace TextBridge.Win32Helper.Services;

public sealed class WriteTextService
{
    private readonly IClipboardTextService _clipboardTextService;
    private readonly IInputSimulationService _inputSimulationService;

    public WriteTextService(
        IClipboardTextService clipboardTextService,
        IInputSimulationService inputSimulationService)
    {
        _clipboardTextService = clipboardTextService;
        _inputSimulationService = inputSimulationService;
    }

    public Task<WriteTextResult> WriteAsync(
        string text,
        string method,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (string.Equals(method, "replace-selection", StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult(
                WriteTextResult.Failure(
                    "replace-selection",
                    "WRITE_BACK_UNSUPPORTED",
                    "Safe selection replacement is not implemented.",
                    new JsonObject
                    {
                        ["selectionVerified"] = false
                    }));
        }

        if (string.Equals(method, "paste-translation", StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult(PasteTranslation(text));
        }

        if (string.Equals(method, "clipboard-write", StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult(WriteClipboard(text));
        }

        return Task.FromResult(
            WriteTextResult.Failure(
                method,
                "WRITE_BACK_UNSUPPORTED",
                $"Unsupported write method '{method}'.",
                new JsonObject()));
    }

    private WriteTextResult PasteTranslation(string text)
    {
        var diagnostics = new JsonObject();

        try
        {
            _clipboardTextService.WriteText(text);
            diagnostics["clipboardTextLength"] = text.Length;
            _inputSimulationService.SendPasteShortcut();
            diagnostics["pasteShortcutSent"] = true;

            return WriteTextResult.Success("paste-translation", diagnostics);
        }
        catch (Exception ex)
        {
            diagnostics["exceptionType"] = ex.GetType().Name;
            return WriteTextResult.Failure(
                "paste-translation",
                "WRITE_BACK_PASTE_FAILED",
                ex.Message,
                diagnostics);
        }
    }

    private WriteTextResult WriteClipboard(string text)
    {
        var diagnostics = new JsonObject();

        try
        {
            _clipboardTextService.WriteText(text);
            diagnostics["clipboardTextLength"] = text.Length;
            return WriteTextResult.Success("clipboard-write", diagnostics);
        }
        catch (Exception ex)
        {
            diagnostics["exceptionType"] = ex.GetType().Name;
            return WriteTextResult.Failure(
                "clipboard-write",
                "CLIPBOARD_WRITE_FAILED",
                ex.Message,
                diagnostics);
        }
    }
}

public sealed record WriteTextResult(
    bool Ok,
    string Method,
    string? ErrorCode,
    string? ErrorMessage,
    JsonObject Diagnostics)
{
    public static WriteTextResult Success(string method, JsonObject diagnostics)
    {
        return new WriteTextResult(
            true,
            method,
            null,
            null,
            CloneDiagnostics(diagnostics));
    }

    public static WriteTextResult Failure(
        string method,
        string errorCode,
        string errorMessage,
        JsonObject diagnostics)
    {
        return new WriteTextResult(
            false,
            method,
            errorCode,
            errorMessage,
            CloneDiagnostics(diagnostics));
    }

    public JsonObject ToPayload()
    {
        return new JsonObject
        {
            ["method"] = Method,
            ["diagnostics"] = CloneDiagnostics(Diagnostics)
        };
    }

    private static JsonObject CloneDiagnostics(JsonObject diagnostics)
    {
        return diagnostics.DeepClone() as JsonObject ?? new JsonObject();
    }
}
