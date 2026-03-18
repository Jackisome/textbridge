using System.Text.Json.Nodes;
using TextBridge.Win32Helper.Interop;
using TextBridge.Win32Helper.Services;
using Xunit;

namespace TextBridge.Win32Helper.Tests;

public sealed class WriteTextServiceTests
{
    [Fact]
    public async Task Rejects_replace_when_selection_cannot_be_verified()
    {
        var service = new WriteTextService(
            new FakeClipboardTextService(),
            new FakeInputSimulationService());

        var result = await service.WriteAsync("translated", "replace-selection");

        Assert.False(result.Ok);
        Assert.Equal("replace-selection", result.Method);
        Assert.Equal("WRITE_BACK_UNSUPPORTED", result.ErrorCode);
    }

    [Fact]
    public async Task Replaces_selection_when_the_focused_control_can_be_safely_reconstructed()
    {
        var inspection = new FakeFocusedElementInspectionService();
        inspection.SnapshotSequence.Enqueue(
            new FocusedElementSnapshot(
                HasFocusedElement: true,
                IsEditable: true,
                RuntimeId: "runtime-id",
                SelectedText: "world",
                ValueText: "hello world!",
                SelectionPrefixText: "hello ",
                SelectionSuffixText: "!",
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
                    ["valueTextLength"] = 12
                }));
        inspection.SnapshotSequence.Enqueue(
            new FocusedElementSnapshot(
                HasFocusedElement: true,
                IsEditable: true,
                RuntimeId: "runtime-id",
                SelectedText: null,
                ValueText: "hello translated!",
                SelectionPrefixText: null,
                SelectionSuffixText: null,
                Diagnostics: new JsonObject
                {
                    ["processName"] = "chrome",
                    ["windowClassName"] = "Chrome_WidgetWin_1",
                    ["windowTitle"] = "Test window",
                    ["controlType"] = "ControlType.Edit",
                    ["framework"] = "Chrome",
                    ["runtimeId"] = "runtime-id",
                    ["selectionDetected"] = false,
                    ["valuePatternAvailable"] = true,
                    ["valueTextLength"] = 17
                }));
        var valueWriter = new FakeFocusedElementValueWriter();
        var service = new WriteTextService(
            new FakeClipboardTextService(),
            new FakeInputSimulationService(),
            inspection,
            valueWriter);

        var result = await service.WriteAsync(
            "translated",
            "replace-selection",
            "world");

