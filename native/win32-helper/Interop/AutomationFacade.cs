using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json.Nodes;
using System.Windows.Automation;
using TextBridge.Win32Helper.Services;

namespace TextBridge.Win32Helper.Interop;

public interface IAutomationFacade
{
    CaptureTextResult CaptureSelection();
}

public sealed class AutomationFacade : IAutomationFacade
{
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

        diagnostics["focused"] = true;
        diagnostics["controlType"] = element.Current.ControlType?.ProgrammaticName;
        diagnostics["automationId"] = element.Current.AutomationId;
        diagnostics["framework"] = element.Current.FrameworkId;

        return diagnostics;
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

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

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
}
