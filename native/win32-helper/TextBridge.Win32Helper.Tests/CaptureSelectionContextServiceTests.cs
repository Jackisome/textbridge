using System.Text.Json.Nodes;
using TextBridge.Win32Helper.Interop;
using TextBridge.Win32Helper.Services;
using Xunit;

namespace TextBridge.Win32Helper.Tests;

public sealed class CaptureSelectionContextServiceTests
{
    [Fact]
    public async Task CaptureSelectionContext_ReturnsControlRectAndConservativeCapabilitiesForCurrentRealPath()
    {
        var automation = new FakeSelectionContextAutomationFacade
        {
            Result = SelectionContextCaptureResult.Success(
                "uia",
                "world",
                new PromptAnchorSnapshot(
                    // Current real helper path does not yet emit true selection-rect bounds.
                    "control-rect",
                    10,
                    10,
                    40,
                    20,
                    "display-1"),
                "hwnd:123",
                new SelectionContextCapabilitiesSnapshot(
                    CanPositionPromptNearSelection: true,
                    CanRestoreTargetAfterPrompt: true,
                    CanAutoWriteBackAfterPrompt: false),
                new JsonObject
                {
                    ["processName"] = "notepad",
                    ["windowClassName"] = "Edit"
                })
        };
        var service = new CaptureSelectionContextService(automation);

        var result = await service.CaptureAsync("uia");

        Assert.True(result.Ok);
        Assert.Equal("uia", result.Method);
        Assert.Equal("world", result.Text);
        Assert.Equal("control-rect", result.Anchor.Kind);
        Assert.Equal(10, result.Anchor.Bounds?.X);
        Assert.Equal(20, result.Anchor.Bounds?.Height);
        Assert.Equal("display-1", result.Anchor.DisplayId);
        Assert.Equal("hwnd:123", result.RestoreTargetToken);
        Assert.True(result.Capabilities.CanPositionPromptNearSelection);
        Assert.True(result.Capabilities.CanRestoreTargetAfterPrompt);
        Assert.False(result.Capabilities.CanAutoWriteBackAfterPrompt);
    }

    [Fact]
    public async Task CaptureSelectionContext_ClipboardCaptureDegradesMetadataConservatively()
    {
        var automation = new FakeSelectionContextAutomationFacade();
        var clipboard = new FakeClipboardTextService();
        clipboard.ReadSequence.Enqueue("old text");
        clipboard.ReadSequence.Enqueue("world");
        var clipboardCaptureService = new CaptureTextService(
            new FakeAutomationFacade(),
            clipboard,
            new FakeInputSimulationService
            {
                CopyResult = new InputSimulationResult(
                    HadPressedModifiers: false,
                    ModifierReleaseWaitMs: 0,
                    ModifierReleaseTimedOut: false)
            });
        var service = new CaptureSelectionContextService(
            automation,
            clipboardCaptureService);

        var result = await service.CaptureAsync("clipboard");

        Assert.True(result.Ok);
        Assert.Equal("clipboard", result.Method);
        Assert.Equal("world", result.Text);
        Assert.Equal("unknown", result.Anchor.Kind);
        Assert.Null(result.RestoreTargetToken);
        Assert.False(result.Capabilities.CanPositionPromptNearSelection);
        Assert.False(result.Capabilities.CanRestoreTargetAfterPrompt);
        Assert.False(result.Capabilities.CanAutoWriteBackAfterPrompt);
    }

    [Fact]
    public async Task CaptureSelectionContext_PreservesControlRectAndConservativeCapabilities()
    {
        var automation = new FakeSelectionContextAutomationFacade
        {
            Result = SelectionContextCaptureResult.Success(
                "uia",
                "world",
                new PromptAnchorSnapshot(
                    "control-rect",
                    20,
                    30,
                    90,
                    25),
                "hwnd:123",
                new SelectionContextCapabilitiesSnapshot(
                    CanPositionPromptNearSelection: true,
                    CanRestoreTargetAfterPrompt: true,
                    CanAutoWriteBackAfterPrompt: false),
                new JsonObject())
        };
        var service = new CaptureSelectionContextService(automation);

        var result = await service.CaptureAsync("uia");

        Assert.True(result.Ok);
        Assert.Equal("control-rect", result.Anchor.Kind);
        Assert.True(result.Capabilities.CanPositionPromptNearSelection);
        Assert.True(result.Capabilities.CanRestoreTargetAfterPrompt);
        Assert.False(result.Capabilities.CanAutoWriteBackAfterPrompt);
    }

