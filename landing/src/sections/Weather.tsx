import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Phone } from '../components/Phone';
import { Reveal } from '../components/Reveal';
import { TextTabs } from '../components/TextTabs';
import { WEATHER_STATES } from '../content';
import { EASE, useAutoStep } from '../motion';
import { WeatherScreen } from '../screens/WeatherScreen';

export function Weather() {
  const stage = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState(false);
  const [index, setIndex] = useAutoStep(stage, WEATHER_STATES.length, 3600, held);
  const w = WEATHER_STATES[index] ?? WEATHER_STATES[0]!;

  const pick = (i: number) => {
    setHeld(true);
    setIndex(i);
  };

  return (
    <section className="section night weather" id="weather">
      <div className="wrap weather__grid">
        <Reveal className="weather__stage">
          <div ref={stage}>
            <Phone light>
              <WeatherScreen index={index} />
            </Phone>
          </div>
        </Reveal>
        <div className="weather__copy">
          <Reveal className="section-head">
            <p className="label">Weather</p>
            <h2 className="h2">
              Dressed for the <span className="it">weather</span>
            </h2>
            <p className="lede">
              Every morning fitit. reads the forecast for where you are. When the day changes, the outfit changes with
              it, and each look comes with one line that says why.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <TextTabs
              id="weather"
              label="Weather example"
              className="temps"
              index={index}
              onChange={pick}
              tabs={WEATHER_STATES.map((s) => (
                <>
                  <span className="label">{s.tab}</span>
                  <span className="temps__num">{s.temp}°</span>
                </>
              ))}
            />
            <div
              className="weather__panel"
              id="weather-panel"
              role="tabpanel"
              aria-labelledby={`weather-tab-${index}`}
              aria-live={held ? 'polite' : 'off'}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={w.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.4, ease: EASE }}
                >
                  <p className="label">{w.condition}</p>
                  <h3 className="h3">{w.title}</h3>
                  <p>{w.reason}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
