using System.Reflection;

namespace TextBridge.Win32Helper.Services;

public sealed class HealthCheckService
{
    private static readonly string[] Capabilities =
    [
        "health-check",
        "capture-text",
        "write-text",
        "clipboard-write",
        "capture-selection-context",
        "restore-target"
    ];

    private static readonly string Version =
        typeof(HealthCheckService).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()
            ?.InformationalVersion
            ?.Split('+')[0]
        ?? typeof(HealthCheckService).Assembly.GetName().Version?.ToString()
        ?? "0.0.0";

    public HealthCheckStatus GetStatus()
    {
        return new HealthCheckStatus(
            "ok",
            Version,
            Capabilities.ToArray());
    }
}

public sealed record HealthCheckStatus(
    string Status,
    string Version,
    IReadOnlyList<string> Capabilities);
