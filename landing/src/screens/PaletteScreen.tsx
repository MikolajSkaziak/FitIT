import { motion } from 'motion/react';
import { AppIcon } from '../components/AppIcon';
import { PALETTE } from '../content';
import { EASE } from '../motion';

/** The palette found from a selfie. Swatches stagger in once `shown` is true. */
export function PaletteScreen({ shown }: { shown: boolean }) {
  const swatch = (i: number) => ({
    initial: { opacity: 0, y: 14, scale: 0.9 },
    animate: shown ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 14, scale: 0.9 },
    transition: { duration: 0.7, ease: EASE, delay: 0.25 + i * 0.07 },
  });

  return (
    <div className="s">
      <div className="prog">
        <i style={{ width: '77%' }} />
      </div>
      <div className="p g10">
        <div className="la">Your colors</div>
        <div className="dl">{PALETTE.season}</div>
        <div className="mu">{PALETTE.line}</div>
      </div>
      <div className="p">
        <div className="r la" style={{ gap: 6 }}>
          <AppIcon name="palette" size="sm" />
          Wear more of
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px 13px' }}>
          {PALETTE.more.map((c, i) => (
            <motion.div key={c.name} className="col g6 ca ctr" {...swatch(i)}>
              <div className="sw" style={{ background: c.hex }} />
              {c.name}
            </motion.div>
          ))}
        </div>
      </div>
      <div className="p">
        <div className="la">Wear less of</div>
        <div className="r" style={{ gap: 13 }}>
          {PALETTE.less.map((c, i) => (
            <motion.div key={c.name} className="col g6 ca ctr mu" {...swatch(PALETTE.more.length + i)}>
              <div className="sw" style={{ background: c.hex, height: 48, width: 78 }} />
              {c.name}
            </motion.div>
          ))}
        </div>
      </div>
      <div className="foot">
        <div className="btn">Continue</div>
        <div className="lnk">Retake the selfie</div>
      </div>
    </div>
  );
}
