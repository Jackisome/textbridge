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
            var captureTextService = new CaptureTextService(
                automationFacade,
                new ClipboardTextService(),
                new InputSimulationService(),
                focusedElementInspectionService: automationFacade);
            var writeTextService = new WriteTextService(
                new ClipboardTextService(),
                new InputSimulationService(),
                automationFacade,
                automationFacade);
            var captureSelectionContextService = new CaptureSelectionContextService(
                automationFacade);
            var restoreTargetService = new RestoreTargetService(
                automationFacade);

            var host = new StdIoHost(
                Console.In,
                Console.Out,
                logger,
                new HealthCheckService(),
                captureTextService,
                writeTextService,
                captureSelectionContextService,
                restoreTargetService);

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
