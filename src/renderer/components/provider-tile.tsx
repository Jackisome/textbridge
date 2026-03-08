import type { ProviderMetadata } from '../../shared/constants/provider-metadata';

interface ProviderTileProps {
  metadata: ProviderMetadata;
  isActive: boolean;
  onSelect: () => void;
}

const categoryLabels: Record<ProviderMetadata['category'], string> = {
  llm: 'LLM',
  'machine-translation': '机器翻译',
  debug: '调试'
};

export function ProviderTile({ metadata, isActive, onSelect }: ProviderTileProps) {
  return (
    <button
      type="button"
      className={`provider-tile${isActive ? ' provider-tile--active' : ''}`}
      onClick={onSelect}
      aria-pressed={isActive}
    >
      <span className="provider-tile__topline">
        <strong>{metadata.label}</strong>
        <span className="provider-tile__badge">{categoryLabels[metadata.category]}</span>
      </span>
      <span className="provider-tile__copy">{metadata.description}</span>
    </button>
  );
}
