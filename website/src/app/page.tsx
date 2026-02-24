import Hero from '@/components/home/Hero';
import FeaturedMenu from '@/components/home/FeaturedMenu';
import DealsSection from '@/components/home/DealsSection';
import AboutSection from '@/components/home/AboutSection';
import HowItWorks from '@/components/home/HowItWorks';
import ContactSection from '@/components/home/ContactSection';

export default function Home() {
  return (
    <>
      <Hero />
      <FeaturedMenu />
      <DealsSection />
      <AboutSection />
      <HowItWorks />
      <ContactSection />
    </>
  );
}
