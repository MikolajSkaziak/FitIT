import { stylePhoto } from '../assets';
import { Reveal } from '../components/Reveal';
import { STYLES } from '../content';

function Shelf({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul className="shelf__set" aria-hidden={hidden || undefined}>
      {STYLES.map((s) => (
        <li key={s.code} className="shelf__tile">
          <img
            src={stylePhoto(s.code)}
            alt={hidden ? '' : `A person dressed in the ${s.label.toLowerCase()} style`}
            width={480}
            height={640}
            loading="lazy"
            draggable={false}
          />
          <span className="care-tag">{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function Styles() {
  return (
    <section className="section styles" id="styles">
      <div className="wrap styles__head">
        <Reveal className="section-head">
          <p className="label">Your style</p>
          <h2 className="h2">
            Sixteen styles. Pick what you <span className="it">like</span>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="lede">
            When you sign up you choose the styles you like to wear, as many as you want. fitit. keeps them in mind when
            it puts your looks together.
          </p>
        </Reveal>
      </div>
      <div className="shelf">
        <div className="shelf__track">
          <Shelf />
          <Shelf hidden />
        </div>
      </div>
    </section>
  );
}
