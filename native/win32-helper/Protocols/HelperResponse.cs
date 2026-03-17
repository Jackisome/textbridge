using System.Text.Json.Nodes;

namespace TextBridge.Win32Helper.Protocols;

public sealed class HelperResponse
{
    public string Id { get; init; } = string.Empty;

    public string Kind { get; init; } = string.Empty;

    public bool Ok { get; init; }

    public JsonObject? Payload { get; init; }

    public HelperError? Error { get; init; }

    public static HelperResponse Success(string id, string kind, JsonObject payload)
    {
        return new HelperResponse
        {
            Id = id,
            Kind = kind,
            Ok = true,
            Payload = payload
        };
    }

    public static HelperResponse Failure(
        string id,
        string kind,
        string code,
        string message,
        JsonObject? payload = null)
    {
        return new HelperResponse
        {
            Id = id,
            Kind = kind,
            Ok = false,
            Payload = payload ?? new JsonObject(),
            Error = new HelperError
            {
                Code = code,
                Message = message
            }
        };
    }
}

public sealed class HelperError
{
    public string Code { get; init; } = string.Empty;

    public string Message { get; init; } = string.Empty;
}
