using System.Text.Json.Nodes;
using TextBridge.Win32Helper.Interop;

namespace TextBridge.Win32Helper.Services;

public sealed class WriteTextService
{
    private readonly IClipboardTextService _clipboardTextService;
    private readonly IInputSimulationService _inputSimulationService;
    private readonly IFocusedElementInspectionService? _focusedElementInspectionService;
    private readonly IFocusedElementValueWriter? _focusedElementValueWriter;
    private readonly TimeSpan _pasteVerificationTimeout;
    private readonly TimeSpan _pasteVerificationPollInterval;

    public WriteTextService(
        IClipboardTextService clipboardTextService,
        IInputSimulationService inputSimulationService,
        IFocusedElementInspectionService? focusedElementInspectionService = null,
        IFocusedElementValueWriter? focusedElementValueWriter = null,
        TimeSpan? pasteVerificationTimeout = null,
        TimeSpan? pasteVerificationPollInterval = null)
    {
        _clipboardTextService = clipboardTextService;
        _inputSimulationService = inputSimulationService;
        _focusedElementInspectionService = focusedElementInspectionService;
        _focusedElementValueWriter = focusedElementValueWriter;
        _pasteVerificationTimeout = pasteVerificationTimeout ?? TimeSpan.FromMilliseconds(250);
        _pasteVerificationPollInterval = pasteVerificationPollInterval ?? TimeSpan.FromMilliseconds(25);
    }

