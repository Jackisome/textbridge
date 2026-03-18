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
            var automationFacade = new AutomationFacade();

            var host = new StdIoHost(
                Console.In,
                Console.Out,
                logger,
                new HealthCheckService(),
                new CaptureTextService(
                    automationFacade,
                    new ClipboardTextService(),
                    new InputSimulationService(),
                    focusedElementInspectionService: automationFacade),
                new WriteTextService(
                    new ClipboardTextService(),
                    new InputSimulationService(),
                    automationFacade,
                    automationFacade));

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
