import { AnimatePresence, motion } from 'motion/react';
import { AppIcon } from '../components/AppIcon';
import { DEMO, HERO_WEATHER, OCCASIONS } from '../content';
import { EASE } from '../motion';
import { LookArt, TabBar } from './shared';

const ITEM = 292 + 12;

/** The Today screen: greeting, weather, occasion tabs and the carousel of three looks. */
export function TodayScreen({ occasion, look }: { occasion: number; look: number }) {
  const current = OCCASIONS[occasion] ?? OCCASIONS[0]!;
  const shown = current.looks[look] ?? current.looks[0];

  return (
    <div className="s">
      <div className="p">
        <div className="r sb end">
          <div className="col g8">
            <div className="la">{DEMO.date}</div>
            <div className="dl">
              Good morning,
              <br />
              <span className="ital gr">{DEMO.name}</span>
            </div>
          </div>
          <div className="cb av">{DEMO.initial}</div>
        </div>
      </div>

      <div className="p" style={{ gap: 14 }}>
        <div className="hl" />
        <div className="r" style={{ gap: 16 }}>
          <div className="dx">{HERO_WEATHER.temp}</div>
          <div className="col g4 grow">
            <div className="r ti" style={{ gap: 8 }}>
              <AppIcon name="rain" />
              {HERO_WEATHER.condition}
            </div>
            <div className="se">{HERO_WEATHER.line}</div>
          </div>
        </div>
        <div className="hl" />
      </div>

      <div className="tabs">
        {OCCASIONS.map((o, i) => (
          <div key={o.label} className={i === occasion ? 'tab on' : 'tab'}>
            <AppIcon name={o.icon} size="sm" />
            {o.label}
          </div>
        ))}
      </div>

      <div className="col" style={{ gap: 14 }}>
        <div className="p">
          <div className="r sb">
            <div className="la">Today’s looks</div>
            <div className="la">{look + 1} / 3</div>
          </div>
        </div>
        <div className="car">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={occasion}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <motion.div
                className="car__track"
                initial={false}
                animate={{ x: -look * ITEM }}
                transition={{ duration: 1, ease: EASE }}
              >
                {current.looks.map((l, i) => (
                  <motion.div
                    key={l.title}
                    className="well car__item"
                    initial={false}
                    animate={{ opacity: i === look ? 1 : 0.6 }}
                    transition={{ duration: 0.8, ease: EASE }}
                  >
                    <div className="care">{l.tag}</div>
                    <LookArt art={l.art} />
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="p txt-slot">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${occasion}-${look}`}
              className="col g4"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <div className="dm">{shown.title}</div>
              <div className="se">{shown.reason}</div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <TabBar active="today" />
    </div>
  );
}