    public Task<WriteTextResult> WriteAsync(
        string text,
        string method,
        string? expectedSourceText = null,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (string.Equals(method, "replace-selection", StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult(
                ReplaceSelection(text, expectedSourceText));
        }

        if (string.Equals(method, "paste-translation", StringComparison.OrdinalIgnoreCase))
        {
            return PasteTranslationAsync(text, expectedSourceText, cancellationToken);
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

    private WriteTextResult ReplaceSelection(
        string text,
        string? expectedSourceText)
    {
        var diagnostics = new JsonObject();
        var targetSnapshot = InspectFocusedElement();

        AppendTargetDiagnostics(diagnostics, targetSnapshot);

        if (_focusedElementInspectionService is null || _focusedElementValueWriter is null)
        {
            diagnostics["selectionVerified"] = false;
            return WriteTextResult.Failure(
                "replace-selection",
                "WRITE_BACK_UNSUPPORTED",
                "Safe selection replacement is not implemented.",
                diagnostics);
        }

        if (!targetSnapshot.HasFocusedElement)
        {
            diagnostics["selectionVerified"] = false;
            return WriteTextResult.Failure(
                "replace-selection",
                "WRITE_BACK_TARGET_LOST",
                "No focused editable control is available for selection replacement.",
                diagnostics);
        }

        if (!targetSnapshot.IsEditable)
        {
            diagnostics["selectionVerified"] = false;
            return WriteTextResult.Failure(
                "replace-selection",
                "WRITE_BACK_UNSUPPORTED",
                "The focused control is not editable.",
                diagnostics);
        }

        if (string.IsNullOrWhiteSpace(expectedSourceText))
        {
            diagnostics["selectionVerified"] = false;
            return WriteTextResult.Failure(
                "replace-selection",
                "WRITE_BACK_UNSUPPORTED",
                "Expected source text is required for safe selection replacement.",
                diagnostics);
        }

        diagnostics["expectedSourceTextLength"] = expectedSourceText.Length;
        diagnostics["textComparisonMode"] = "line-ending-normalized";

        var selectionMatchedExpected = TextEqualsForVerification(
            targetSnapshot.SelectedText,
            expectedSourceText);
        diagnostics["selectionMatchedExpected"] = selectionMatchedExpected;

        if (!selectionMatchedExpected)
        {
            diagnostics["selectionVerified"] = false;
            return WriteTextResult.Failure(
                "replace-selection",
                "WRITE_BACK_TARGET_MISMATCH",
                "The focused selection no longer matches the captured source text.",
                diagnostics);
        }

        if (
            targetSnapshot.ValueText is null ||
            targetSnapshot.SelectionPrefixText is null ||
            targetSnapshot.SelectionSuffixText is null)
        {
            diagnostics["selectionVerified"] = false;
            return WriteTextResult.Failure(
                "replace-selection",
                "WRITE_BACK_UNSUPPORTED",
                "The focused control does not expose enough text context for safe selection replacement.",
                diagnostics);
        }

        diagnostics["selectionPrefixTextLength"] = targetSnapshot.SelectionPrefixText.Length;
        diagnostics["selectionSuffixTextLength"] = targetSnapshot.SelectionSuffixText.Length;

        var reconstructedValue =
            targetSnapshot.SelectionPrefixText +
            targetSnapshot.SelectedText +
            targetSnapshot.SelectionSuffixText;
        var selectionVerified = TextEqualsForVerification(
            targetSnapshot.ValueText,
            reconstructedValue);
        diagnostics["selectionVerified"] = selectionVerified;

        if (!selectionVerified)
        {
            return WriteTextResult.Failure(
                "replace-selection",
                "WRITE_BACK_UNSUPPORTED",
                "The current selection cannot be safely mapped to the focused control value.",
                diagnostics);
        }

        var replacementValue =
            targetSnapshot.SelectionPrefixText +
            text +
            targetSnapshot.SelectionSuffixText;

        try
        {
            _focusedElementValueWriter.SetFocusedValue(
                replacementValue,
                targetSnapshot.RuntimeId);
            diagnostics["replacementValueLength"] = replacementValue.Length;
        }
        catch (Exception ex)
        {
            diagnostics["exceptionType"] = ex.GetType().Name;
            return WriteTextResult.Failure(
                "replace-selection",
                "WRITE_BACK_REPLACE_FAILED",
                ex.Message,
                diagnostics);
        }

        var afterSnapshot = InspectFocusedElement();
        diagnostics["verificationMethod"] = "value-pattern";
        diagnostics["targetStable"] = IsSameTarget(targetSnapshot, afterSnapshot);
        diagnostics["valueChanged"] = TextChangedForVerification(
            targetSnapshot.ValueText,
            afterSnapshot.ValueText);
        diagnostics["translatedTextDetected"] = TextEqualsForVerification(
            afterSnapshot.ValueText,
            replacementValue);

        return
            GetBoolean(diagnostics, "targetStable") == true &&
            GetBoolean(diagnostics, "valueChanged") == true &&
            GetBoolean(diagnostics, "translatedTextDetected") == true
                ? WriteTextResult.Success("replace-selection", diagnostics)
                : WriteTextResult.Failure(
                    "replace-selection",
                    "WRITE_BACK_REPLACE_FAILED",
                    "Selection replacement did not update the focused control as expected.",
                    diagnostics);
    }

    private async Task<WriteTextResult> PasteTranslationAsync(
        string text,
        string? expectedSourceText,
        CancellationToken cancellationToken)
    {
        var diagnostics = new JsonObject();
        var targetSnapshot = InspectFocusedElement();

        AppendTargetDiagnostics(diagnostics, targetSnapshot);

        if (_focusedElementInspectionService is null)
        {
            return WriteTextResult.Failure(
                "paste-translation",
                "WRITE_BACK_TARGET_UNVERIFIED",
                "Focused element inspection is unavailable for verified paste write-back.",
                diagnostics);
        }

        if (!targetSnapshot.HasFocusedElement)
        {
            return WriteTextResult.Failure(
                "paste-translation",
                "WRITE_BACK_TARGET_UNVERIFIED",
                "No focused editable control is available for paste write-back.",
                diagnostics);
        }

        if (!targetSnapshot.IsEditable)
        {
            return WriteTextResult.Failure(
                "paste-translation",
                "WRITE_BACK_TARGET_UNVERIFIED",
                "The focused control is not editable.",
                diagnostics);
        }

        if (string.IsNullOrWhiteSpace(expectedSourceText))
        {
            return WriteTextResult.Failure(
                "paste-translation",
                "WRITE_BACK_TARGET_UNVERIFIED",
                "Expected source text is required for verified paste write-back.",
                diagnostics);
        }

        diagnostics["expectedSourceTextLength"] = expectedSourceText.Length;
        diagnostics["textComparisonMode"] = "line-ending-normalized";

        var selectionMatchedExpected = TextEqualsForVerification(
            targetSnapshot.SelectedText,
            expectedSourceText);
        diagnostics["selectionMatchedExpected"] = selectionMatchedExpected;

        if (!selectionMatchedExpected)
        {
            return WriteTextResult.Failure(
                "paste-translation",
                "WRITE_BACK_TARGET_MISMATCH",
                "The focused selection no longer matches the captured source text.",
                diagnostics);
        }

        try
        {
            _clipboardTextService.WriteText(text);
            diagnostics["clipboardTextLength"] = text.Length;
            var inputSimulationResult = _inputSimulationService.SendPasteShortcut();
            diagnostics["pasteShortcutSent"] = true;
            diagnostics["hadPressedModifiers"] = inputSimulationResult.HadPressedModifiers;
            diagnostics["modifierReleaseWaitMs"] = inputSimulationResult.ModifierReleaseWaitMs;
            diagnostics["modifierReleaseTimedOut"] = inputSimulationResult.ModifierReleaseTimedOut;

            var verificationResult = await VerifyPasteAppliedAsync(
                targetSnapshot,
                text,
                diagnostics,
                cancellationToken);

            return verificationResult
                ? WriteTextResult.Success("paste-translation", diagnostics)
                : WriteTextResult.Failure(
                    "paste-translation",
                    "WRITE_BACK_VERIFICATION_FAILED",
                    "Paste shortcut did not update the focused control.",
                    diagnostics);
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

    private async Task<bool> VerifyPasteAppliedAsync(
        FocusedElementSnapshot beforeSnapshot,
        string translatedText,
        JsonObject diagnostics,
        CancellationToken cancellationToken)
    {
        var deadline = DateTimeOffset.UtcNow + _pasteVerificationTimeout;
        var attempts = 0;

        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            attempts += 1;

            var afterSnapshot = InspectFocusedElement();
            diagnostics["verificationAttempts"] = attempts;
            diagnostics["verificationMethod"] = "value-pattern";
            diagnostics["translatedTextDetected"] = ContainsTextForVerification(
                afterSnapshot.ValueText,
                translatedText);
            diagnostics["valueChanged"] = TextChangedForVerification(
                beforeSnapshot.ValueText,
                afterSnapshot.ValueText);
            diagnostics["targetStable"] = IsSameTarget(beforeSnapshot, afterSnapshot);

            if (afterSnapshot.ValueText is not null)
            {
                diagnostics["postValueTextLength"] = afterSnapshot.ValueText.Length;
            }

            if (
                GetBoolean(diagnostics, "targetStable") == true &&
                GetBoolean(diagnostics, "valueChanged") == true &&
                GetBoolean(diagnostics, "translatedTextDetected") == true)
            {
                return true;
            }

            if (DateTimeOffset.UtcNow >= deadline)
            {
                diagnostics["verificationTimedOut"] = true;
                return false;
            }

            await Task.Delay(_pasteVerificationPollInterval, cancellationToken);
        }
    }

    private FocusedElementSnapshot InspectFocusedElement()
    {
        if (_focusedElementInspectionService is null)
        {
            return new FocusedElementSnapshot(
                HasFocusedElement: false,
                IsEditable: false,
                RuntimeId: null,
                SelectedText: null,
                ValueText: null,
                SelectionPrefixText: null,
                SelectionSuffixText: null,
                Diagnostics: new JsonObject());
        }

        return _focusedElementInspectionService.InspectFocusedElement();
    }

    private static void AppendTargetDiagnostics(
        JsonObject diagnostics,
        FocusedElementSnapshot snapshot)
    {
        CopyDiagnosticValue(snapshot.Diagnostics, diagnostics, "processName");
        CopyDiagnosticValue(snapshot.Diagnostics, diagnostics, "windowClassName");
        CopyDiagnosticValue(snapshot.Diagnostics, diagnostics, "windowTitle");
        CopyDiagnosticValue(snapshot.Diagnostics, diagnostics, "controlType");
        CopyDiagnosticValue(snapshot.Diagnostics, diagnostics, "framework");
        CopyDiagnosticValue(snapshot.Diagnostics, diagnostics, "runtimeId");
        CopyDiagnosticValue(snapshot.Diagnostics, diagnostics, "selectionDetected");
        CopyDiagnosticValue(snapshot.Diagnostics, diagnostics, "selectedTextLength");
        CopyDiagnosticValue(snapshot.Diagnostics, diagnostics, "valuePatternAvailable");
        CopyDiagnosticValue(snapshot.Diagnostics, diagnostics, "valueTextLength");
        diagnostics["editable"] = snapshot.IsEditable;
    }

    private static void CopyDiagnosticValue(
        JsonObject source,
        JsonObject destination,
        string key)
    {
        var value = source[key];
        if (value is not null)
        {
            destination[key] = value.DeepClone();
        }
    }

    private static bool ContainsTextForVerification(string? value, string text)
    {
        var normalizedValue = NormalizeForComparison(value);
        var normalizedText = NormalizeForComparison(text);

        return !string.IsNullOrEmpty(normalizedValue) &&
            !string.IsNullOrEmpty(normalizedText) &&
            normalizedValue.Contains(normalizedText, StringComparison.Ordinal);
    }

    private static bool TextEqualsForVerification(string? left, string? right)
    {
        return string.Equals(
            NormalizeForComparison(left),
            NormalizeForComparison(right),
            StringComparison.Ordinal);
    }

    private static bool TextChangedForVerification(string? before, string? after)
    {
        var normalizedBefore = NormalizeForComparison(before);
        var normalizedAfter = NormalizeForComparison(after);

        return normalizedBefore is not null &&
            normalizedAfter is not null &&
            !string.Equals(normalizedBefore, normalizedAfter, StringComparison.Ordinal);
    }

    private static string? NormalizeForComparison(string? value)
    {
        return value?
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace("\r", "\n", StringComparison.Ordinal);
    }

    private static bool IsSameTarget(
        FocusedElementSnapshot beforeSnapshot,
        FocusedElementSnapshot afterSnapshot)
    {
        if (!beforeSnapshot.HasFocusedElement || !afterSnapshot.HasFocusedElement)
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(beforeSnapshot.RuntimeId) &&
            !string.IsNullOrWhiteSpace(afterSnapshot.RuntimeId))
        {
            return string.Equals(
                beforeSnapshot.RuntimeId,
                afterSnapshot.RuntimeId,
                StringComparison.Ordinal);
        }

        return string.Equals(
                GetString(beforeSnapshot.Diagnostics, "processName"),
                GetString(afterSnapshot.Diagnostics, "processName"),
                StringComparison.OrdinalIgnoreCase) &&
            string.Equals(
                GetString(beforeSnapshot.Diagnostics, "windowClassName"),
                GetString(afterSnapshot.Diagnostics, "windowClassName"),
                StringComparison.Ordinal) &&
            string.Equals(
                GetString(beforeSnapshot.Diagnostics, "controlType"),
                GetString(afterSnapshot.Diagnostics, "controlType"),
                StringComparison.Ordinal) &&
            string.Equals(
                GetString(beforeSnapshot.Diagnostics, "framework"),
                GetString(afterSnapshot.Diagnostics, "framework"),
                StringComparison.Ordinal);
    }

    private static string? GetString(JsonObject diagnostics, string key)
    {
        return diagnostics[key]?.GetValue<string>();
    }

    private static bool? GetBoolean(JsonObject diagnostics, string key)
    {
        return diagnostics[key]?.GetValue<bool>();
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
