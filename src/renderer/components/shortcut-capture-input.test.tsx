import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { ShortcutCaptureInput } from './shortcut-capture-input';

function ShortcutCaptureHarness({ initialValue = 'Alt+Q' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);

  return <ShortcutCaptureInput label="快速翻译快捷键" value={value} onChange={setValue} />;
}

describe('ShortcutCaptureInput', () => {
  it('records a shortcut after the field is focused', async () => {
    const user = userEvent.setup();

    render(<ShortcutCaptureHarness />);

    const field = screen.getByRole('button', { name: '快速翻译快捷键' });

    await user.click(field);
    fireEvent.keyDown(field, { key: 'k', ctrlKey: true, shiftKey: true });

    expect(field.textContent).toContain('CommandOrControl+Shift+K');
    expect(field.textContent).toContain('点击录制');
  });

  it('clears the shortcut on Delete', async () => {
    const user = userEvent.setup();

    render(<ShortcutCaptureHarness />);

    const field = screen.getByRole('button', { name: '快速翻译快捷键' });

    await user.click(field);
    fireEvent.keyDown(field, { key: 'Delete' });

    expect(field.textContent).toContain('点击后按下组合键');
  });

  it('keeps the previous shortcut when recording is cancelled', async () => {
    const user = userEvent.setup();

    render(<ShortcutCaptureHarness initialValue="CommandOrControl+Shift+L" />);

    const field = screen.getByRole('button', { name: '快速翻译快捷键' });

    await user.click(field);
    fireEvent.keyDown(field, { key: 'Escape' });

    expect(field.textContent).toContain('CommandOrControl+Shift+L');
    expect(field.textContent).toContain('点击录制');
  });
});
