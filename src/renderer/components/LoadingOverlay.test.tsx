import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingOverlay } from './LoadingOverlay';

describe('LoadingOverlay', () => {
  it('renders a non-interactive status spinner', () => {
    render(<LoadingOverlay />);

    expect(screen.getByRole('status', { name: '翻译中' })).not.toBeNull();
    expect(screen.getByTestId('loading-overlay-spinner')).not.toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
