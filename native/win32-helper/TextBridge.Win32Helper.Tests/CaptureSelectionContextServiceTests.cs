using System.Text.Json.Nodes;
using TextBridge.Win32Helper.Interop;
using TextBridge.Win32Helper.Services;
using Xunit;

namespace TextBridge.Win32Helper.Tests;

public sealed class CaptureSelectionContextServiceTests
{
    [Fact]
    public async Task CaptureSelectionContext_ReturnsSelectionRectAndRestoreToken()
    {
        var automation = new FakeSelectionContextAutomationFacade
        {
            Result = SelectionContextCaptureResult.Success(
                "uia",
                "world",
                new PromptAnchorSnapshot(
                    "selection-rect",
                    10,
                    10,
                    40,
                    20,
                    "display-1"),
                "hwnd:123",
                SelectionContextCapabilitiesSnapshot.Full,
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
        Assert.Equal("selection-rect", result.Anchor.Kind);
        Assert.Equal(10, result.Anchor.Bounds?.X);
        Assert.Equal(20, result.Anchor.Bounds?.Height);
        Assert.Equal("display-1", result.Anchor.DisplayId);
        Assert.Equal("hwnd:123", result.RestoreTargetToken);
        Assert.True(result.Capabilities.CanPositionPromptNearSelection);
        Assert.True(result.Capabilities.CanRestoreTargetAfterPrompt);
        Assert.True(result.Capabilities.CanAutoWriteBackAfterPrompt);
    }

    [Fact]
    public void CaptureSelectionContext_ConvertsResultToHelperPayload()
    {
        var payload = SelectionContextCaptureResult.Success(
            "uia",
            "world",
            new PromptAnchorSnapshot(
                "selection-rect",
                10,
                10,
                40,
                20,
                "display-1"),
            "hwnd:123",
            SelectionContextCapabilitiesSnapshot.Full,
            new JsonObject
            {
                ["processName"] = "notepad"
            })
            .ToPayload();

        Assert.Equal("uia", payload["method"]?.GetValue<string>());
        Assert.Equal("world", payload["text"]?.GetValue<string>());
        Assert.Equal("selection-rect", payload["anchor"]?["kind"]?.GetValue<string>());
        Assert.Equal(40, payload["anchor"]?["bounds"]?["width"]?.GetValue<int>());
        Assert.Equal("hwnd:123", payload["restoreTarget"]?["token"]?.GetValue<string>());
        Assert.Equal(true, payload["capabilities"]?["canRestoreTargetAfterPrompt"]?.GetValue<bool>());
        Assert.Equal("notepad", payload["diagnostics"]?["processName"]?.GetValue<string>());
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
