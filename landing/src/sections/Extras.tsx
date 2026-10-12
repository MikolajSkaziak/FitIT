import { photos } from '../assets';
import { Reveal } from '../components/Reveal';
import { EXTRAS } from '../content';

export function Extras() {
  return (
    <section className="section extras">
      <div className="wrap extras__grid">
        <div className="extras__copy">
          <Reveal className="section-head">
            <p className="label">Also inside</p>
            <h2 className="h2">
              And the <span className="it">small</span> things
            </h2>
          </Reveal>
          <ul className="extras__list">
            {EXTRAS.map((e, i) => (
              <Reveal as="li" key={e.title} delay={i * 0.06}>
                <h3>{e.title}</h3>
                <p>{e.body}</p>
              </Reveal>
            ))}
          </ul>
        </div>
        <Reveal className="extras__photo">
          <figure>
            <img
              src={photos.flatlay}
              alt="An outfit laid flat: a cream cable-knit sweater, a navy coat, dark jeans, white sneakers, a brown belt and a watch."
              width={1128}
              height={1400}
              loading="lazy"
            />
            <figcaption className="care-tag">Laid out for tomorrow</figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
