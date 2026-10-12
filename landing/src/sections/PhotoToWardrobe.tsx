import { useRef, useState } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';
import { Phone } from '../components/Phone';
import { SEQUENCE_STEPS } from '../content';
import { useAutoStep, useMediaQuery } from '../motion';
import { AddSequenceScreen } from '../screens/AddSequenceScreen';

const COUNT = SEQUENCE_STEPS.length;

/**
 * On a large screen the phone is pinned and the four steps follow the scroll. On a small screen, or with reduced
 * motion, the steps are stacked under the phone; it plays through them by itself until one is picked.
 */
export function PhotoToWardrobe() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const large = useMediaQuery('(min-width: 900px) and (min-height: 600px)');
  const reduced = useReducedMotion();
  const pinned = large && !reduced;

  const [held, setHeld] = useState(false);
  const [autoStep, setAutoStep] = useAutoStep(stage, COUNT, 3200, pinned || held);
  const [scrollStep, setScrollStep] = useState(0);

  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] });
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (pinned) setScrollStep(Math.min(COUNT - 1, Math.max(0, Math.floor(v * COUNT))));
  });

  const step = pinned ? scrollStep : autoStep;

  const select = (i: number) => {
    const el = section.current;
    if (pinned && el) {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const span = el.offsetHeight - window.innerHeight;
      window.scrollTo({ top: top + (span * (i + 0.5)) / COUNT, behavior: 'smooth' });
    } else {
      setHeld(true);
      setAutoStep(i);
    }
  };

  return (
    <section className={pinned ? 'seq seq--pinned' : 'seq'} id="wardrobe" ref={section}>
      <div className="seq__pin">
        <div className="wrap seq__grid">
          <div className="seq__copy">
            <div className="section-head">
              <p className="label">Add your clothes</p>
              <h2 className="h2">
                From photo to <span className="it">wardrobe</span>
              </h2>
            </div>
            <div className="seq__list">
              {pinned && (
                <span className="seq__track" aria-hidden="true">
                  <motion.i style={{ scaleY: scrollYProgress }} />
                </span>
              )}
              <ol>
                {SEQUENCE_STEPS.map((s, i) => (
                  <li key={s.title} className={i === step ? 'seq__step is-on' : 'seq__step'}>
                    <button type="button" onClick={() => select(i)} aria-current={i === step ? 'step' : undefined}>
                      <span className="label">{String(i + 1).padStart(2, '0')}</span>
                      <span className="seq__title">{s.title}</span>
                    </button>
                    <div className="seq__body">
                      <p>{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className="seq__stage" ref={stage}>
            <Phone>
              <AddSequenceScreen step={step} />
            </Phone>
          </div>
        </div>
      </div>
    </section>
  );
}
