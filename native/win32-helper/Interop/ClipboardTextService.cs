using System.Runtime.InteropServices;

namespace TextBridge.Win32Helper.Interop;

public interface IClipboardTextService
{
    string? ReadText();
    void WriteText(string text);
}

public sealed class ClipboardTextService : IClipboardTextService
{
    private const uint ClipboardFormatUnicodeText = 13;
    private const uint GlobalMoveable = 0x0002;

    public string? ReadText()
    {
        for (var attempt = 0; attempt < 5; attempt += 1)
        {
            if (!OpenClipboard(IntPtr.Zero))
            {
                Thread.Sleep(20);
                continue;
            }

            try
            {
                var handle = GetClipboardData(ClipboardFormatUnicodeText);
                if (handle == IntPtr.Zero)
                {
                    return null;
                }

                var pointer = GlobalLock(handle);
                if (pointer == IntPtr.Zero)
                {
                    return null;
                }

                try
                {
                    return Marshal.PtrToStringUni(pointer);
                }
                finally
                {
                    GlobalUnlock(handle);
                }
            }
            finally
            {
                CloseClipboard();
            }
        }

        return null;
    }

    public void WriteText(string text)
    {
        for (var attempt = 0; attempt < 5; attempt += 1)
        {
            if (!OpenClipboard(IntPtr.Zero))
            {
                Thread.Sleep(20);
                continue;
            }

            try
            {
                if (!EmptyClipboard())
                {
                    throw new InvalidOperationException("Failed to empty the clipboard.");
                }

                var bytes = (text.Length + 1) * sizeof(char);
                var globalHandle = GlobalAlloc(GlobalMoveable, (UIntPtr)bytes);
                if (globalHandle == IntPtr.Zero)
                {
                    throw new InvalidOperationException("Failed to allocate clipboard memory.");
                }

                var pointer = GlobalLock(globalHandle);
                if (pointer == IntPtr.Zero)
                {
                    throw new InvalidOperationException("Failed to lock clipboard memory.");
                }

                try
                {
                    Marshal.Copy(text.ToCharArray(), 0, pointer, text.Length);
                    Marshal.WriteInt16(pointer, text.Length * sizeof(char), 0);
                }
                finally
                {
                    GlobalUnlock(globalHandle);
                }

                if (SetClipboardData(ClipboardFormatUnicodeText, globalHandle) == IntPtr.Zero)
                {
                    throw new InvalidOperationException("Failed to set clipboard data.");
                }

                return;
            }
            finally
            {
                CloseClipboard();
            }
        }

        throw new InvalidOperationException("Failed to open the clipboard for writing.");
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool OpenClipboard(IntPtr newOwner);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool CloseClipboard();

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool EmptyClipboard();

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr GetClipboardData(uint format);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetClipboardData(uint format, IntPtr memoryHandle);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GlobalAlloc(uint flags, UIntPtr bytes);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GlobalLock(IntPtr handle);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GlobalUnlock(IntPtr handle);
}