    [Fact]
    public async Task CaptureSelectionContext_WindowRectDoesNotCountAsNearSelection()
    {
        var automation = new FakeSelectionContextAutomationFacade
        {
            Result = SelectionContextCaptureResult.Success(
                "uia",
                "world",
                new PromptAnchorSnapshot(
                    "window-rect",
                    100,
                    120,
                    500,
                    300),
                null,
                new SelectionContextCapabilitiesSnapshot(
                    CanPositionPromptNearSelection: false,
                    CanRestoreTargetAfterPrompt: false,
                    CanAutoWriteBackAfterPrompt: false),
                new JsonObject())
        };
        var service = new CaptureSelectionContextService(automation);

        var result = await service.CaptureAsync("uia");

        Assert.True(result.Ok);
        Assert.Equal("window-rect", result.Anchor.Kind);
        Assert.False(result.Capabilities.CanPositionPromptNearSelection);
    }

    [Fact]
    public void CaptureSelectionContext_ConvertsResultToHelperPayload()
    {
        var payload = SelectionContextCaptureResult.Success(
            "uia",
            "world",
            new PromptAnchorSnapshot(
                "control-rect",
                10,
                10,
                40,
                20,
                "display-1"),
            "hwnd:123",
            new SelectionContextCapabilitiesSnapshot(
                CanPositionPromptNearSelection: true,
                CanRestoreTargetAfterPrompt: true,
                CanAutoWriteBackAfterPrompt: false),
            new JsonObject
            {
                ["processName"] = "notepad"
            })
            .ToPayload();

        Assert.Equal("uia", payload["method"]?.GetValue<string>());
        Assert.Equal("world", payload["text"]?.GetValue<string>());
        Assert.Equal("control-rect", payload["anchor"]?["kind"]?.GetValue<string>());
        Assert.Equal(40, payload["anchor"]?["bounds"]?["width"]?.GetValue<int>());
        Assert.Equal("hwnd:123", payload["restoreTarget"]?["token"]?.GetValue<string>());
        Assert.Equal(true, payload["capabilities"]?["canRestoreTargetAfterPrompt"]?.GetValue<bool>());
        Assert.Equal(false, payload["capabilities"]?["canAutoWriteBackAfterPrompt"]?.GetValue<bool>());
        Assert.Equal("notepad", payload["diagnostics"]?["processName"]?.GetValue<string>());
    }

    [Fact]
    public async Task StdIoHost_RoutesCaptureSelectionContextRequests()
    {
        using var input = new StringReader("{\"id\":\"req-8\",\"kind\":\"capture-selection-context\",\"timestamp\":\"2026-03-20T00:00:00.000Z\",\"payload\":{\"method\":\"uia\"}}\n");
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
                new FakeInputSimulationService()),
            new CaptureSelectionContextService(
                new FakeSelectionContextAutomationFacade
                {
                    Result = SelectionContextCaptureResult.Success(
                        "uia",
                        "world",
                        new PromptAnchorSnapshot(
                            "control-rect",
                            20,
                            30,
                            90,
                            25),
                        "hwnd:123",
                        new SelectionContextCapabilitiesSnapshot(
                            CanPositionPromptNearSelection: true,
                            CanRestoreTargetAfterPrompt: true,
                            CanAutoWriteBackAfterPrompt: false),
                        new JsonObject())
                }));

        await host.RunAsync();

        var json = output.ToString();

        Assert.Contains("\"kind\":\"capture-selection-context\"", json);
        Assert.Contains("\"ok\":true", json);
        Assert.Contains("\"text\":\"world\"", json);
        Assert.Contains("\"kind\":\"control-rect\"", json);
        Assert.Contains("\"canAutoWriteBackAfterPrompt\":false", json);
    }
}

public sealed class FakeSelectionContextAutomationFacade : ISelectionContextAutomationFacade
{
    public SelectionContextCaptureResult Result { get; set; } =
        SelectionContextCaptureResult.Failure(
            "uia",
            "TEXT_CAPTURE_UNSUPPORTED",
            "No selection context is available.",
            new JsonObject());

    public SelectionContextCaptureResult CaptureSelectionContext() => Result;
}
