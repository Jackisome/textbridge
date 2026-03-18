using TextBridge.Win32Helper.Interop;
using Xunit;

namespace TextBridge.Win32Helper.Tests;

public sealed class NativeEditTextSnapshotTests
{
    [Fact]
    public void Creates_selection_snapshot_from_full_text_and_offsets()
    {
        var created = NativeEditTextSnapshot.TryCreate(
            "hello world!",
            selectionStart: 6,
            selectionEnd: 11,
            out var snapshot);

        Assert.True(created);
        Assert.Equal("hello world!", snapshot!.ValueText);
        Assert.Equal("hello ", snapshot.SelectionPrefixText);
        Assert.Equal("world", snapshot.SelectedText);
        Assert.Equal("!", snapshot.SelectionSuffixText);
    }

    [Fact]
    public void Rejects_invalid_selection_offsets()
    {
        var created = NativeEditTextSnapshot.TryCreate(
            "hello world!",
            selectionStart: 6,
            selectionEnd: 20,
            out var snapshot);

        Assert.False(created);
        Assert.Null(snapshot);
    }
}
