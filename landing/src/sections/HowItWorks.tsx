import { photos } from '../assets';
import { Reveal } from '../components/Reveal';
import { HOW_STEPS } from '../content';

export function HowItWorks() {
  return (
    <section className="section how" id="how">
      <div className="wrap how__grid">
        <Reveal className="how__photo">
          <figure>
            <img
              src={photos.rail}
              alt="A clothing rail with a navy coat, a cream sweater, a white shirt, a burgundy knit and camel trousers, shoes on the floor below."
              width={1128}
              height={1400}
              loading="lazy"
            />
            <figcaption className="care-tag">Your closet</figcaption>
          </figure>
        </Reveal>
        <div className="how__copy">
          <Reveal className="section-head">
            <p className="label">How it works</p>
            <h2 className="h2">
              Three steps to <span className="it">dressed</span>
            </h2>
          </Reveal>
          <ol className="how__steps">
            {HOW_STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 0.08}>
                <span className="how__num" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="h3">{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
