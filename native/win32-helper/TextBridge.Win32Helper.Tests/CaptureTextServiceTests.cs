using System.Text.Json.Nodes;
using TextBridge.Win32Helper.Interop;
using TextBridge.Win32Helper.Services;
using Xunit;

namespace TextBridge.Win32Helper.Tests;

public sealed class FakeAutomationFacade : IAutomationFacade
{
    public CaptureTextResult Result { get; set; } =
        CaptureTextResult.Failure("uia", "TEXT_CAPTURE_UNSUPPORTED", "No selection is available.", new JsonObject());

    public CaptureTextResult CaptureSelection() => Result;
}

public sealed class FakeClipboardTextService : IClipboardTextService
{
    public string? Text { get; set; }
    public string? LastWrittenText { get; private set; }
    public Queue<string?> ReadSequence { get; } = new();

    public string? ReadText()
    {
        if (ReadSequence.Count > 0)
        {
            return ReadSequence.Dequeue();
        }

        return Text;
    }

    public void WriteText(string text)
    {
        LastWrittenText = text;
    }
}

public sealed class FakeFocusedElementInspectionService : IFocusedElementInspectionService
{
    public FocusedElementSnapshot Snapshot { get; set; } = new(
        HasFocusedElement: true,
        IsEditable: true,
        RuntimeId: "runtime-id",
        SelectedText: "world",
        ValueText: "hello world",
        SelectionPrefixText: "hello ",
        SelectionSuffixText: string.Empty,
        Diagnostics: new JsonObject
        {
            ["processName"] = "chrome",
            ["windowClassName"] = "Chrome_WidgetWin_1",
            ["windowTitle"] = "Test window",
            ["controlType"] = "ControlType.Edit",
            ["framework"] = "Chrome",
            ["runtimeId"] = "runtime-id",
            ["selectionDetected"] = true,
            ["selectedTextLength"] = 5,
            ["valuePatternAvailable"] = true,
            ["valueTextLength"] = 11
        });
    public Queue<FocusedElementSnapshot> SnapshotSequence { get; } = new();
    public int InspectCallCount { get; private set; }

    public FocusedElementSnapshot InspectFocusedElement()
    {
        InspectCallCount += 1;

        if (SnapshotSequence.Count > 0)
        {
            return SnapshotSequence.Dequeue();
        }

        return Snapshot;
    }
}

public sealed class FakeFocusedElementValueWriter : IFocusedElementValueWriter
{
    public string? LastWrittenValue { get; private set; }
    public string? LastExpectedRuntimeId { get; private set; }
    public bool ThrowOnWrite { get; set; }

    public void SetFocusedValue(string value, string? expectedRuntimeId = null)
    {
        if (ThrowOnWrite)
        {
            throw new InvalidOperationException("Failed to write the focused value.");
        }

        LastWrittenValue = value;
        LastExpectedRuntimeId = expectedRuntimeId;
    }
}

public sealed class FakeInputSimulationService : IInputSimulationService
{
    public bool CopySucceeded { get; set; } = true;
    public InputSimulationResult CopyResult { get; set; }
    public InputSimulationResult PasteResult { get; set; }
    public int PasteShortcutCount { get; private set; }
    public int ModifierReleaseCheckCount { get; private set; }

    public InputSimulationResult SendCopyShortcut()
    {
        if (!CopySucceeded)
        {
            throw new InvalidOperationException("Failed to send the copy shortcut.");
        }

        return CopyResult;
    }

    public InputSimulationResult SendPasteShortcut()
    {
        PasteShortcutCount += 1;
        return PasteResult;
    }

    public InputSimulationResult WaitForModifiersToBeReleased()
    {
        ModifierReleaseCheckCount += 1;
        return CopyResult;
    }
}

public sealed class CaptureTextServiceTests
{
    [Fact]
    public async Task Returns_selected_text_from_uia_when_selection_exists()
    {
        var automation = new FakeAutomationFacade
        {
            Result = CaptureTextResult.Success(
                "uia",
                "hello",
                new JsonObject { ["apiAttempted"] = "uia" })
        };
        var service = new CaptureTextService(
            automation,
            new FakeClipboardTextService(),
            new FakeInputSimulationService());

        var result = await service.CaptureAsync("uia");

        Assert.True(result.Ok);
        Assert.Equal("uia", result.Method);
        Assert.Equal("hello", result.Text);
        Assert.Null(result.ErrorCode);
    }

    [Fact]
    public async Task Returns_no_selection_error_when_uia_does_not_report_a_selection()
    {
        var automation = new FakeAutomationFacade
        {
            Result = CaptureTextResult.Failure(
                "uia",
                "TEXT_CAPTURE_NO_SELECTION",
                "The focused control does not expose a selected text range.",
                new JsonObject { ["apiAttempted"] = "uia" })
        };
        var service = new CaptureTextService(
            automation,
            new FakeClipboardTextService(),
            new FakeInputSimulationService());

        var result = await service.CaptureAsync("uia");

        Assert.False(result.Ok);
        Assert.Equal("uia", result.Method);
        Assert.Equal("TEXT_CAPTURE_NO_SELECTION", result.ErrorCode);
    }

