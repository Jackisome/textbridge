import { useState } from 'react';
import type { KeyboardEvent } from 'react';

import { buildShortcutActionFromKeyEvent } from '../features/shortcut-capture';

interface ShortcutCaptureInputProps {
  label: string;
  value: string;
  hint?: string;
  onChange: (value: string) => void;
}

export function ShortcutCaptureInput({
  label,
  value,
  hint = '点击输入框后直接按下组合键，Esc 取消，Backspace/Delete 清空。',
  onChange
}: ShortcutCaptureInputProps) {
  const [isRecording, setIsRecording] = useState(false);

  const displayValue = isRecording ? '按下组合键' : value || '点击后按下组合键';

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const action = buildShortcutActionFromKeyEvent(event);

    if (action.type === 'ignore') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (action.type === 'set') {
      onChange(action.value);
      setIsRecording(false);
      return;
    }

    if (action.type === 'clear') {
      onChange('');
      setIsRecording(false);
      return;
    }

    setIsRecording(false);
  }

  return (
    <div className="field shortcut-field">
      <span className="field-label">{label}</span>
      <button
        type="button"
        aria-label={label}
        className="shortcut-capture"
        data-recording={isRecording ? 'true' : 'false'}
        onFocus={() => setIsRecording(true)}
        onBlur={() => setIsRecording(false)}
        onKeyDown={handleKeyDown}
      >
        <span
          className={`shortcut-capture__value${
            !isRecording && value.length === 0 ? ' shortcut-capture__value--placeholder' : ''
          }`}
        >
          {displayValue}
        </span>
        <span className="shortcut-capture__meta">{isRecording ? '正在录制' : '点击录制'}</span>
      </button>
      <p className="field-hint">{hint}</p>
    </div>
  );
}
