using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json.Nodes;
using System.Windows.Automation;
using System.Windows.Automation.Text;
using TextBridge.Win32Helper.Services;

namespace TextBridge.Win32Helper.Interop;

public interface IAutomationFacade
{
    CaptureTextResult CaptureSelection();
}

public interface ISelectionContextAutomationFacade
{
    SelectionContextCaptureResult CaptureSelectionContext();
}

public interface IFocusedElementInspectionService
{
    FocusedElementSnapshot InspectFocusedElement();
}

public interface IFocusedElementValueWriter
{
    void SetFocusedValue(string value, string? expectedRuntimeId = null);
}

public interface IRestoreTargetAutomationFacade
{
    RestoreTargetResult RestoreTarget(string token);
}

public sealed record PromptAnchorBoundsSnapshot(
    int X,
    int Y,
    int Width,
    int Height);

public sealed record PromptAnchorSnapshot(
    string Kind,
    int? X = null,
    int? Y = null,
    int? Width = null,
    int? Height = null,
    string? DisplayId = null)
{
    public PromptAnchorBoundsSnapshot? Bounds =>
        X.HasValue &&
        Y.HasValue &&
        Width.HasValue &&
        Height.HasValue
            ? new PromptAnchorBoundsSnapshot(
                X.Value,
                Y.Value,
                Width.Value,
                Height.Value)
            : null;

    public JsonObject ToPayload()
    {
        var payload = new JsonObject
        {
            ["kind"] = Kind
        };

        if (Bounds is not null)
        {
            payload["bounds"] = new JsonObject
            {
                ["x"] = Bounds.X,
                ["y"] = Bounds.Y,
                ["width"] = Bounds.Width,
                ["height"] = Bounds.Height
            };
        }

        if (!string.IsNullOrWhiteSpace(DisplayId))
        {
            payload["displayId"] = DisplayId;
        }

        return payload;
    }
}

public sealed record SelectionContextCapabilitiesSnapshot(
    bool CanPositionPromptNearSelection,
    bool CanRestoreTargetAfterPrompt,
    bool CanAutoWriteBackAfterPrompt)
{
    public static SelectionContextCapabilitiesSnapshot Full =>
        new(
            CanPositionPromptNearSelection: true,
            CanRestoreTargetAfterPrompt: true,
            CanAutoWriteBackAfterPrompt: true);

    public static SelectionContextCapabilitiesSnapshot None =>
        new(
            CanPositionPromptNearSelection: false,
            CanRestoreTargetAfterPrompt: false,
            CanAutoWriteBackAfterPrompt: false);

    public JsonObject ToPayload()
    {
        return new JsonObject
        {
            ["canPositionPromptNearSelection"] = CanPositionPromptNearSelection,
            ["canRestoreTargetAfterPrompt"] = CanRestoreTargetAfterPrompt,
            ["canAutoWriteBackAfterPrompt"] = CanAutoWriteBackAfterPrompt
        };
    }
}

public sealed record FocusedElementSnapshot(
    bool HasFocusedElement,
    bool IsEditable,
    string? RuntimeId,
    string? SelectedText,
    string? ValueText,
    string? SelectionPrefixText,
    string? SelectionSuffixText,
    JsonObject Diagnostics);

