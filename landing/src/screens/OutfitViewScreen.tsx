import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AppIcon } from '../components/AppIcon';
import { Collage } from '../components/Collage';
import { figure, photos } from '../assets';
import { OUTFIT_VIEWS, OUTFIT_VIEW_PIECES } from '../content';
import { EASE } from '../motion';

/** How long the "generating" shimmer is shown before the try-on picture resolves. */
const GENERATING_MS = 1500;

function TryOn() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), GENERATING_MS);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="tryon">
      <motion.img
        src={photos.tryon}
        alt=""
        draggable={false}
        initial={false}
        animate={{ opacity: ready ? 1 : 0, scale: ready ? 1 : 1.04 }}
        transition={{ duration: 0.9, ease: EASE }}
      />
      <AnimatePresence>
        {!ready && (
          <motion.div key="shimmer" className="shimmer" exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: EASE }}>
            <AppIcon name="sparkle" size="lg" />
            <div className="la">Generating</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** One outfit, three ways to look at it: collage, on a figure, AI try-on. */
export function OutfitViewScreen({ index }: { index: number }) {
  const view = OUTFIT_VIEWS[index] ?? OUTFIT_VIEWS[0];

  return (
    <div className="s t0" style={{ gap: 20 }}>
      <div className="hero" style={{ height: 468 }}>
        <AnimatePresence initial={false}>
          <motion.div
            key={view.id}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            {view.id === 'collage' && (
              <div style={{ position: 'absolute', left: 30, right: 30, top: 104, bottom: 40 }}>
                <Collage pieces={OUTFIT_VIEW_PIECES} />
              </div>
            )}
            {view.id === 'figure' && (
              <motion.img
                src={figure('fit-1')}
                alt=""
                draggable={false}
                style={{ height: 372, marginTop: 56 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: EASE }}
              />
            )}
            {view.id === 'tryon' && <TryOn />}
          </motion.div>
        </AnimatePresence>
        <div className="cb abs">
          <AppIcon name="back" />
        </div>
        <div className="cb abs rt">
          <AppIcon name="bookmark" />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view.id}
            className="care bl"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {view.id === 'tryon' && <AppIcon name="sparkle" size="xs" className="gr" />}
            {view.care}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="tabs">
        {OUTFIT_VIEWS.map((v, i) => (
          <div key={v.id} className={i === index ? 'tab on' : 'tab'}>
            {v.tab}
          </div>
        ))}
      </div>

      <div className="p g6">
        <div className="dl">Easy everyday</div>
        <div className="mu">A white tee, blue jeans and white sneakers. Light enough for 24°.</div>
        <div className="r ca mu" style={{ gap: 6 }}>
          <AppIcon name="sun" size="sm" />
          24° today, clear and warm
        </div>
      </div>

      <div className="foot row2">
        <div className="btn">
          <AppIcon name="check" />
          Wear this today
        </div>
        <div className="btn sec">
          <AppIcon name="sparkle" />
          Try it on
        </div>
      </div>
    </div>
  );
}
