export function LoadingOverlay() {
  return (
    <div className="loading-overlay" role="status" aria-label="翻译中" aria-live="polite">
      <div
        className="loading-overlay__spinner"
        data-testid="loading-overlay-spinner"
        aria-hidden="true"
      />
    </div>
  );
}
