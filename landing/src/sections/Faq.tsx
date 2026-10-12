import { useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import { Reveal } from '../components/Reveal';
import { FAQ } from '../content';

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="section faq" id="faq">
      <div className="wrap faq__grid">
        <Reveal className="section-head faq__head">
          <p className="label">FAQ</p>
          <h2 className="h2">
            Questions, <span className="it">answered</span>
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <ul className="faq__list">
            {FAQ.map((item, i) => {
              const isOpen = open === i;
              return (
                <li key={item.q} className={isOpen ? 'faq__item is-open' : 'faq__item'}>
                  <h3>
                    <button
                      type="button"
                      id={`faq-q-${i}`}
                      aria-expanded={isOpen}
                      aria-controls={`faq-a-${i}`}
                      onClick={() => setOpen(isOpen ? null : i)}
                    >
                      <span>{item.q}</span>
                      <span className="faq__icon" aria-hidden="true">
                        <Plus size={18} weight="light" />
                      </span>
                    </button>
                  </h3>
                  <div className="faq__panel" id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`}>
                    <div>
                      <p>{item.a}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
