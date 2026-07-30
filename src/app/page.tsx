import Header from "@/components/home/Header";
import HeroSection from "@/components/home/HeroSection";
import ElementaryArtsSection from "@/components/home/ElementaryArtsSection";
import GradeLevelSection from "@/components/home/GradeLevelSection";
import VideoSection from "@/components/home/VideoSection";
import UnlockSection from "@/components/home/UnlockSection";
import CallToActionSection from "@/components/home/CallToActionSection";
import Footer from "@/components/home/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <ElementaryArtsSection />
        <GradeLevelSection />
        <VideoSection />
        <UnlockSection />
        <CallToActionSection />
      </main>
      <Footer />
    </>
  );
}