        Assert.True(result.Ok);
        Assert.Equal("replace-selection", result.Method);
        Assert.Equal("hello translated!", valueWriter.LastWrittenValue);
        Assert.Equal("runtime-id", valueWriter.LastExpectedRuntimeId);
        Assert.Equal(true, result.Diagnostics["selectionVerified"]?.GetValue<bool>());
        Assert.Equal(true, result.Diagnostics["targetStable"]?.GetValue<bool>());
        Assert.Equal(true, result.Diagnostics["valueChanged"]?.GetValue<bool>());
        Assert.Equal(true, result.Diagnostics["translatedTextDetected"]?.GetValue<bool>());
    }

    [Fact]
    public async Task Replaces_selection_when_line_endings_differ_between_capture_and_snapshot_text()
    {
        var inspection = new FakeFocusedElementInspectionService();
        inspection.SnapshotSequence.Enqueue(
            new FocusedElementSnapshot(
                HasFocusedElement: true,
                IsEditable: true,
                RuntimeId: "runtime-id",
                SelectedText: "world\r\nline2",
                ValueText: "hello world\nline2!",
                SelectionPrefixText: "hello ",
                SelectionSuffixText: "!",
                Diagnostics: new JsonObject
                {
                    ["processName"] = "notepad",
                    ["windowClassName"] = "Edit",
                    ["windowTitle"] = "Untitled - Notepad",
                    ["controlType"] = "ControlType.Edit",
                    ["framework"] = "Win32",
                    ["runtimeId"] = "runtime-id",
                    ["selectionDetected"] = true,
                    ["selectedTextLength"] = 12,
                    ["valuePatternAvailable"] = true,
                    ["valueTextLength"] = 18
                }));
        inspection.SnapshotSequence.Enqueue(
            new FocusedElementSnapshot(
                HasFocusedElement: true,
                IsEditable: true,
                RuntimeId: "runtime-id",
                SelectedText: null,
                ValueText: "hello translated\nline2!",
                SelectionPrefixText: null,
                SelectionSuffixText: null,
                Diagnostics: new JsonObject
                {
                    ["processName"] = "notepad",
                    ["windowClassName"] = "Edit",
                    ["windowTitle"] = "Untitled - Notepad",
                    ["controlType"] = "ControlType.Edit",
                    ["framework"] = "Win32",
                    ["runtimeId"] = "runtime-id",
                    ["selectionDetected"] = false,
                    ["valuePatternAvailable"] = true,
                    ["valueTextLength"] = 23
                }));
        var valueWriter = new FakeFocusedElementValueWriter();
        var service = new WriteTextService(
            new FakeClipboardTextService(),
            new FakeInputSimulationService(),
            inspection,
            valueWriter);

        var result = await service.WriteAsync(
            "translated\r\nline2",
            "replace-selection",
            "world\nline2");

        Assert.True(result.Ok);
        Assert.Equal("replace-selection", result.Method);
        Assert.Equal("hello translated\r\nline2!", valueWriter.LastWrittenValue);
        Assert.Equal(true, result.Diagnostics["selectionMatchedExpected"]?.GetValue<bool>());
        Assert.Equal(true, result.Diagnostics["selectionVerified"]?.GetValue<bool>());
        Assert.Equal(true, result.Diagnostics["targetStable"]?.GetValue<bool>());
        Assert.Equal(true, result.Diagnostics["valueChanged"]?.GetValue<bool>());
        Assert.Equal(true, result.Diagnostics["translatedTextDetected"]?.GetValue<bool>());
    }

    [Fact]
    public async Task Rejects_replace_when_selection_cannot_be_safely_mapped_to_the_full_value()
    {
        var inspection = new FakeFocusedElementInspectionService
        {
            Snapshot = new FocusedElementSnapshot(
                HasFocusedElement: true,
                IsEditable: true,
                RuntimeId: "runtime-id",
                SelectedText: "world",
                ValueText: "hello world!",
                SelectionPrefixText: "hello ",
                SelectionSuffixText: "?",
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
                    ["valueTextLength"] = 12
                })
        };
        var valueWriter = new FakeFocusedElementValueWriter();
        var service = new WriteTextService(
            new FakeClipboardTextService(),
            new FakeInputSimulationService(),
            inspection,
            valueWriter);

        var result = await service.WriteAsync(
            "translated",
            "replace-selection",
            "world");

        Assert.False(result.Ok);
        Assert.Equal("replace-selection", result.Method);
        Assert.Equal("WRITE_BACK_UNSUPPORTED", result.ErrorCode);
        Assert.Null(valueWriter.LastWrittenValue);
        Assert.Equal(false, result.Diagnostics["selectionVerified"]?.GetValue<bool>());
    }

    [Fact]
    public async Task Fails_closed_when_paste_translation_cannot_be_verified()
    {
        var clipboard = new FakeClipboardTextService();
        var inputSimulation = new FakeInputSimulationService
        {
            PasteResult = new InputSimulationResult(
                HadPressedModifiers: true,
                ModifierReleaseWaitMs: 87,
                ModifierReleaseTimedOut: false)
        };
        var service = new WriteTextService(clipboard, inputSimulation);

        var result = await service.WriteAsync("translated", "paste-translation");

        Assert.False(result.Ok);
        Assert.Equal("paste-translation", result.Method);
        Assert.Equal("WRITE_BACK_TARGET_UNVERIFIED", result.ErrorCode);
        Assert.Null(clipboard.LastWrittenText);
        Assert.Equal(0, inputSimulation.PasteShortcutCount);
    }

    [Fact]
    public async Task Verifies_paste_translation_when_line_endings_are_normalized_during_verification()
    {
        var clipboard = new FakeClipboardTextService();
        var inputSimulation = new FakeInputSimulationService
        {
            PasteResult = new InputSimulationResult(
                HadPressedModifiers: false,
                ModifierReleaseWaitMs: 0,
                ModifierReleaseTimedOut: false)
        };
        var focusInspection = new FakeFocusedElementInspectionService();
        focusInspection.SnapshotSequence.Enqueue(
            new FocusedElementSnapshot(
                HasFocusedElement: true,
                IsEditable: true,
                RuntimeId: "runtime-id",
                SelectedText: "world\r\nline2",
                ValueText: "hello world\nline2",
                SelectionPrefixText: "hello ",
                SelectionSuffixText: string.Empty,
                Diagnostics: new JsonObject
                {
                    ["processName"] = "notepad",
                    ["windowClassName"] = "Edit",
                    ["windowTitle"] = "Untitled - Notepad",
                    ["controlType"] = "ControlType.Edit",
                    ["framework"] = "Win32",
                    ["runtimeId"] = "runtime-id",
                    ["selectionDetected"] = true,
                    ["selectedTextLength"] = 12,
                    ["valuePatternAvailable"] = true,
                    ["valueTextLength"] = 17
                }));
        focusInspection.SnapshotSequence.Enqueue(
            new FocusedElementSnapshot(
                HasFocusedElement: true,
                IsEditable: true,
                RuntimeId: "runtime-id",
                SelectedText: null,
                ValueText: "hello translated\nline2",
                SelectionPrefixText: null,
                SelectionSuffixText: null,
                Diagnostics: new JsonObject
                {
                    ["processName"] = "notepad",
                    ["windowClassName"] = "Edit",
                    ["windowTitle"] = "Untitled - Notepad",
                    ["controlType"] = "ControlType.Edit",
                    ["framework"] = "Win32",
                    ["runtimeId"] = "runtime-id",
                    ["selectionDetected"] = false,
                    ["valuePatternAvailable"] = true,
                    ["valueTextLength"] = 22
                }));
        var service = new WriteTextService(
            clipboard,
            inputSimulation,
            focusInspection);

        var result = await service.WriteAsync(
            "translated\r\nline2",
            "paste-translation",
            "world\nline2");

        Assert.True(result.Ok);
        Assert.Equal("paste-translation", result.Method);
        Assert.Equal("translated\r\nline2", clipboard.LastWrittenText);
        Assert.Equal(1, inputSimulation.PasteShortcutCount);
        Assert.Equal(true, result.Diagnostics["selectionMatchedExpected"]?.GetValue<bool>());
        Assert.Equal(true, result.Diagnostics["valueChanged"]?.GetValue<bool>());
        Assert.Equal(true, result.Diagnostics["translatedTextDetected"]?.GetValue<bool>());
    }

    [Fact]
    public async Task Verifies_paste_translation_after_the_focused_control_changes()
    {
        var clipboard = new FakeClipboardTextService();
        var inputSimulation = new FakeInputSimulationService
        {
            PasteResult = new InputSimulationResult(
                HadPressedModifiers: true,
                ModifierReleaseWaitMs: 87,
                ModifierReleaseTimedOut: false)
        };
        var focusInspection = new FakeFocusedElementInspectionService();
        focusInspection.SnapshotSequence.Enqueue(
            new FocusedElementSnapshot(
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
                }));
        focusInspection.SnapshotSequence.Enqueue(
            new FocusedElementSnapshot(
                HasFocusedElement: true,
                IsEditable: true,
                RuntimeId: "runtime-id",
                SelectedText: null,
                ValueText: "hello translated",
                SelectionPrefixText: null,
                SelectionSuffixText: null,
                Diagnostics: new JsonObject
                {
                    ["processName"] = "chrome",
                    ["windowClassName"] = "Chrome_WidgetWin_1",
                    ["windowTitle"] = "Test window",
                    ["controlType"] = "ControlType.Edit",
                    ["framework"] = "Chrome",
                    ["runtimeId"] = "runtime-id",
                    ["selectionDetected"] = false,
                    ["valuePatternAvailable"] = true,
                    ["valueTextLength"] = 16
                }));
        var service = new WriteTextService(
            clipboard,
            inputSimulation,
            focusInspection);

        var result = await service.WriteAsync(
            "translated",
            "paste-translation",
            "world");

        Assert.True(result.Ok);
        Assert.Equal("paste-translation", result.Method);
        Assert.Equal("translated", clipboard.LastWrittenText);
        Assert.Equal(1, inputSimulation.PasteShortcutCount);
        Assert.Equal(true, result.Diagnostics["selectionMatchedExpected"]?.GetValue<bool>());
        Assert.Equal(true, result.Diagnostics["valueChanged"]?.GetValue<bool>());
        Assert.Equal(true, result.Diagnostics["translatedTextDetected"]?.GetValue<bool>());
        Assert.Equal("value-pattern", result.Diagnostics["verificationMethod"]?.GetValue<string>());
        Assert.Equal(true, result.Diagnostics["hadPressedModifiers"]?.GetValue<bool>());
        Assert.Equal(87, result.Diagnostics["modifierReleaseWaitMs"]?.GetValue<int>());
        Assert.Equal(false, result.Diagnostics["modifierReleaseTimedOut"]?.GetValue<bool>());
    }

    [Fact]
    public async Task Writes_text_to_clipboard_when_clipboard_write_is_requested()
    {
        var clipboard = new FakeClipboardTextService();
        var service = new WriteTextService(
            clipboard,
            new FakeInputSimulationService());

        var result = await service.WriteAsync("translated", "clipboard-write");

        Assert.True(result.Ok);
        Assert.Equal("clipboard-write", result.Method);
        Assert.Equal("translated", clipboard.LastWrittenText);
    }

    [Fact]
    public async Task StdIoHost_routes_clipboard_write_requests()
    {
        using var input = new StringReader("{\"id\":\"req-4\",\"kind\":\"clipboard-write\",\"timestamp\":\"2026-03-10T00:00:00.000Z\",\"payload\":{\"text\":\"translated\"}}\n");
        using var output = new StringWriter();
        using var logger = new Logger();
        var host = new StdIoHost(
            input,
            output,
            logger,
            new HealthCheckService(),
            new CaptureTextService(
                new FakeAutomationFacade(),
                new FakeClipboardTextService(),
                new FakeInputSimulationService()),
            new WriteTextService(
                new FakeClipboardTextService(),
                new FakeInputSimulationService()));

        await host.RunAsync();

        var json = output.ToString();

        Assert.Contains("\"kind\":\"clipboard-write\"", json);
        Assert.Contains("\"ok\":true", json);
    }
}
