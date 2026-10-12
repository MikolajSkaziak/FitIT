import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Phone } from '../components/Phone';
import { Reveal } from '../components/Reveal';
import { TextTabs } from '../components/TextTabs';
import { OUTFIT_VIEWS } from '../content';
import { EASE, useAutoStep } from '../motion';
import { OutfitViewScreen } from '../screens/OutfitViewScreen';

export function SeeItOnYou() {
  const stage = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState(false);
  const [index, setIndex] = useAutoStep(stage, OUTFIT_VIEWS.length, 4400, held);
  const view = OUTFIT_VIEWS[index] ?? OUTFIT_VIEWS[0];

  const pick = (i: number) => {
    setHeld(true);
    setIndex(i);
  };

  return (
    <section className="section see" id="try-on">
      <div className="wrap see__grid">
        <div className="see__copy">
          <Reveal className="section-head">
            <p className="label">Three views</p>
            <h2 className="h2">
              See it on <span className="it">you</span>
            </h2>
            <p className="lede">
              A list of clothes is hard to picture. So every outfit can be seen three ways, from a quick collage to a
              picture of it being worn.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <TextTabs
              id="views"
              label="Outfit view"
              index={index}
              onChange={pick}
              tabs={OUTFIT_VIEWS.map((v) => v.tab)}
            />
            <div
              className="see__panel"
              id="views-panel"
              role="tabpanel"
              aria-labelledby={`views-tab-${index}`}
              aria-live={held ? 'polite' : 'off'}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={view.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.4, ease: EASE }}
                >
                  <h3 className="h3">{view.title}</h3>
                  <p>{view.body}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </Reveal>
        </div>
        <Reveal className="see__stage">
          <div className="see__well" aria-hidden="true" />
          <div ref={stage}>
            <Phone>
              <OutfitViewScreen index={index} />
            </Phone>
          </div>
          <span className="care-tag care-tag--float see__tag" aria-hidden="true">
            Same outfit · three views
          </span>
        </Reveal>
      </div>
    </section>
  );
}
