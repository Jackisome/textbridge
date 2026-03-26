import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingOverlayPage } from './LoadingOverlayPage';

describe('LoadingOverlayPage', () => {
  it('marks the document as loading-overlay while mounted', () => {
    const { unmount } = render(<LoadingOverlayPage />);

    expect(document.documentElement.dataset.view).toBe('loading-overlay');
    expect(document.body.dataset.view).toBe('loading-overlay');
    expect(screen.getByRole('status', { name: '翻译中' })).not.toBeNull();

    unmount();

    expect(document.documentElement.dataset.view).not.toBe('loading-overlay');
    expect(document.body.dataset.view).not.toBe('loading-overlay');
  });
});