    [Fact]
    public async Task Waits_for_transient_shell_windows_to_clear_before_uia_capture()
    {
        var automation = new FakeAutomationFacade
        {
            Result = CaptureTextResult.Success(
                "uia",
                "hello world",
                new JsonObject { ["apiAttempted"] = "uia" })
        };
        var focusInspection = new FakeFocusedElementInspectionService();
        focusInspection.SnapshotSequence.Enqueue(
            new FocusedElementSnapshot(
                HasFocusedElement: true,
                IsEditable: false,
                RuntimeId: "shell-runtime-id",
                SelectedText: null,
                ValueText: null,
                SelectionPrefixText: null,
                SelectionSuffixText: null,
                Diagnostics: new JsonObject
                {
                    ["processName"] = "explorer",
                    ["windowClassName"] = "XamlExplorerHostIslandWindow",
                    ["windowTitle"] = "任务切换",
                    ["controlType"] = "ControlType.Pane",
                    ["framework"] = "XAML"
                }));
        focusInspection.SnapshotSequence.Enqueue(
            new FocusedElementSnapshot(
                HasFocusedElement: true,
                IsEditable: true,
                RuntimeId: "chrome-runtime-id",
                SelectedText: "hello world",
                ValueText: "hello world",
                SelectionPrefixText: string.Empty,
                SelectionSuffixText: string.Empty,
                Diagnostics: new JsonObject
                {
                    ["processName"] = "chrome",
                    ["windowClassName"] = "Chrome_WidgetWin_1",
                    ["windowTitle"] = "Test window",
                    ["controlType"] = "ControlType.Edit",
                    ["framework"] = "Chrome"
                }));
        var service = new CaptureTextService(
            automation,
            new FakeClipboardTextService(),
            new FakeInputSimulationService(),
            focusedElementInspectionService: focusInspection,
            focusStabilizationTimeout: TimeSpan.FromMilliseconds(20),
            focusStabilizationPollInterval: TimeSpan.Zero);

        var result = await service.CaptureAsync("uia");

        Assert.True(result.Ok);
        Assert.Equal("uia", result.Method);
        Assert.Equal("hello world", result.Text);
        Assert.Equal(true, result.Diagnostics["transientShellWindowDetected"]?.GetValue<bool>());
        Assert.Equal(false, result.Diagnostics["focusStabilizationTimedOut"]?.GetValue<bool>());
        Assert.True((result.Diagnostics["focusStabilizationWaitMs"]?.GetValue<int>() ?? 0) >= 0);
    }

    [Fact]
    public async Task Waits_for_modifier_release_before_uia_capture()
    {
        var automation = new FakeAutomationFacade
        {
            Result = CaptureTextResult.Success(
                "uia",
                "hello world",
                new JsonObject { ["apiAttempted"] = "uia" })
        };
        var inputSimulation = new FakeInputSimulationService
        {
            CopyResult = new InputSimulationResult(
                HadPressedModifiers: true,
                ModifierReleaseWaitMs: 180,
                ModifierReleaseTimedOut: false)
        };
        var focusInspection = new FakeFocusedElementInspectionService();
        var service = new CaptureTextService(
            automation,
            new FakeClipboardTextService(),
            inputSimulation,
            focusedElementInspectionService: focusInspection,
            focusStabilizationTimeout: TimeSpan.FromMilliseconds(20),
            focusStabilizationPollInterval: TimeSpan.Zero);

        var result = await service.CaptureAsync("uia");

        Assert.True(result.Ok);
        Assert.Equal(1, inputSimulation.ModifierReleaseCheckCount);
        Assert.Equal(true, result.Diagnostics["hadPressedModifiers"]?.GetValue<bool>());
        Assert.Equal(180, result.Diagnostics["modifierReleaseWaitMs"]?.GetValue<int>());
        Assert.Equal(false, result.Diagnostics["modifierReleaseTimedOut"]?.GetValue<bool>());
    }

