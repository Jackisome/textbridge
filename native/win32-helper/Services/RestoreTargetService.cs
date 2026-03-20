using System.Text.Json.Nodes;
using TextBridge.Win32Helper.Interop;

namespace TextBridge.Win32Helper.Services;

public sealed class RestoreTargetService
{
    private readonly IRestoreTargetAutomationFacade _automationFacade;

    public RestoreTargetService(
        IRestoreTargetAutomationFacade automationFacade)
    {
        _automationFacade = automationFacade;
    }

    public Task<RestoreTargetResult> RestoreAsync(
        string token,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (string.IsNullOrWhiteSpace(token))
        {
            return Task.FromResult(
                RestoreTargetResult.Failure(
                    restored: false,
                    errorCode: "INVALID_RESTORE_TARGET",
                    errorMessage: "restore-target requests must include a token.",
                    diagnostics: new JsonObject()));
        }

        return Task.FromResult(_automationFacade.RestoreTarget(token));
    }
}

public sealed record RestoreTargetResult(
    bool Ok,
    bool Restored,
    string? ErrorCode,
    string? ErrorMessage,
    JsonObject Diagnostics)
{
    public static RestoreTargetResult Success(
        bool restored,
        JsonObject diagnostics)
    {
        return new RestoreTargetResult(
            true,
            restored,
            null,
            null,
            CloneDiagnostics(diagnostics));
    }

    public static RestoreTargetResult Failure(
        bool restored,
        string errorCode,
        string errorMessage,
        JsonObject diagnostics)
    {
        return new RestoreTargetResult(
            false,
            restored,
            errorCode,
            errorMessage,
            CloneDiagnostics(diagnostics));
    }

    public JsonObject ToPayload()
    {
        return new JsonObject
        {
            ["restored"] = Restored,
            ["diagnostics"] = CloneDiagnostics(Diagnostics)
        };
    }

    private static JsonObject CloneDiagnostics(JsonObject diagnostics)
    {
        return diagnostics.DeepClone() as JsonObject ?? new JsonObject();
    }
}
