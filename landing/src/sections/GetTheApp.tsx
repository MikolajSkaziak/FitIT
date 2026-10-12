import { AppleLogo, GooglePlayLogo } from '@phosphor-icons/react';
import { photos } from '../assets';
import { Reveal } from '../components/Reveal';
import { QR_CODE_IMAGE, STORE_LINKS } from '../content';

export function GetTheApp() {
  return (
    <section className="get" id="get">
      <div className="wrap get__grid">
        <Reveal className="get__photo">
          <img
            src={photos.chair}
            alt="A wooden chair with a navy coat over its back, a folded cream sweater on the seat and white sneakers beside it."
            width={1128}
            height={1400}
            loading="lazy"
          />
        </Reveal>
        <div className="get__copy">
          <Reveal className="section-head">
            <p className="label">Get the app</p>
            <h2 className="h2">
              Get dressed with what you <span className="it">own</span>
            </h2>
            <p className="lede">
              Add a few pieces tonight and open fitit. tomorrow morning. Your first three looks will be waiting.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="get__actions">
            <div className="get__stores">
              <a className="store" href={STORE_LINKS.appStore}>
                <AppleLogo size={28} weight="light" aria-hidden="true" />
                <span>
                  <small>Download on the</small>
                  App Store
                </span>
              </a>
              <a className="store" href={STORE_LINKS.googlePlay}>
                <GooglePlayLogo size={28} weight="light" aria-hidden="true" />
                <span>
                  <small>Get it on</small>
                  Google Play
                </span>
              </a>
            </div>
            <div className="qr">
              {QR_CODE_IMAGE ? (
                <img src={QR_CODE_IMAGE} alt="QR code that opens fitit. in your app store" width={112} height={112} />
              ) : (
                <div className="qr__frame" role="img" aria-label="QR code, coming soon">
                  <span className="label">QR code</span>
                </div>
              )}
              <p>
                <span className="label">On a computer?</span>
                Scan the code with your phone’s camera to open the store.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
