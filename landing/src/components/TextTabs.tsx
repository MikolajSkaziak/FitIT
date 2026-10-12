import { useRef, type KeyboardEvent, type ReactNode } from 'react';

type Props = {
  /** Prefix of the element ids: tab `${id}-tab-${i}` controls panel `${id}-panel`. */
  id: string;
  label: string;
  tabs: readonly ReactNode[];
  index: number;
  onChange: (index: number) => void;
  className?: string;
};

/** The app's text tabs with a green underline, as a keyboard-operable tablist (arrows, Home, End). */
export function TextTabs({ id, label, tabs, index, onChange, className }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent) => {
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div className={['ttabs', className].filter(Boolean).join(' ')} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab, i) => (
        <button
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          id={`${id}-tab-${i}`}
          className="ttab"
          aria-selected={i === index}
          aria-controls={`${id}-panel`}
          tabIndex={i === index ? 0 : -1}
          onClick={() => onChange(i)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
