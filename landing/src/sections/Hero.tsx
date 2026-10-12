import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Cta } from '../components/Cta';
import { Phone } from '../components/Phone';
import { Hanger } from '../components/Wordmark';
import { OCCASIONS } from '../content';
import { EASE, useAutoStep } from '../motion';
import { TodayScreen } from '../screens/TodayScreen';
import { WardrobeScreen } from '../screens/WardrobeScreen';

const LOOKS_PER_OCCASION = 3;

export function Hero() {
  const stage = useRef<HTMLDivElement>(null);
  const [step] = useAutoStep(stage, OCCASIONS.length * LOOKS_PER_OCCASION, 2800);
  const occasion = Math.floor(step / LOOKS_PER_OCCASION);
  const look = step % LOOKS_PER_OCCASION;

  const { scrollY } = useScroll();
  const yBack = useTransform(scrollY, [0, 900], [0, -90]);
  const yFront = useTransform(scrollY, [0, 900], [0, 30]);

  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 28, filter: 'blur(8px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 1, ease: EASE, delay },
  });

  return (
    <section className="hero" id="top">
      <div className="wrap hero__grid">
        <div className="hero__copy">
          <motion.p className="label hero__label" {...rise(0.05)}>
            <Hanger size={18} />
            The wardrobe app
          </motion.p>
          <motion.h1 className="display" {...rise(0.12)}>
            Your closet, dressed for <span className="it">today</span>.
          </motion.h1>
          <motion.p className="lede" {...rise(0.24)}>
            Photograph your clothes once. fitit. checks the weather where you are and puts together complete outfits
            from what you already own.
          </motion.p>
          <motion.div className="hero__actions" {...rise(0.34)}>
            <Cta />
            <a className="link" href="#how">
              See how it works
            </a>
          </motion.div>
          <motion.ul className="hero__facts" {...rise(0.46)}>
            <li>
              <span className="label">From</span>Your own clothes
            </li>
            <li>
              <span className="label">For</span>Today’s weather
            </li>
            <li>
              <span className="label">And</span>The occasion
            </li>
          </motion.ul>
        </div>

        <motion.div
          className="hero__stage"
          ref={stage}
          aria-hidden="true"
          initial={{ opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.3, ease: EASE, delay: 0.3 }}
        >
          <motion.div className="hero__back" style={{ y: yBack }}>
            <Phone>
              <WardrobeScreen />
            </Phone>
          </motion.div>
          <motion.div className="hero__front" style={{ y: yFront }}>
            <Phone>
              <TodayScreen occasion={occasion} look={look} />
            </Phone>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
