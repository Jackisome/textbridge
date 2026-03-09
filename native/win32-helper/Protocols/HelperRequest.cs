using System.Text.Json;

namespace TextBridge.Win32Helper.Protocols;

public sealed class HelperRequest
{
    public string Id { get; init; } = string.Empty;

    public string Kind { get; init; } = string.Empty;

    public string Timestamp { get; init; } = string.Empty;

    public JsonElement? Payload { get; init; }
}
