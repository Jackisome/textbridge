import { useEffect } from 'react';
import { LoadingOverlay } from '../components/LoadingOverlay';

export function LoadingOverlayPage() {
  useEffect(() => {
    document.documentElement.dataset.view = 'loading-overlay';
    document.body.dataset.view = 'loading-overlay';

    return () => {
      delete document.documentElement.dataset.view;
      delete document.body.dataset.view;
    };
  }, []);

  return (
    <main className="loading-overlay-page">
      <LoadingOverlay />
    </main>
  );
}
