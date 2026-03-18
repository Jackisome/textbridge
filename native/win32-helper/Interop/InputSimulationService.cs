using System.Diagnostics;
using System.Runtime.InteropServices;

namespace TextBridge.Win32Helper.Interop;

public interface IInputSimulationService
{
    InputSimulationResult WaitForModifiersToBeReleased();
    InputSimulationResult SendCopyShortcut();
    InputSimulationResult SendPasteShortcut();
}

public sealed class InputSimulationService : IInputSimulationService
{
    private const ushort VirtualKeyControl = 0x11;
    private const ushort VirtualKeyShift = 0x10;
    private const ushort VirtualKeyMenu = 0x12;
    private const ushort VirtualKeyC = 0x43;
    private const ushort VirtualKeyV = 0x56;
    private const ushort VirtualKeyLeftWindows = 0x5B;
    private const ushort VirtualKeyRightWindows = 0x5C;
    private const uint InputKeyboard = 1;
    private const uint KeyEventKeyUp = 0x0002;
    private const short KeyStateDownMask = unchecked((short)0x8000);
    private static readonly ushort[] ModifierVirtualKeys =
    [
        VirtualKeyControl,
        VirtualKeyShift,
        VirtualKeyMenu,
        VirtualKeyLeftWindows,
        VirtualKeyRightWindows
    ];
    private static readonly TimeSpan ModifierReleaseTimeout = TimeSpan.FromMilliseconds(300);
    private static readonly TimeSpan ModifierPollInterval = TimeSpan.FromMilliseconds(10);

    public InputSimulationResult SendCopyShortcut()
    {
        return SendShortcut(VirtualKeyC);
    }

    public InputSimulationResult WaitForModifiersToBeReleased()
    {
        return WaitForModifiersToBeReleasedInternal();
    }

    public InputSimulationResult SendPasteShortcut()
    {
        return SendShortcut(VirtualKeyV);
    }

    private static InputSimulationResult SendShortcut(ushort virtualKey)
    {
        var simulationResult = WaitForModifiersToBeReleasedInternal();
        var inputs = new List<NativeInput>(ModifierVirtualKeys.Length + 4);

        foreach (var modifierVirtualKey in ModifierVirtualKeys)
        {
            inputs.Add(CreateKeyboardInput(modifierVirtualKey, keyUp: true));
        }

        inputs.Add(CreateKeyboardInput(VirtualKeyControl, keyUp: false));
        inputs.Add(CreateKeyboardInput(virtualKey, keyUp: false));
        inputs.Add(CreateKeyboardInput(virtualKey, keyUp: true));
        inputs.Add(CreateKeyboardInput(VirtualKeyControl, keyUp: true));

        var written = SendInput(
            (uint)inputs.Count,
            [.. inputs],
            Marshal.SizeOf<NativeInput>());

        if (written != inputs.Count)
        {
            var lastError = Marshal.GetLastWin32Error();
            throw new InvalidOperationException(
                $"Failed to send the keyboard shortcut. SendInput returned {written} for {inputs.Count} events (Win32Error={lastError}).");
        }

        return simulationResult;
    }

    private static InputSimulationResult WaitForModifiersToBeReleasedInternal()
    {
        var stopwatch = Stopwatch.StartNew();
        var hadPressedModifiers = AreAnyModifiersPressed();

        if (!hadPressedModifiers)
        {
            return new InputSimulationResult(
                HadPressedModifiers: false,
                ModifierReleaseWaitMs: 0,
                ModifierReleaseTimedOut: false);
        }

        while (stopwatch.Elapsed < ModifierReleaseTimeout)
        {
            Thread.Sleep(ModifierPollInterval);

            if (!AreAnyModifiersPressed())
            {
                return new InputSimulationResult(
                    HadPressedModifiers: true,
                    ModifierReleaseWaitMs: (int)stopwatch.ElapsedMilliseconds,
                    ModifierReleaseTimedOut: false);
            }
        }

        return new InputSimulationResult(
            HadPressedModifiers: true,
            ModifierReleaseWaitMs: (int)stopwatch.ElapsedMilliseconds,
            ModifierReleaseTimedOut: true);
    }

    private static bool AreAnyModifiersPressed()
    {
        foreach (var modifierVirtualKey in ModifierVirtualKeys)
        {
            if ((GetAsyncKeyState(modifierVirtualKey) & KeyStateDownMask) != 0)
            {
                return true;
            }
        }

        return false;
    }

    private static NativeInput CreateKeyboardInput(ushort virtualKey, bool keyUp)
    {
        return new NativeInput
        {
            Type = InputKeyboard,
            Data = new InputUnion
            {
                KeyboardInput = new KeyboardInput
                {
                    VirtualKey = virtualKey,
                    ScanCode = 0,
                    Flags = keyUp ? KeyEventKeyUp : 0,
                    Time = 0,
                    ExtraInfo = IntPtr.Zero
                }
            }
        };
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(
        uint numberOfInputs,
        [MarshalAs(UnmanagedType.LPArray)] NativeInput[] inputs,
        int sizeOfInputStructure);

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int virtualKey);

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeInput
    {
        public uint Type;
        public InputUnion Data;
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct InputUnion
    {
        [FieldOffset(0)]
        public MouseInput MouseInput;

        [FieldOffset(0)]
        public KeyboardInput KeyboardInput;

        [FieldOffset(0)]
        public HardwareInput HardwareInput;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KeyboardInput
    {
        public ushort VirtualKey;
        public ushort ScanCode;
        public uint Flags;
        public uint Time;
        public IntPtr ExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MouseInput
    {
        public int X;
        public int Y;
        public uint MouseData;
        public uint Flags;
        public uint Time;
        public IntPtr ExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct HardwareInput
    {
        public uint Message;
        public ushort ParamL;
        public ushort ParamH;
    }
}

public readonly record struct InputSimulationResult(
    bool HadPressedModifiers,
    int ModifierReleaseWaitMs,
    bool ModifierReleaseTimedOut);
