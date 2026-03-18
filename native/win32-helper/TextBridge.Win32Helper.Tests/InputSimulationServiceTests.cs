using System.Reflection;
using System.Runtime.InteropServices;
using TextBridge.Win32Helper.Interop;
using Xunit;

namespace TextBridge.Win32Helper.Tests;

public sealed class InputSimulationServiceTests
{
    [Fact]
    public void Native_input_structure_matches_the_platform_sendinput_size()
    {
        var nativeInputType = typeof(InputSimulationService).GetNestedType(
            "NativeInput",
            BindingFlags.NonPublic);

        Assert.NotNull(nativeInputType);
        Assert.Equal(
            IntPtr.Size == 8 ? 40 : 28,
            Marshal.SizeOf(nativeInputType!));
    }
}
