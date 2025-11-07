import { Component as HeroSection } from "@/components/ui/hero-section";
import ComputerTutorial from "@/components/ui/computer-tutorial";
import Footer from "@/components/ui/footer";

export default function Home() {
  return (
    <div className="w-screen min-h-screen flex flex-col relative">
      <HeroSection />
      
      <ComputerTutorial />
      
      <Footer />
    </div>
  );
}