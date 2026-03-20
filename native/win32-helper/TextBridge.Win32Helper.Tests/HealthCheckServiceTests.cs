using System.Reflection;
using System.Text;
using System.Text.Json.Nodes;
using TextBridge.Win32Helper.Interop;
using TextBridge.Win32Helper.Services;
using Xunit;

namespace TextBridge.Win32Helper.Tests;

public sealed class BlockingTextReader : TextReader
{
    public override Task<string?> ReadLineAsync()
    {
        return new TaskCompletionSource<string?>().Task;
    }

    public override ValueTask<string?> ReadLineAsync(CancellationToken cancellationToken)
    {
        var source = new TaskCompletionSource<string?>();

        cancellationToken.Register(() => source.TrySetCanceled(cancellationToken));
        return new ValueTask<string?>(source.Task);
    }
}

public sealed class ThrowingAutomationFacade : IAutomationFacade
{
    public CaptureTextResult CaptureSelection()
    {
        throw new InvalidOperationException("Boom");
    }
}

public sealed class ThrowingTextWriter : TextWriter
{
    public override Encoding Encoding => Encoding.UTF8;

    public override void WriteLine(string? value)
    {
        throw new IOException("stderr is closed");
    }
}

public class HealthCheckServiceTests
{
    private static CaptureTextService CreateStubCaptureTextService()
    {
        return new CaptureTextService(
            new FakeAutomationFacade
            {
                Result = CaptureTextResult.Failure(
                    "uia",
                    "TEXT_CAPTURE_UNSUPPORTED",
                    "Stub capture service does not provide text.",
                    new JsonObject())
            },
            new FakeClipboardTextService(),
            new FakeInputSimulationService());
    }

    private static WriteTextService CreateStubWriteTextService()
    {
        return new WriteTextService(
            new FakeClipboardTextService(),
            new FakeInputSimulationService());
    }

    [Fact]
    public void Returns_version_and_capabilities()
    {
        var service = new HealthCheckService();
        var response = service.GetStatus();
        var expectedVersion =
            typeof(HealthCheckService).Assembly
                .GetCustomAttribute<AssemblyInformationalVersionAttribute>()
                ?.InformationalVersion
                ?.Split('+')[0];

        Assert.Equal("ok", response.Status);
        Assert.Equal(expectedVersion, response.Version);
        Assert.Contains("health-check", response.Capabilities);
        Assert.Contains("capture-text", response.Capabilities);
        Assert.Contains("write-text", response.Capabilities);
        Assert.Contains("clipboard-write", response.Capabilities);
        Assert.Contains("capture-selection-context", response.Capabilities);
        Assert.Contains("restore-target", response.Capabilities);
    }

    [Fact]
    public void Returns_isolated_capabilities_collections()
    {
        var service = new HealthCheckService();
        var first = service.GetStatus();
        var second = service.GetStatus();

        Assert.NotSame(first.Capabilities, second.Capabilities);

        var mutableFirst = Assert.IsType<string[]>(first.Capabilities);
        mutableFirst[0] = "mutated";

        Assert.Contains("health-check", second.Capabilities);
    }

    [Fact]
    public void Helper_response_payload_is_json_object()
    {
        var payloadProperty = typeof(TextBridge.Win32Helper.Protocols.HelperResponse)
            .GetProperty(nameof(TextBridge.Win32Helper.Protocols.HelperResponse.Payload));

        Assert.NotNull(payloadProperty);
        Assert.Equal(typeof(JsonObject), payloadProperty!.PropertyType);
    }

    [Fact]
    public async Task StdIoHost_returns_structured_health_check_response()
    {
        using var input = new StringReader("{\"id\":\"req-1\",\"kind\":\"health-check\",\"timestamp\":\"2026-03-10T00:00:00.000Z\",\"payload\":{}}\n");
        using var output = new StringWriter();
        using var logger = new Logger();
        var host = new StdIoHost(
            input,
            output,
            logger,
            new HealthCheckService(),
            CreateStubCaptureTextService(),
            CreateStubWriteTextService());

        await host.RunAsync();

        var json = output.ToString();

        Assert.Contains("\"id\":\"req-1\"", json);
        Assert.Contains("\"kind\":\"health-check\"", json);
        Assert.Contains("\"ok\":true", json);
        Assert.Contains("\"capabilities\":[\"health-check\",\"capture-text\",\"write-text\",\"clipboard-write\",\"capture-selection-context\",\"restore-target\"]", json);
        Assert.Contains("\"error\":null", json);
    }

    [Fact]
    public async Task StdIoHost_returns_structured_error_for_invalid_json()
    {
        using var input = new StringReader("{invalid json}\n");
        using var output = new StringWriter();
        using var logger = new Logger();
        var host = new StdIoHost(
            input,
            output,
            logger,
            new HealthCheckService(),
            CreateStubCaptureTextService(),
            CreateStubWriteTextService());

        await host.RunAsync();

        var json = output.ToString();

        Assert.Contains("\"kind\":\"invalid-request\"", json);
        Assert.Contains("\"ok\":false", json);
        Assert.Contains("\"payload\":{}", json);
        Assert.Contains("\"code\":\"INVALID_JSON\"", json);
    }

