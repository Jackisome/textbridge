import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ContextPopupPage } from './context-popup-page';

describe('ContextPopupPage', () => {
  it('submits the prompt from the Translate button', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    render(
      <ContextPopupPage
        sourceText="Original source text"
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText('Original source text')).not.toBeNull();

    const textarea = screen.getByLabelText('Instructions');
    await user.type(textarea, 'Use concise business English.');
    await user.click(screen.getByRole('button', { name: 'Translate' }));

    expect(onSubmit).toHaveBeenCalledWith('Use concise business English.');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels the prompt from the Cancel button', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    render(
      <ContextPopupPage
        sourceText="Original source text"
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText('Original source text')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ignores Enter while composing and submits after composition ends', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    render(
      <ContextPopupPage
        sourceText="Original source text"
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText('Original source text')).not.toBeNull();

    const textarea = screen.getByLabelText('Instructions');
    fireEvent.change(textarea, { target: { value: 'Need context' } });
    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true });

    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: false });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('Need context');
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  it('keeps Shift+Enter as a newline before submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    render(
      <ContextPopupPage
        sourceText="Original source text"
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText('Original source text')).not.toBeNull();

    const textarea = screen.getByLabelText('Instructions');
    await user.type(textarea, 'Line 1');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(textarea, 'Line 2');
    await user.click(screen.getByRole('button', { name: 'Translate' }));

    expect(onSubmit).toHaveBeenCalledWith('Line 1\nLine 2');
  });
});
