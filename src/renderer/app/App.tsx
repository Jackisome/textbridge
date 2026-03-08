import { ContextPopupPage } from '../pages/context-popup-page';
import { FallbackResultPage } from '../pages/fallback-result-page';
import { SettingsPage } from '../pages/settings-page';

export default function App() {
  const { electronInfo } = window;
  const view = new URLSearchParams(window.location.search).get('view');

  if (view === 'context-popup') {
    return <ContextPopupPage />;
  }

  if (view === 'fallback-result') {
    return <FallbackResultPage />;
  }

  return <SettingsPage electronInfo={electronInfo} />;
}