    [Fact]
    public async Task Waits_for_textbridge_window_to_clear_before_uia_capture()
    {
        var automation = new FakeAutomationFacade
        {
            Result = CaptureTextResult.Success(
                "uia",
                "world!",
                new JsonObject { ["apiAttempted"] = "uia" })
        };
        var focusInspection = new FakeFocusedElementInspectionService();
        focusInspection.SnapshotSequence.Enqueue(
            new FocusedElementSnapshot(
                HasFocusedElement: true,
                IsEditable: false,
                RuntimeId: "textbridge-runtime-id",
                SelectedText: null,
                ValueText: null,
                SelectionPrefixText: null,
                SelectionSuffixText: null,
                Diagnostics: new JsonObject
                {
                    ["processName"] = "electron",
                    ["windowClassName"] = "Chrome_WidgetWin_1",
                    ["windowTitle"] = "TextBridge",
                    ["controlType"] = "ControlType.Document",
                    ["framework"] = "Chrome"
                }));
        focusInspection.SnapshotSequence.Enqueue(
            new FocusedElementSnapshot(
                HasFocusedElement: true,
                IsEditable: true,
                RuntimeId: "chrome-runtime-id",
                SelectedText: "world!",
                ValueText: "hello world!",
                SelectionPrefixText: "hello ",
                SelectionSuffixText: string.Empty,
                Diagnostics: new JsonObject
                {
                    ["processName"] = "chrome",
                    ["windowClassName"] = "Chrome_WidgetWin_1",
                    ["windowTitle"] = "Test window",
                    ["controlType"] = "ControlType.Edit",
                    ["framework"] = "Chrome"
                }));
        var service = new CaptureTextService(
            automation,
            new FakeClipboardTextService(),
            new FakeInputSimulationService(),
            focusedElementInspectionService: focusInspection,
            focusStabilizationTimeout: TimeSpan.FromMilliseconds(20),
            focusStabilizationPollInterval: TimeSpan.Zero);

        var result = await service.CaptureAsync("uia");

        Assert.True(result.Ok);
        Assert.Equal("uia", result.Method);
        Assert.Equal("world!", result.Text);
        Assert.Equal("textbridge-window", result.Diagnostics["focusStabilizationReason"]?.GetValue<string>());
        Assert.Equal(false, result.Diagnostics["focusStabilizationTimedOut"]?.GetValue<bool>());
    }

    [Fact]
    public async Task Returns_copied_text_when_clipboard_capture_succeeds()
    {
        var clipboard = new FakeClipboardTextService();
        clipboard.ReadSequence.Enqueue("old text");
        clipboard.ReadSequence.Enqueue("copied text");
        var inputSimulation = new FakeInputSimulationService
        {
            CopySucceeded = true,
            CopyResult = new InputSimulationResult(
                HadPressedModifiers: true,
                ModifierReleaseWaitMs: 42,
                ModifierReleaseTimedOut: false)
        };
        var service = new CaptureTextService(
            new FakeAutomationFacade(),
            clipboard,
            inputSimulation);

        var result = await service.CaptureAsync("clipboard");

        Assert.True(result.Ok);
        Assert.Equal("clipboard", result.Method);
        Assert.Equal("copied text", result.Text);
        Assert.Equal(true, result.Diagnostics["hadPressedModifiers"]?.GetValue<bool>());
        Assert.Equal(42, result.Diagnostics["modifierReleaseWaitMs"]?.GetValue<int>());
        Assert.Equal(false, result.Diagnostics["modifierReleaseTimedOut"]?.GetValue<bool>());
    }

    [Fact]
    public async Task Returns_clipboard_failure_when_simulated_copy_fails()
    {
        var service = new CaptureTextService(
            new FakeAutomationFacade(),
            new FakeClipboardTextService { Text = "copied text" },
            new FakeInputSimulationService { CopySucceeded = false });

        var result = await service.CaptureAsync("clipboard");

        Assert.False(result.Ok);
        Assert.Equal("clipboard", result.Method);
        Assert.Equal("TEXT_CAPTURE_CLIPBOARD_FAILED", result.ErrorCode);
    }

    [Fact]
    public async Task Returns_clipboard_failure_when_clipboard_text_does_not_change()
    {
        var clipboard = new FakeClipboardTextService();
        clipboard.ReadSequence.Enqueue("existing text");
        clipboard.ReadSequence.Enqueue("existing text");
        var service = new CaptureTextService(
            new FakeAutomationFacade(),
            clipboard,
            new FakeInputSimulationService { CopySucceeded = true },
            TimeSpan.Zero);

        var result = await service.CaptureAsync("clipboard");

        Assert.False(result.Ok);
        Assert.Equal("clipboard", result.Method);
        Assert.Equal("TEXT_CAPTURE_CLIPBOARD_FAILED", result.ErrorCode);
    }

    [Fact]
    public async Task Converts_capture_result_to_helper_payload()
    {
        var payload = CaptureTextResult.Success(
            "clipboard",
            "copied text",
            new JsonObject { ["apiAttempted"] = "send-input" })
            .ToPayload();

        Assert.Equal("clipboard", payload["method"]?.GetValue<string>());
        Assert.Equal("copied text", payload["text"]?.GetValue<string>());
        Assert.Equal("send-input", payload["diagnostics"]?["apiAttempted"]?.GetValue<string>());
    }
}
