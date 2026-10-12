import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { Phone } from '../components/Phone';
import { Reveal } from '../components/Reveal';
import { PALETTE } from '../content';
import { EASE } from '../motion';
import { PaletteScreen } from '../screens/PaletteScreen';

export function Colors() {
  const stage = useRef<HTMLDivElement>(null);
  const shown = useInView(stage, { once: true, amount: 0.4 });

  return (
    <section className="section colors" id="colors">
      <div className="wrap colors__grid">
        <Reveal className="colors__stage">
          <div ref={stage}>
            <Phone height={800}>
              <PaletteScreen shown={shown} />
            </Phone>
          </div>
        </Reveal>
        <div className="colors__copy">
          <Reveal className="section-head">
            <p className="label">Color analysis</p>
            <h2 className="h2">
              Your <span className="it">colors</span>, from one selfie
            </h2>
            <p className="lede">
              Take a selfie in daylight and fitit. suggests a palette: the shades to wear more of, and a few to wear
              less of. It leans on them every time it picks an outfit.
            </p>
          </Reveal>
          <ul className="colors__strip" aria-label={`Example palette: ${PALETTE.season}`}>
            {PALETTE.more.map((c, i) => (
              <motion.li
                key={c.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '0px 0px -10% 0px' }}
                transition={{ duration: 0.8, ease: EASE, delay: i * 0.06 }}
              >
                <span className="colors__bar" style={{ background: c.hex }} />
                <span className="label">{c.name}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
