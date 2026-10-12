import { AnimatePresence, motion } from 'motion/react';
import { AppIcon } from '../components/AppIcon';
import { figure } from '../assets';
import { DEMO, WEATHER_STATES } from '../content';
import { EASE } from '../motion';
import { TabBar } from './shared';

/** Today, reduced to the weather and the one look it leads to. */
export function WeatherScreen({ index }: { index: number }) {
  const w = WEATHER_STATES[index] ?? WEATHER_STATES[0]!;

  return (
    <div className="s">
      <div className="p">
        <div className="r sb end">
          <div className="col g8">
            <div className="la">{DEMO.date}</div>
            <div className="dl">Today</div>
          </div>
          <div className="cb av">{DEMO.initial}</div>
        </div>
      </div>

      <div className="p" style={{ gap: 14 }}>
        <div className="hl" />
        <div style={{ position: 'relative', height: 64 }}>
          <AnimatePresence initial={false}>
            <motion.div
              key={w.id}
              className="r"
              style={{ gap: 16, position: 'absolute', inset: 0 }}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <div className="dx">{w.temp}°</div>
              <div className="col g4 grow">
                <div className="r ti" style={{ gap: 8 }}>
                  <AppIcon name={w.icon} />
                  {w.condition}
                </div>
                <div className="se">{w.line}</div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="hl" />
      </div>

      <div className="p" style={{ gap: 14 }}>
        <div className="r sb">
          <div className="la">Today’s look</div>
          <div className="la">Everyday</div>
        </div>
        <div className="well" style={{ height: 326 }}>
          <AnimatePresence initial={false}>
            <motion.img
              key={w.id}
              src={figure(w.figure)}
              alt=""
              draggable={false}
              style={{ position: 'absolute', height: '92%', maxHeight: 'none', maxWidth: 'none' }}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.8, ease: EASE }}
            />
          </AnimatePresence>
        </div>
        <div className="txt-slot">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={w.id}
              className="col g4"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <div className="dm">{w.title}</div>
              <div className="se">{w.reason}</div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <TabBar active="today" />
    </div>
  );
}
