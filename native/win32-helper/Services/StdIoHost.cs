using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;
using TextBridge.Win32Helper.Protocols;

namespace TextBridge.Win32Helper.Services;

public sealed class StdIoHost
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    private readonly TextReader _input;
    private readonly TextWriter _output;
    private readonly Logger _logger;
    private readonly HealthCheckService _healthCheckService;
    private readonly CaptureTextService _captureTextService;
    private readonly WriteTextService _writeTextService;
    private readonly CaptureSelectionContextService? _captureSelectionContextService;
    private readonly RestoreTargetService? _restoreTargetService;

    public StdIoHost(
        TextReader input,
        TextWriter output,
        Logger logger,
        HealthCheckService healthCheckService,
        CaptureTextService captureTextService,
        WriteTextService writeTextService,
        CaptureSelectionContextService? captureSelectionContextService = null,
        RestoreTargetService? restoreTargetService = null)
    {
        _input = input;
        _output = output;
        _logger = logger;
        _healthCheckService = healthCheckService;
        _captureTextService = captureTextService;
        _writeTextService = writeTextService;
        _captureSelectionContextService = captureSelectionContextService;
        _restoreTargetService = restoreTargetService;
    }

    public async Task RunAsync(CancellationToken cancellationToken = default)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            string? line;

            try
            {
                line = await _input.ReadLineAsync(cancellationToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            if (line is null)
            {
                break;
            }

            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            HelperResponse? response;
            try
            {
                response = await TryHandleLineAsync(line, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                break;
            }

            if (response is null)
            {
                continue;
            }

            var json = JsonSerializer.Serialize(response, JsonOptions);
            await _output.WriteLineAsync(json);
            await _output.FlushAsync(cancellationToken);
        }
    }

    private async Task<HelperResponse?> TryHandleLineAsync(
        string line,
        CancellationToken cancellationToken)
    {
        HelperRequest? request = null;

        try
        {
            request = JsonSerializer.Deserialize<HelperRequest>(line, JsonOptions);
            if (request is null || string.IsNullOrWhiteSpace(request.Id) || string.IsNullOrWhiteSpace(request.Kind))
            {
                _logger.Warn("Received invalid request missing id or kind.");
                return HelperResponse.Failure("unknown", "invalid-request", "INVALID_REQUEST", "Request must include id and kind.");
            }

            return await HandleRequestAsync(request, cancellationToken);
        }
        catch (JsonException ex)
        {
            _logger.Error("Failed to parse request JSON.", ex);
            return HelperResponse.Failure("unknown", "invalid-request", "INVALID_JSON", "Request is not valid JSON.");
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.Error(
                $"Failed to handle request '{request?.Kind ?? "unknown-request"}' ({request?.Id ?? "unknown"}).",
                ex);
            return HelperResponse.Failure(
                request?.Id ?? "unknown",
                request?.Kind ?? "unknown-request",
                "INTERNAL_ERROR",
                $"Unhandled error while processing '{request?.Kind ?? "unknown-request"}'.");
        }
    }

    private async Task<HelperResponse> HandleRequestAsync(
        HelperRequest request,
        CancellationToken cancellationToken)
    {
        _logger.Debug($"Handling request '{request.Kind}' ({request.Id}).");

        if (string.Equals(request.Kind, "health-check", StringComparison.OrdinalIgnoreCase))
        {
            return HelperResponse.Success(
                request.Id,
                request.Kind,
                JsonSerializer.SerializeToNode(_healthCheckService.GetStatus(), JsonOptions)!.AsObject());
        }

        if (string.Equals(request.Kind, "capture-text", StringComparison.OrdinalIgnoreCase))
        {
            var method = TryGetMethod(request.Payload);
            if (string.IsNullOrWhiteSpace(method))
            {
                return HelperResponse.Failure(
                    request.Id,
                    request.Kind,
                    "INVALID_CAPTURE_METHOD",
                    "capture-text requests must include a method.");
            }

            var result = await _captureTextService.CaptureAsync(
                method,
                cancellationToken);
            var payload = result.ToPayload();

            return result.Ok
                ? HelperResponse.Success(request.Id, request.Kind, payload)
                : HelperResponse.Failure(
                    request.Id,
                    request.Kind,
                    result.ErrorCode ?? "TEXT_CAPTURE_UNSUPPORTED",
                    result.ErrorMessage ?? "Failed to capture text.",
                    payload);
        }

        if (string.Equals(request.Kind, "write-text", StringComparison.OrdinalIgnoreCase))
        {
            var method = TryGetMethod(request.Payload);
            var text = TryGetText(request.Payload);
            var expectedSourceText = TryGetOptionalString(request.Payload, "expectedSourceText");

            if (string.IsNullOrWhiteSpace(method) || text is null)
            {
                return HelperResponse.Failure(
                    request.Id,
                    request.Kind,
                    "INVALID_WRITE_REQUEST",
                    "write-text requests must include method and text.");
            }

            var result = await _writeTextService.WriteAsync(
                text,
                method,
                expectedSourceText,
                cancellationToken);
            var payload = result.ToPayload();

            return result.Ok
                ? HelperResponse.Success(request.Id, request.Kind, payload)
                : HelperResponse.Failure(
                    request.Id,
                    request.Kind,
                    result.ErrorCode ?? "WRITE_BACK_UNSUPPORTED",
                    result.ErrorMessage ?? "Failed to write translated text.",
                    payload);
        }

        if (string.Equals(request.Kind, "clipboard-write", StringComparison.OrdinalIgnoreCase))
        {
            var text = TryGetText(request.Payload);
            if (text is null)
            {
                return HelperResponse.Failure(
                    request.Id,
                    request.Kind,
                    "INVALID_CLIPBOARD_WRITE_REQUEST",
                    "clipboard-write requests must include text.");
            }

            var result = await _writeTextService.WriteAsync(
                text,
                "clipboard-write",
                null,
                cancellationToken);
            var payload = result.ToPayload();

            return result.Ok
                ? HelperResponse.Success(request.Id, request.Kind, payload)
                : HelperResponse.Failure(
                    request.Id,
                    request.Kind,
                    result.ErrorCode ?? "CLIPBOARD_WRITE_FAILED",
                    result.ErrorMessage ?? "Failed to write text to the clipboard.",
                    payload);
        }

        if (string.Equals(request.Kind, "capture-selection-context", StringComparison.OrdinalIgnoreCase))
        {
            var captureRequest = TryDeserializePayload<CaptureSelectionContextRequest>(request.Payload);
            if (captureRequest is null || string.IsNullOrWhiteSpace(captureRequest.Method))
            {
                return HelperResponse.Failure(
                    request.Id,
                    request.Kind,
                    "INVALID_CAPTURE_METHOD",
                    "capture-selection-context requests must include a method.");
            }

            if (_captureSelectionContextService is null)
            {
                return HelperResponse.Failure(
                    request.Id,
                    request.Kind,
                    "TEXT_CAPTURE_UNSUPPORTED",
                    "Selection-context capture is unavailable.");
            }

            var result = await _captureSelectionContextService.CaptureAsync(
                captureRequest.Method,
                cancellationToken);
            var payload = result.ToPayload();

            return result.Ok
                ? HelperResponse.Success(request.Id, request.Kind, payload)
                : HelperResponse.Failure(
                    request.Id,
                    request.Kind,
                    result.ErrorCode ?? "TEXT_CAPTURE_UNSUPPORTED",
                    result.ErrorMessage ?? "Failed to capture selection context.",
                    payload);
        }

        if (string.Equals(request.Kind, "restore-target", StringComparison.OrdinalIgnoreCase))
        {
            var restoreRequest = TryDeserializePayload<RestoreTargetRequest>(request.Payload);
            if (restoreRequest is null || string.IsNullOrWhiteSpace(restoreRequest.Token))
            {
                return HelperResponse.Failure(
                    request.Id,
                    request.Kind,
                    "INVALID_RESTORE_TARGET",
                    "restore-target requests must include a token.");
            }

            if (_restoreTargetService is null)
            {
                return HelperResponse.Failure(
                    request.Id,
                    request.Kind,
                    "RESTORE_TARGET_UNSUPPORTED",
                    "Restore-target requests are unavailable.");
            }

            var result = await _restoreTargetService.RestoreAsync(
                restoreRequest.Token,
                cancellationToken);
            var payload = result.ToPayload();

            return result.Ok
                ? HelperResponse.Success(request.Id, request.Kind, payload)
                : HelperResponse.Failure(
                    request.Id,
                    request.Kind,
                    result.ErrorCode ?? "RESTORE_TARGET_FAILED",
                    result.ErrorMessage ?? "Failed to restore the target window.",
                    payload);
        }

        return HelperResponse.Failure(
            request.Id,
            request.Kind,
            "UNSUPPORTED_REQUEST",
            $"Unsupported request kind '{request.Kind}'.");
    }

    private static string? TryGetMethod(JsonElement? payload)
    {
        if (payload is not { ValueKind: JsonValueKind.Object } payloadObject ||
            !payloadObject.TryGetProperty("method", out var methodProperty) ||
            methodProperty.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        return methodProperty.GetString();
    }

    private static string? TryGetText(JsonElement? payload)
    {
        return TryGetOptionalString(payload, "text");
    }

    private static string? TryGetOptionalString(JsonElement? payload, string propertyName)
    {
        if (payload is not { ValueKind: JsonValueKind.Object } payloadObject ||
            !payloadObject.TryGetProperty(propertyName, out var textProperty) ||
            textProperty.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        return textProperty.GetString();
    }

    private static TPayload? TryDeserializePayload<TPayload>(JsonElement? payload)
        where TPayload : class
    {
        if (payload is not { ValueKind: JsonValueKind.Object } payloadObject)
        {
            return null;
        }

        return JsonSerializer.Deserialize<TPayload>(
            payloadObject.GetRawText(),
            JsonOptions);
    }
}
