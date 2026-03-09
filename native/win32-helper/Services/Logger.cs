using System.IO;

namespace TextBridge.Win32Helper.Services;

public sealed class Logger : IDisposable
{
    private readonly object _sync = new();
    private readonly string? _logFilePath;
    private readonly TextWriter _errorWriter;

    public Logger(string? logFilePath = null, TextWriter? errorWriter = null)
    {
        _logFilePath = string.IsNullOrWhiteSpace(logFilePath) ? null : logFilePath;
        _errorWriter = errorWriter ?? Console.Error;
    }

    public static Logger CreateDefault()
    {
        var configuredPath = Environment.GetEnvironmentVariable("TEXTBRIDGE_HELPER_LOG_PATH");
        var fallbackPath = Path.Combine(AppContext.BaseDirectory, "logs", "win32-helper.log");
        return new Logger(string.IsNullOrWhiteSpace(configuredPath) ? fallbackPath : configuredPath);
    }

    public void Debug(string message)
    {
        Write("debug", message);
    }

    public void Info(string message)
    {
        Write("info", message);
    }

    public void Warn(string message)
    {
        Write("warn", message);
    }

    public void Error(string message, Exception? exception = null)
    {
        Write("error", message, exception);
    }

    public void Dispose()
    {
    }

    private void Write(string level, string message, Exception? exception = null)
    {
        var suffix = exception is null ? string.Empty : $" {exception}";
        var line = $"{DateTimeOffset.UtcNow:O} [{level}] {message}{suffix}";

        lock (_sync)
        {
            SafeWriteToError(line);

            if (_logFilePath is null)
            {
                return;
            }

            try
            {
                var directory = Path.GetDirectoryName(_logFilePath);
                if (!string.IsNullOrWhiteSpace(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                File.AppendAllText(_logFilePath, line + Environment.NewLine);
            }
            catch
            {
                SafeWriteToError($"{DateTimeOffset.UtcNow:O} [warn] Failed to append helper log file.");
            }
        }
    }

    private void SafeWriteToError(string line)
    {
        try
        {
            _errorWriter.WriteLine(line);
        }
        catch
        {
        }
    }
}
