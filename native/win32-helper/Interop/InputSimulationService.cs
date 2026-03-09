using System.Runtime.InteropServices;

namespace TextBridge.Win32Helper.Interop;

public interface IInputSimulationService
{
    void SendCopyShortcut();
    void SendPasteShortcut();
}

public sealed class InputSimulationService : IInputSimulationService
{
    private const ushort VirtualKeyControl = 0x11;
    private const ushort VirtualKeyC = 0x43;
    private const uint InputKeyboard = 1;
    private const uint KeyEventKeyUp = 0x0002;

    public void SendCopyShortcut()
    {
        SendShortcut(VirtualKeyC);
    }

    public void SendPasteShortcut()
    {
        SendShortcut(0x56);
    }

    private static void SendShortcut(ushort virtualKey)
    {
        var inputs = new[]
        {
            CreateKeyboardInput(VirtualKeyControl, keyUp: false),
            CreateKeyboardInput(virtualKey, keyUp: false),
            CreateKeyboardInput(virtualKey, keyUp: true),
            CreateKeyboardInput(VirtualKeyControl, keyUp: true)
        };

        var written = SendInput(
            (uint)inputs.Length,
            inputs,
            Marshal.SizeOf<NativeInput>());

        if (written != inputs.Length)
        {
            throw new InvalidOperationException("Failed to send the keyboard shortcut.");
        }
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
        public KeyboardInput KeyboardInput;
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
}
