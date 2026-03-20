using System.Text.Json.Nodes;
using TextBridge.Win32Helper.Interop;
using TextBridge.Win32Helper.Services;
using Xunit;

namespace TextBridge.Win32Helper.Tests;

public sealed class RestoreTargetServiceTests
{
    [Fact]
    public async Task RestoreTarget_ReturnsRestoredTrueWhenWindowHandleCanBeReactivated()
    {
        var automation = new FakeRestoreTargetAutomationFacade
        {
            Result = RestoreTargetResult.Success(
                restored: true,
                new JsonObject
                {
                    ["requestedToken"] = "hwnd:123",
                    ["windowHandle"] = 123,
                    ["foregroundRestored"] = true
                })
        };
        var service = new RestoreTargetService(automation);

        var result = await service.RestoreAsync("hwnd:123");

        Assert.True(result.Ok);
        Assert.True(result.Restored);
        Assert.Null(result.ErrorCode);
        Assert.Equal("hwnd:123", result.Diagnostics["requestedToken"]?.GetValue<string>());
        Assert.Equal(123, result.Diagnostics["windowHandle"]?.GetValue<int>());
        Assert.Equal(true, result.Diagnostics["foregroundRestored"]?.GetValue<bool>());
    }

    [Fact]
    public void RestoreTarget_ConvertsResultToHelperPayload()
    {
        var payload = RestoreTargetResult.Success(
            restored: true,
            new JsonObject
            {
                ["requestedToken"] = "hwnd:123",
                ["foregroundRestored"] = true
            })
            .ToPayload();

        Assert.Equal(true, payload["restored"]?.GetValue<bool>());
        Assert.Equal("hwnd:123", payload["diagnostics"]?["requestedToken"]?.GetValue<string>());
        Assert.Equal(true, payload["diagnostics"]?["foregroundRestored"]?.GetValue<bool>());
    }

    [Fact]
    public async Task StdIoHost_RoutesRestoreTargetRequests()
    {
        using var input = new StringReader("{\"id\":\"req-9\",\"kind\":\"restore-target\",\"timestamp\":\"2026-03-20T00:00:00.000Z\",\"payload\":{\"token\":\"hwnd:123\"}}\n");
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
                new FakeSelectionContextAutomationFacade()),
            new RestoreTargetService(
                new FakeRestoreTargetAutomationFacade
                {
                    Result = RestoreTargetResult.Success(
                        restored: true,
                        new JsonObject
                        {
                            ["requestedToken"] = "hwnd:123",
                            ["foregroundRestored"] = true
                        })
                }));

        await host.RunAsync();

        var json = output.ToString();

        Assert.Contains("\"kind\":\"restore-target\"", json);
        Assert.Contains("\"ok\":true", json);
        Assert.Contains("\"restored\":true", json);
    }
}

public sealed class FakeRestoreTargetAutomationFacade : IRestoreTargetAutomationFacade
{
    public RestoreTargetResult Result { get; set; } =
        RestoreTargetResult.Failure(
            restored: false,
            errorCode: "RESTORE_TARGET_FAILED",
            errorMessage: "Failed to restore the target window.",
            diagnostics: new JsonObject());

    public RestoreTargetResult RestoreTarget(string token) => Result;
}
