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

public sealed class FakeInputSimulationService : IInputSimulationService
{
    public bool CopySucceeded { get; set; } = true;
    public int PasteShortcutCount { get; private set; }

    public void SendCopyShortcut()
    {
        if (!CopySucceeded)
        {
            throw new InvalidOperationException("Failed to send the copy shortcut.");
        }
    }

    public void SendPasteShortcut()
    {
        PasteShortcutCount += 1;
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
    public async Task Returns_copied_text_when_clipboard_capture_succeeds()
    {
        var clipboard = new FakeClipboardTextService();
        clipboard.ReadSequence.Enqueue("old text");
        clipboard.ReadSequence.Enqueue("copied text");
        var service = new CaptureTextService(
            new FakeAutomationFacade(),
            clipboard,
            new FakeInputSimulationService { CopySucceeded = true });

        var result = await service.CaptureAsync("clipboard");

        Assert.True(result.Ok);
        Assert.Equal("clipboard", result.Method);
        Assert.Equal("copied text", result.Text);
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
