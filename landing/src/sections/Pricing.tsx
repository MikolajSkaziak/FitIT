import { useState } from 'react';
import { motion } from 'motion/react';
import { AppIcon } from '../components/AppIcon';
import { Cta } from '../components/Cta';
import { Reveal } from '../components/Reveal';
import { TextTabs } from '../components/TextTabs';
import {
  FREE_OUTFIT_SUGGESTIONS_PER_DAY,
  FREE_TRY_ONS_PER_DAY,
  PLAN_ROWS,
  PLUS_OUTFIT_SUGGESTIONS_PER_DAY,
  PLUS_PRICE_MONTHLY,
  PLUS_PRICE_YEARLY,
  PLUS_PRICE_YEARLY_PER_MONTH,
  PLUS_TRY_ONS_PER_DAY,
  formatPrice,
} from '../content';
import { EASE } from '../motion';

const PERIODS = ['Yearly', 'Monthly'] as const;

const PENDING = [
  PLUS_PRICE_MONTHLY,
  PLUS_PRICE_YEARLY,
  PLUS_PRICE_YEARLY_PER_MONTH,
  FREE_OUTFIT_SUGGESTIONS_PER_DAY,
  PLUS_OUTFIT_SUGGESTIONS_PER_DAY,
  FREE_TRY_ONS_PER_DAY,
  PLUS_TRY_ONS_PER_DAY,
].some((v) => v === null);

export function Pricing() {
  const [period, setPeriod] = useState(0);
  const yearly = period === 0;

  return (
    <section className="section pricing" id="pricing">
      <div className="wrap pricing__grid">
        <div className="pricing__copy">
          <Reveal className="section-head">
            <p className="label">Pricing</p>
            <h2 className="h2">
              Free, or <span className="it">Plus</span>
            </h2>
            <p className="lede">
              Use fitit. for free for as long as you like. Plus is for people who open it every morning.
            </p>
          </Reveal>

          <Reveal delay={0.08} className="pricing__plan">
            <TextTabs id="billing" label="Billing period" index={period} onChange={setPeriod} tabs={PERIODS} />
            <div id="billing-panel" role="tabpanel" aria-labelledby={`billing-tab-${period}`} className="pricing__price">
              <span className="pricing__amount">{formatPrice(yearly ? PLUS_PRICE_YEARLY : PLUS_PRICE_MONTHLY)}</span>
              <span className="pricing__per">
                {yearly ? `a year · ${formatPrice(PLUS_PRICE_YEARLY_PER_MONTH)} a month` : 'a month'}
              </span>
            </div>
            {PENDING && (
              <p className="pricing__note">
                <span className="care-tag">To be announced</span>
                Prices and daily limits are not set yet.
              </p>
            )}
          </Reveal>

          <Reveal delay={0.14}>
            <table className="compare">
              <caption className="sr-only">What Free and Plus include</caption>
              <thead>
                <tr>
                  <td />
                  <th scope="col" className="label">
                    Free
                  </th>
                  <th scope="col" className="label label--green">
                    Plus
                  </th>
                </tr>
              </thead>
              <tbody>
                {PLAN_ROWS.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>{row.free}</td>
                    <td>{row.plus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>

          <Reveal delay={0.18}>
            <Cta />
          </Reveal>
        </div>

        <Reveal className="pricing__stage">
          <div className="hangtag app" aria-hidden="true">
            <div className="hangtag__rail" />
            <motion.div
              className="hangtag__swing"
              initial={{ rotate: -5 }}
              whileInView={{ rotate: [-5, 2.4, -1.2, 0.5, 0] }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 2.6, ease: EASE, times: [0, 0.3, 0.55, 0.8, 1] }}
            >
              <span className="hangtag__string" />
              <div className="tag hangtag__tag">
                <span className="hangtag__hole" />
                <div className="hangtag__name">
                  fit<span className="gr">it.</span> Plus
                </div>
                <div className="hl" />
                {PLAN_ROWS.map((row) => (
                  <div className="r sb" key={row.label}>
                    <span className="la r" style={{ gap: 6 }}>
                      <AppIcon name={row.icon} size="sm" />
                      {row.short}
                    </span>
                    <span className="ti">{row.plus}</span>
                  </div>
                ))}
                <div className="st" />
                <div className="la">Cancel any time</div>
              </div>
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