    [Fact]
    public async Task StdIoHost_routes_capture_text_requests()
    {
        var clipboard = new FakeClipboardTextService();
        clipboard.ReadSequence.Enqueue("old text");
        clipboard.ReadSequence.Enqueue("copied text");
        using var input = new StringReader("{\"id\":\"req-2\",\"kind\":\"capture-text\",\"timestamp\":\"2026-03-10T00:00:00.000Z\",\"payload\":{\"method\":\"clipboard\"}}\n");
        using var output = new StringWriter();
        using var logger = new Logger();
        var host = new StdIoHost(
            input,
            output,
            logger,
            new HealthCheckService(),
            new CaptureTextService(
                new FakeAutomationFacade(),
                clipboard,
                new FakeInputSimulationService()),
            CreateStubWriteTextService());

        await host.RunAsync();

        var json = output.ToString();

        Assert.Contains("\"kind\":\"capture-text\"", json);
        Assert.Contains("\"ok\":true", json);
        Assert.Contains("\"method\":\"clipboard\"", json);
        Assert.Contains("\"text\":\"copied text\"", json);
    }

    [Fact]
    public async Task StdIoHost_returns_structured_error_when_request_handler_throws()
    {
        using var input = new StringReader("{\"id\":\"req-3\",\"kind\":\"capture-text\",\"timestamp\":\"2026-03-10T00:00:00.000Z\",\"payload\":{\"method\":\"uia\"}}\n");
        using var output = new StringWriter();
        using var logger = new Logger();
        var host = new StdIoHost(
            input,
            output,
            logger,
            new HealthCheckService(),
            new CaptureTextService(
                new ThrowingAutomationFacade(),
                new FakeClipboardTextService(),
                new FakeInputSimulationService()),
            CreateStubWriteTextService());

        await host.RunAsync();

        var json = output.ToString();

        Assert.Contains("\"kind\":\"capture-text\"", json);
        Assert.Contains("\"ok\":false", json);
        Assert.Contains("\"code\":\"INTERNAL_ERROR\"", json);
    }

    [Fact]
    public async Task StdIoHost_respects_cancellation_while_waiting_for_input()
    {
        using var input = new BlockingTextReader();
        using var output = new StringWriter();
        using var logger = new Logger();
        using var cancellationTokenSource = new CancellationTokenSource(TimeSpan.FromMilliseconds(50));
        var host = new StdIoHost(
            input,
            output,
            logger,
            new HealthCheckService(),
            CreateStubCaptureTextService(),
            CreateStubWriteTextService());
        var runTask = host.RunAsync(cancellationTokenSource.Token);

        var completedTask = await Task.WhenAny(runTask, Task.Delay(TimeSpan.FromMilliseconds(250)));

        Assert.Same(runTask, completedTask);
        await runTask;
        Assert.Equal(string.Empty, output.ToString());
    }

    [Fact]
    public async Task StdIoHost_respects_cancellation_during_capture_processing()
    {
        using var input = new StringReader("{\"id\":\"req-5\",\"kind\":\"capture-text\",\"timestamp\":\"2026-03-10T00:00:00.000Z\",\"payload\":{\"method\":\"clipboard\"}}\n");
        using var output = new StringWriter();
        using var logger = new Logger();
        using var cancellationTokenSource = new CancellationTokenSource(TimeSpan.FromMilliseconds(50));
        var host = new StdIoHost(
            input,
            output,
            logger,
            new HealthCheckService(),
            new CaptureTextService(
                new FakeAutomationFacade(),
                new FakeClipboardTextService { Text = "copied text" },
                new FakeInputSimulationService(),
                TimeSpan.FromSeconds(5)),
            CreateStubWriteTextService());
        var runTask = host.RunAsync(cancellationTokenSource.Token);

        var completedTask = await Task.WhenAny(runTask, Task.Delay(TimeSpan.FromMilliseconds(250)));

        Assert.Same(runTask, completedTask);
        await runTask;
        Assert.Equal(string.Empty, output.ToString());
    }

    [Fact]
    public void Logger_does_not_throw_when_default_log_path_is_invalid()
    {
        Environment.SetEnvironmentVariable("TEXTBRIDGE_HELPER_LOG_PATH", "\0invalid");

        try
        {
            var exception = Record.Exception(() => Logger.CreateDefault());

            Assert.Null(exception);
        }
        finally
        {
            Environment.SetEnvironmentVariable("TEXTBRIDGE_HELPER_LOG_PATH", null);
        }
    }

    [Fact]
    public void Logger_swallows_stderr_write_failures()
    {
        using var logger = new Logger(logFilePath: null, errorWriter: new ThrowingTextWriter());

        var exception = Record.Exception(() => logger.Warn("test"));

        Assert.Null(exception);
    }
}
