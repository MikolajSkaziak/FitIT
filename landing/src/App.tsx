import { MotionConfig } from 'motion/react';
import { photos } from './assets';
import { Nav } from './components/Nav';
import { Colors } from './sections/Colors';
import { Extras } from './sections/Extras';
import { Faq } from './sections/Faq';
import { Footer } from './sections/Footer';
import { GetTheApp } from './sections/GetTheApp';
import { Hero } from './sections/Hero';
import { HowItWorks } from './sections/HowItWorks';
import { PhotoToWardrobe } from './sections/PhotoToWardrobe';
import { Pricing } from './sections/Pricing';
import { SeeItOnYou } from './sections/SeeItOnYou';
import { Styles } from './sections/Styles';
import { Weather } from './sections/Weather';

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <HowItWorks />
        <PhotoToWardrobe />
        <Weather />
        <SeeItOnYou />
        <Colors />
        <Styles />
        <Extras />
        <Pricing />
        <Faq />
        <GetTheApp />
      </main>
      <Footer />
      <div className="grain" style={{ backgroundImage: `url(${photos.grain})` }} aria-hidden="true" />
    </MotionConfig>
  );
}