public sealed class AutomationFacade :
    IAutomationFacade,
    ISelectionContextAutomationFacade,
    IFocusedElementInspectionService,
    IFocusedElementValueWriter,
    IRestoreTargetAutomationFacade
{
    private const uint EmGetSel = 0x00B0;
    private const uint WmGetText = 0x000D;
    private const uint WmGetTextLength = 0x000E;
    private const uint WmSetText = 0x000C;
    private const int GwlStyle = -16;
    private const int EsReadOnly = 0x0800;
    private static readonly HashSet<string> NativeEditControlClasses =
    [
        "Edit",
        "RichEdit20W",
        "RichEdit50W",
        "RICHEDIT50W",
        "RICHEDIT60W",
        "RichEditD2DPT"
    ];

    public CaptureTextResult CaptureSelection()
    {
        var stopwatch = Stopwatch.StartNew();
        var foregroundWindow = GetForegroundWindow();
        var focusedElement = AutomationElement.FocusedElement;

        if (focusedElement is null)
        {
            return CaptureTextResult.Failure(
                "uia",
                "TEXT_CAPTURE_NO_FOCUS",
                "No focused automation element is available.",
                CreateWindowDiagnostics(foregroundWindow, stopwatch.ElapsedMilliseconds));
        }

        var diagnostics = CreateElementDiagnostics(
            focusedElement,
            foregroundWindow,
            stopwatch.ElapsedMilliseconds);

        if (TryGetSelectedText(focusedElement, out var selectedText))
        {
            diagnostics["apiAttempted"] = "text-pattern";
            diagnostics["selectionDetected"] = true;
            diagnostics["elapsedMs"] = stopwatch.ElapsedMilliseconds;

            return CaptureTextResult.Success("uia", selectedText, diagnostics);
        }

        if (TryReadNativeEditSnapshot(focusedElement, out var nativeEditSnapshot, out var isReadOnly))
        {
            diagnostics["apiAttempted"] = "native-edit-selection";
            diagnostics["editable"] = !isReadOnly;
            diagnostics["selectionDetected"] = nativeEditSnapshot.SelectedText.Length > 0;
            diagnostics["elapsedMs"] = stopwatch.ElapsedMilliseconds;

            if (nativeEditSnapshot.SelectedText.Length > 0)
            {
                diagnostics["selectedTextLength"] = nativeEditSnapshot.SelectedText.Length;
                diagnostics["nativeSelectionAvailable"] = true;
                return CaptureTextResult.Success(
                    "uia",
                    nativeEditSnapshot.SelectedText,
                    diagnostics);
            }

            return CaptureTextResult.Failure(
                "uia",
                "TEXT_CAPTURE_NO_SELECTION",
                "The focused control does not expose a selected text range.",
                diagnostics);
        }

        if (TryGetValuePattern(focusedElement, out var valuePattern))
        {
            diagnostics["apiAttempted"] = "value-pattern";
            diagnostics["editable"] = !valuePattern.Current.IsReadOnly;
            diagnostics["selectionDetected"] = false;
            diagnostics["elapsedMs"] = stopwatch.ElapsedMilliseconds;

            return CaptureTextResult.Failure(
                "uia",
                "TEXT_CAPTURE_NO_SELECTION",
                "The focused control does not expose a selected text range.",
                diagnostics);
        }

        diagnostics["apiAttempted"] = "unsupported";
        diagnostics["selectionDetected"] = false;
        diagnostics["elapsedMs"] = stopwatch.ElapsedMilliseconds;

        return CaptureTextResult.Failure(
            "uia",
            "TEXT_CAPTURE_UNSUPPORTED",
            "The focused control does not expose a supported text pattern.",
            diagnostics);
    }

    public FocusedElementSnapshot InspectFocusedElement()
    {
        var foregroundWindow = GetForegroundWindow();
        var focusedElement = AutomationElement.FocusedElement;

        if (focusedElement is null)
        {
            return new FocusedElementSnapshot(
                HasFocusedElement: false,
                IsEditable: false,
                RuntimeId: null,
                SelectedText: null,
                ValueText: null,
                SelectionPrefixText: null,
                SelectionSuffixText: null,
                Diagnostics: CreateWindowDiagnostics(foregroundWindow, elapsedMs: 0));
        }

        var diagnostics = CreateElementDiagnostics(
            focusedElement,
            foregroundWindow,
            elapsedMs: 0);
        string? selectedText = null;
        string? valueText = null;
        string? selectionPrefixText = null;
        string? selectionSuffixText = null;
        var isEditable = false;
        var runtimeId = TryGetRuntimeId(focusedElement);

        if (!string.IsNullOrWhiteSpace(runtimeId))
        {
            diagnostics["runtimeId"] = runtimeId;
        }

        if (TryReadNativeEditSnapshot(focusedElement, out var nativeEditSnapshot, out var nativeEditIsReadOnly))
        {
            valueText = nativeEditSnapshot.ValueText;
            selectedText = nativeEditSnapshot.SelectedText;
            selectionPrefixText = nativeEditSnapshot.SelectionPrefixText;
            selectionSuffixText = nativeEditSnapshot.SelectionSuffixText;
            isEditable = !nativeEditIsReadOnly;
            diagnostics["editable"] = isEditable;
            diagnostics["valuePatternAvailable"] = diagnostics["valuePatternAvailable"]?.GetValue<bool>() ?? false;
            diagnostics["nativeEditSelectionAvailable"] = nativeEditSnapshot.SelectedText.Length > 0;
            diagnostics["nativeValueTextLength"] = nativeEditSnapshot.ValueText.Length;
            diagnostics["selectionDetected"] = nativeEditSnapshot.SelectedText.Length > 0;

            if (nativeEditSnapshot.SelectedText.Length > 0)
            {
                diagnostics["selectedTextLength"] = nativeEditSnapshot.SelectedText.Length;
            }

            diagnostics["selectionPrefixTextLength"] = nativeEditSnapshot.SelectionPrefixText.Length;
            diagnostics["selectionSuffixTextLength"] = nativeEditSnapshot.SelectionSuffixText.Length;
        }

        var hasSingleSelection = TryGetSingleSelectionRange(
            focusedElement,
            out var textPattern,
            out var selectionRange);

        if (hasSingleSelection)
        {
            selectedText = selectionRange!.GetText(-1);
            diagnostics["selectionDetected"] = !string.IsNullOrEmpty(selectedText);

            if (!string.IsNullOrEmpty(selectedText))
            {
                diagnostics["selectedTextLength"] = selectedText.Length;
            }
        }
        else
        {
            diagnostics["selectionDetected"] = false;
        }

        if (TryGetValuePattern(focusedElement, out var valuePattern))
        {
            isEditable = !valuePattern.Current.IsReadOnly;
            valueText = valuePattern.Current.Value;
            diagnostics["editable"] = isEditable;
            diagnostics["valuePatternAvailable"] = true;

            if (!string.IsNullOrEmpty(valueText))
            {
                diagnostics["valueTextLength"] = valueText.Length;
            }
        }
        else
        {
            diagnostics["editable"] = false;
            diagnostics["valuePatternAvailable"] = false;
        }

        if (
            hasSingleSelection &&
            textPattern is not null &&
            selectionRange is not null &&
            valueText is not null &&
            TryGetSelectionSurroundingText(
                textPattern,
                selectionRange,
                out selectionPrefixText,
                out selectionSuffixText))
        {
            diagnostics["selectionPrefixTextLength"] = selectionPrefixText.Length;
            diagnostics["selectionSuffixTextLength"] = selectionSuffixText.Length;
        }

        return new FocusedElementSnapshot(
            HasFocusedElement: true,
            IsEditable: isEditable,
            RuntimeId: runtimeId,
            SelectedText: selectedText,
            ValueText: valueText,
            SelectionPrefixText: selectionPrefixText,
            SelectionSuffixText: selectionSuffixText,
            Diagnostics: diagnostics);
    }

    public SelectionContextCaptureResult CaptureSelectionContext()
    {
        var captureResult = CaptureSelection();
        var diagnostics = captureResult.Diagnostics.DeepClone() as JsonObject ?? new JsonObject();

        if (!captureResult.Ok)
        {
            return SelectionContextCaptureResult.Failure(
                captureResult.Method,
                captureResult.ErrorCode ?? "TEXT_CAPTURE_UNSUPPORTED",
                captureResult.ErrorMessage ?? "Failed to capture the current selection.",
                diagnostics);
        }

        var foregroundWindow = GetForegroundWindow();
        var focusedElement = AutomationElement.FocusedElement;
        var anchor = CreatePromptAnchorSnapshot(
            focusedElement,
            foregroundWindow);
        var restoreTargetToken = CreateRestoreTargetToken(foregroundWindow);
        var capabilities = new SelectionContextCapabilitiesSnapshot(
            CanPositionPromptNearSelection: !string.Equals(anchor.Kind, "unknown", StringComparison.Ordinal),
            CanRestoreTargetAfterPrompt: !string.IsNullOrWhiteSpace(restoreTargetToken),
            CanAutoWriteBackAfterPrompt: !string.IsNullOrWhiteSpace(restoreTargetToken));

        diagnostics["anchorKind"] = anchor.Kind;
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

        if (!string.IsNullOrWhiteSpace(restoreTargetToken))
        {
            diagnostics["restoreTargetToken"] = restoreTargetToken;
        }

        return SelectionContextCaptureResult.Success(
            captureResult.Method,
            captureResult.Text ?? string.Empty,
            anchor,
            restoreTargetToken,
            capabilities,
            diagnostics);
    }

    public RestoreTargetResult RestoreTarget(string token)
    {
        var diagnostics = new JsonObject
        {
            ["requestedToken"] = token
        };

        if (!TryParseWindowHandleToken(token, out var windowHandle))
        {
            return RestoreTargetResult.Failure(
                restored: false,
                errorCode: "INVALID_RESTORE_TARGET",
                errorMessage: "The restore target token is invalid.",
                diagnostics: diagnostics);
        }

        diagnostics["windowHandle"] = windowHandle.ToInt64();
        diagnostics["windowTitle"] = ReadWindowText(windowHandle);
        diagnostics["windowClassName"] = ReadWindowClassName(windowHandle);

        var processName = TryReadProcessName(windowHandle);
        if (!string.IsNullOrWhiteSpace(processName))
        {
            diagnostics["processName"] = processName;
        }

        if (!IsWindow(windowHandle))
        {
            diagnostics["foregroundRestored"] = false;
            return RestoreTargetResult.Failure(
                restored: false,
                errorCode: "RESTORE_TARGET_FAILED",
                errorMessage: "The target window handle is no longer valid.",
                diagnostics: diagnostics);
        }

        if (IsIconic(windowHandle))
        {
            _ = ShowWindow(windowHandle, SwRestore);
        }

        var restored =
            GetForegroundWindow() == windowHandle ||
            SetForegroundWindow(windowHandle);

        diagnostics["foregroundRestored"] = restored;

        return restored
            ? RestoreTargetResult.Success(
                restored: true,
                diagnostics: diagnostics)
            : RestoreTargetResult.Failure(
                restored: false,
                errorCode: "RESTORE_TARGET_FAILED",
                errorMessage: "Failed to restore the target window to the foreground.",
                diagnostics: diagnostics);
    }

    public void SetFocusedValue(string value, string? expectedRuntimeId = null)
    {
        var focusedElement = AutomationElement.FocusedElement ??
            throw new InvalidOperationException("No focused automation element is available.");
        var runtimeId = TryGetRuntimeId(focusedElement);

        if (!string.IsNullOrWhiteSpace(expectedRuntimeId) &&
            !string.Equals(runtimeId, expectedRuntimeId, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                "The focused automation element changed before the value could be updated.");
        }

        if (!TryGetValuePattern(focusedElement, out var valuePattern))
        {
            if (!TryWriteNativeEditText(focusedElement, value))
            {
                throw new InvalidOperationException(
                    "The focused control does not expose a writable value pattern.");
            }

            return;
        }

        if (valuePattern.Current.IsReadOnly)
        {
            throw new InvalidOperationException("The focused control is read-only.");
        }

        valuePattern.SetValue(value);
    }

    private static bool TryGetSelectedText(
        AutomationElement element,
        out string selectedText)
    {
        selectedText = string.Empty;

        if (!TryGetTextPattern(element, out var textPattern))
        {
            return false;
        }

        var selectionRanges = textPattern.GetSelection();
        if (selectionRanges.Length == 0)
        {
            return false;
        }

        var builder = new StringBuilder();
        foreach (var range in selectionRanges)
        {
            var rangeText = range.GetText(-1);
            if (string.IsNullOrEmpty(rangeText))
            {
                continue;
            }

            builder.Append(rangeText);
        }

        selectedText = builder.ToString();
        return !string.IsNullOrWhiteSpace(selectedText);
    }

    private static bool TryGetSingleSelectionRange(
        AutomationElement element,
        out TextPattern? textPattern,
        out TextPatternRange? selectionRange)
    {
        textPattern = null;
        selectionRange = null;

        if (!TryGetTextPattern(element, out var pattern))
        {
            return false;
        }

        var selectionRanges = pattern.GetSelection();
        if (selectionRanges.Length != 1)
        {
            return false;
        }

        textPattern = pattern;
        selectionRange = selectionRanges[0];
        return true;
    }

    private static bool TryReadNativeEditSnapshot(
        AutomationElement element,
        out NativeEditTextSnapshot snapshot,
        out bool isReadOnly)
    {
        snapshot = null!;
        isReadOnly = false;

        var nativeWindowHandle = element.Current.NativeWindowHandle;
        if (nativeWindowHandle == 0)
        {
            return false;
        }

        var windowHandle = new IntPtr(nativeWindowHandle);
        if (!IsSupportedNativeEditControl(windowHandle))
        {
            return false;
        }

        var valueText = ReadNativeEditText(windowHandle);
        if (valueText is null)
        {
            return false;
        }

        if (!TryGetNativeEditSelection(windowHandle, out var selectionStart, out var selectionEnd))
        {
            return false;
        }

        if (!NativeEditTextSnapshot.TryCreate(
            valueText,
            selectionStart,
            selectionEnd,
            out var createdSnapshot) ||
            createdSnapshot is null)
        {
            return false;
        }

        isReadOnly = IsReadOnlyNativeEditControl(windowHandle);
        snapshot = createdSnapshot;
        return true;
    }

    private static bool TryGetSelectionSurroundingText(
        TextPattern textPattern,
        TextPatternRange selectionRange,
        out string prefixText,
        out string suffixText)
    {
        prefixText = string.Empty;
        suffixText = string.Empty;

        try
        {
            var prefixRange = textPattern.DocumentRange.Clone();
            prefixRange.MoveEndpointByRange(
                TextPatternRangeEndpoint.End,
                selectionRange,
                TextPatternRangeEndpoint.Start);
            prefixText = prefixRange.GetText(-1) ?? string.Empty;

            var suffixRange = textPattern.DocumentRange.Clone();
            suffixRange.MoveEndpointByRange(
                TextPatternRangeEndpoint.Start,
                selectionRange,
                TextPatternRangeEndpoint.End);
            suffixText = suffixRange.GetText(-1) ?? string.Empty;
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static bool TryGetTextPattern(
        AutomationElement element,
        out TextPattern textPattern)
    {
        textPattern = null!;

        if (!element.TryGetCurrentPattern(TextPattern.Pattern, out var patternObject) ||
            patternObject is not TextPattern pattern)
        {
            return false;
        }

        textPattern = pattern;
        return true;
    }

    private static bool TryGetValuePattern(
        AutomationElement element,
        out ValuePattern valuePattern)
    {
        valuePattern = null!;

        if (!element.TryGetCurrentPattern(ValuePattern.Pattern, out var patternObject) ||
            patternObject is not ValuePattern pattern)
        {
            return false;
        }

        valuePattern = pattern;
        return true;
    }

    private static JsonObject CreateElementDiagnostics(
        AutomationElement element,
        IntPtr foregroundWindow,
        long elapsedMs)
    {
        var diagnostics = CreateWindowDiagnostics(foregroundWindow, elapsedMs);
        var runtimeId = TryGetRuntimeId(element);
        var nativeWindowHandle = element.Current.NativeWindowHandle;

        diagnostics["focused"] = true;
        diagnostics["controlType"] = element.Current.ControlType?.ProgrammaticName;
        diagnostics["automationId"] = element.Current.AutomationId;
        diagnostics["framework"] = element.Current.FrameworkId;
        diagnostics["elementClassName"] = element.Current.ClassName;

        if (nativeWindowHandle != 0)
        {
            diagnostics["nativeWindowHandle"] = nativeWindowHandle;
        }

        if (!string.IsNullOrWhiteSpace(runtimeId))
        {
            diagnostics["runtimeId"] = runtimeId;
        }

        return diagnostics;
    }

    private static string? TryGetRuntimeId(AutomationElement element)
    {
        try
        {
            var runtimeId = element.GetRuntimeId();
            return runtimeId is { Length: > 0 }
                ? string.Join("-", runtimeId)
                : null;
        }
        catch
        {
            return null;
        }
    }

    private static JsonObject CreateWindowDiagnostics(
        IntPtr foregroundWindow,
        long elapsedMs)
    {
        var diagnostics = new JsonObject
        {
            ["focused"] = foregroundWindow != IntPtr.Zero,
            ["windowTitle"] = ReadWindowText(foregroundWindow),
            ["windowClassName"] = ReadWindowClassName(foregroundWindow),
            ["elapsedMs"] = elapsedMs
        };

        var processName = TryReadProcessName(foregroundWindow);
        if (!string.IsNullOrWhiteSpace(processName))
        {
            diagnostics["processName"] = processName;
        }

        return diagnostics;
    }

    private static string? TryReadProcessName(IntPtr foregroundWindow)
    {
        if (foregroundWindow == IntPtr.Zero)
        {
            return null;
        }

        _ = GetWindowThreadProcessId(foregroundWindow, out var processId);
        if (processId == 0)
        {
            return null;
        }

        try
        {
            return Process.GetProcessById((int)processId).ProcessName;
        }
        catch
        {
            return null;
        }
    }

    private static string ReadWindowText(IntPtr foregroundWindow)
    {
        if (foregroundWindow == IntPtr.Zero)
        {
            return string.Empty;
        }

        var builder = new StringBuilder(512);
        _ = GetWindowText(foregroundWindow, builder, builder.Capacity);
        return builder.ToString();
    }

    private static string ReadWindowClassName(IntPtr foregroundWindow)
    {
        if (foregroundWindow == IntPtr.Zero)
        {
            return string.Empty;
        }

        var builder = new StringBuilder(256);
        _ = GetClassName(foregroundWindow, builder, builder.Capacity);
        return builder.ToString();
    }

    private static bool IsSupportedNativeEditControl(IntPtr windowHandle)
    {
        if (windowHandle == IntPtr.Zero)
        {
            return false;
        }

        var className = ReadWindowClassName(windowHandle);
        return className.Length > 0 && NativeEditControlClasses.Contains(className);
    }

    private static string? ReadNativeEditText(IntPtr windowHandle)
    {
        var lengthResult = SendMessage(
            windowHandle,
            WmGetTextLength,
            IntPtr.Zero,
            IntPtr.Zero);
        var length = lengthResult.ToInt32();

        if (length < 0)
        {
            return null;
        }

        var builder = new StringBuilder(length + 1);
        _ = SendMessage(
            windowHandle,
            WmGetText,
            (IntPtr)builder.Capacity,
            builder);
        return builder.ToString();
    }

    private static bool TryGetNativeEditSelection(
        IntPtr windowHandle,
        out int selectionStart,
        out int selectionEnd)
    {
        selectionStart = 0;
        selectionEnd = 0;

        var startPointer = Marshal.AllocHGlobal(sizeof(int));
        var endPointer = Marshal.AllocHGlobal(sizeof(int));

        try
        {
            _ = SendMessage(windowHandle, EmGetSel, startPointer, endPointer);
            selectionStart = Marshal.ReadInt32(startPointer);
            selectionEnd = Marshal.ReadInt32(endPointer);
            return true;
        }
        finally
        {
            Marshal.FreeHGlobal(startPointer);
            Marshal.FreeHGlobal(endPointer);
        }
    }

    private static bool IsReadOnlyNativeEditControl(IntPtr windowHandle)
    {
        var style = GetWindowStyle(windowHandle);
        return (style & EsReadOnly) == EsReadOnly;
    }

    private static bool TryWriteNativeEditText(
        AutomationElement element,
        string value)
    {
        var nativeWindowHandle = element.Current.NativeWindowHandle;
        if (nativeWindowHandle == 0)
        {
            return false;
        }

        var windowHandle = new IntPtr(nativeWindowHandle);
        if (!IsSupportedNativeEditControl(windowHandle) || IsReadOnlyNativeEditControl(windowHandle))
        {
            return false;
        }

        var result = SendMessage(windowHandle, WmSetText, IntPtr.Zero, value);
        return result != IntPtr.Zero;
    }

    private static long GetWindowStyle(IntPtr windowHandle)
    {
        return IntPtr.Size == 8
            ? GetWindowLongPtr(windowHandle, GwlStyle).ToInt64()
            : GetWindowLong(windowHandle, GwlStyle);
    }

    private static PromptAnchorSnapshot CreatePromptAnchorSnapshot(
        AutomationElement? focusedElement,
        IntPtr foregroundWindow)
    {
        if (focusedElement is not null &&
            TryGetElementBounds(focusedElement, out var elementBounds))
        {
            return new PromptAnchorSnapshot(
                "selection-rect",
                elementBounds.X,
                elementBounds.Y,
                elementBounds.Width,
                elementBounds.Height);
        }

        if (TryGetWindowBounds(foregroundWindow, out var windowBounds))
        {
            return new PromptAnchorSnapshot(
                "window-rect",
                windowBounds.X,
                windowBounds.Y,
                windowBounds.Width,
                windowBounds.Height);
        }

        return new PromptAnchorSnapshot("unknown");
    }

    private static bool TryGetElementBounds(
        AutomationElement element,
        out PromptAnchorBoundsSnapshot bounds)
    {
        bounds = null!;

        try
        {
            var rectangle = element.Current.BoundingRectangle;
            if (rectangle.IsEmpty ||
                rectangle.Width <= 0 ||
                rectangle.Height <= 0)
            {
                return false;
            }

            bounds = new PromptAnchorBoundsSnapshot(
                (int)Math.Round(rectangle.X),
                (int)Math.Round(rectangle.Y),
                (int)Math.Round(rectangle.Width),
                (int)Math.Round(rectangle.Height));
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static bool TryGetWindowBounds(
        IntPtr windowHandle,
        out PromptAnchorBoundsSnapshot bounds)
    {
        bounds = null!;

        if (windowHandle == IntPtr.Zero || !GetWindowRect(windowHandle, out var rect))
        {
            return false;
        }

        var width = rect.Right - rect.Left;
        var height = rect.Bottom - rect.Top;
        if (width <= 0 || height <= 0)
        {
            return false;
        }

        bounds = new PromptAnchorBoundsSnapshot(
            rect.Left,
            rect.Top,
            width,
            height);
        return true;
    }

    private static string? CreateRestoreTargetToken(IntPtr windowHandle)
    {
        return windowHandle == IntPtr.Zero
            ? null
            : $"hwnd:{windowHandle.ToInt64()}";
    }

    private static bool TryParseWindowHandleToken(
        string token,
        out IntPtr windowHandle)
    {
        windowHandle = IntPtr.Zero;

        if (!token.StartsWith("hwnd:", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var handleText = token["hwnd:".Length..];
        if (!long.TryParse(handleText, out var handleValue) || handleValue <= 0)
        {
            return false;
        }

        windowHandle = new IntPtr(handleValue);
        return true;
    }

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetForegroundWindow(IntPtr windowHandle);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindow(IntPtr windowHandle);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsIconic(IntPtr windowHandle);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool ShowWindow(IntPtr windowHandle, int command);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetWindowRect(IntPtr windowHandle, out Rect rect);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(
        IntPtr windowHandle,
        StringBuilder text,
        int maxCount);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(
        IntPtr windowHandle,
        StringBuilder className,
        int maxCount);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(
        IntPtr windowHandle,
        out uint processId);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr SendMessage(
        IntPtr windowHandle,
        uint message,
        IntPtr wParam,
        StringBuilder lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr SendMessage(
        IntPtr windowHandle,
        uint message,
        IntPtr wParam,
        string lParam);

    [DllImport("user32.dll")]
    private static extern IntPtr SendMessage(
        IntPtr windowHandle,
        uint message,
        IntPtr wParam,
        IntPtr lParam);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")]
    private static extern IntPtr GetWindowLongPtr(IntPtr windowHandle, int index);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
    private static extern int GetWindowLong(IntPtr windowHandle, int index);

    [StructLayout(LayoutKind.Sequential)]
    private struct Rect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    private const int SwRestore = 9;
}
