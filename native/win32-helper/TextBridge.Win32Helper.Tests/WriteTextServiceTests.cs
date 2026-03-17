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
    public async Task Uses_clipboard_and_sendinput_for_paste_translation()
    {
        var clipboard = new FakeClipboardTextService();
        var inputSimulation = new FakeInputSimulationService();
        var service = new WriteTextService(clipboard, inputSimulation);

        var result = await service.WriteAsync("translated", "paste-translation");

        Assert.True(result.Ok);
        Assert.Equal("paste-translation", result.Method);
        Assert.Equal("translated", clipboard.LastWrittenText);
        Assert.Equal(1, inputSimulation.PasteShortcutCount);
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
