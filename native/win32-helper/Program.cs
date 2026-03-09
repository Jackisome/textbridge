using TextBridge.Win32Helper.Interop;
using TextBridge.Win32Helper.Services;

namespace TextBridge.Win32Helper;

public static class Program
{
    public static async Task<int> Main()
    {
        using var logger = Logger.CreateDefault();

        try
        {
            logger.Info("Starting helper host.");

            var host = new StdIoHost(
                Console.In,
                Console.Out,
                logger,
                new HealthCheckService(),
                new CaptureTextService(
                    new AutomationFacade(),
                    new ClipboardTextService(),
                    new InputSimulationService()),
                new WriteTextService(
                    new ClipboardTextService(),
                    new InputSimulationService()));

            await host.RunAsync();

            logger.Info("Helper host stopped.");
            return 0;
        }
        catch (Exception ex)
        {
            logger.Error("Helper host terminated unexpectedly.", ex);
            return 1;
        }
    }
}
