import { useEffect, useState } from 'react';
import { RuntimeStatusPanel } from '../features/runtime-status/runtime-status-panel';
import { ContextPopupPage } from '../pages/context-popup-page';
import { FallbackResultPage } from '../pages/fallback-result-page';
import { SettingsPage } from '../pages/settings-page';
import type { RuntimeStatus } from '../../shared/types/ipc';

export default function App() {
  const { electronInfo } = window;
  const view = new URLSearchParams(window.location.search).get('view');
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);

  useEffect(() => {
    let active = true;

    void window.textBridge.getRuntimeStatus().then((status) => {
      if (active) {
        setRuntimeStatus(status);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  if (view === 'context-popup') {
    return <ContextPopupPage />;
  }

  if (view === 'fallback-result') {
    return <FallbackResultPage />;
  }

  return (
    <SettingsPage
      electronInfo={electronInfo}
      runtimePanel={<RuntimeStatusPanel runtimeStatus={runtimeStatus} />}
    />
  );
}
