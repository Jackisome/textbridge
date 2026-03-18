namespace TextBridge.Win32Helper.Interop;

public sealed record NativeEditTextSnapshot(
    string ValueText,
    string SelectedText,
    string SelectionPrefixText,
    string SelectionSuffixText)
{
    public static bool TryCreate(
        string valueText,
        int selectionStart,
        int selectionEnd,
        out NativeEditTextSnapshot? snapshot)
    {
        snapshot = null;

        if (selectionStart < 0 || selectionEnd < selectionStart || selectionEnd > valueText.Length)
        {
            return false;
        }

        snapshot = new NativeEditTextSnapshot(
            ValueText: valueText,
            SelectionPrefixText: valueText[..selectionStart],
            SelectedText: valueText[selectionStart..selectionEnd],
            SelectionSuffixText: valueText[selectionEnd..]);
        return true;
    }
}
