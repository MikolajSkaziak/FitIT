import type { CSSProperties, ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Height of the screen in points, at 393 points wide. */
  height?: number;
  light?: boolean;
  className?: string;
};

/**
 * A phone: an outer shell and an inner screen with concentric corners. Purely illustrative, so it is hidden from
 * assistive technology; the meaning is carried by the text next to it.
 */
export function Phone({ children, height = 852, light = false, className }: Props) {
  return (
    <div
      className={['phone', light ? 'phone--light' : '', className].filter(Boolean).join(' ')}
      style={{ '--ph': height } as CSSProperties}
      aria-hidden="true"
      inert
    >
      <div className="phone__screen">
        <div className="phone__canvas app">
          {children}
          <div className="phone__status">
            <span>9:41</span>
            <i className="phone__island" />
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <span className="phone__signal">
                <i style={{ height: 4 }} />
                <i style={{ height: 6 }} />
                <i style={{ height: 9 }} />
                <i style={{ height: 12 }} />
              </span>
              <span className="phone__battery">
                <i />
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
