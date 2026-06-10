import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight } from "lucide-react";

interface HeroProps {
  lang: "ru" | "en" | "kg";
  settings: {
    eventDate: string;
    eventVenue: string;
    contactEmail: string;
    contactPhone: string;
  };
  onNavigate: (path: string) => void;
}

const IMAGES = [
  "/hero1.png",
  "/hero2.png"
];

export default function Hero({ lang, settings, onNavigate }: HeroProps) {
  const [activeImage, setActiveImage] = useState(0);

  // Background Slideshow
  useEffect(() => {
    IMAGES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });

    const interval = setInterval(() => {
      setActiveImage((prev) => (prev + 1) % IMAGES.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="hero" className="relative min-h-[90vh] flex flex-col justify-center overflow-hidden bg-[#2E1065]">
      
      {/* Cinematic Cross-fade Images */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="popLayout">
          <motion.img
            key={activeImage}
            src={IMAGES[activeImage]}
            alt="Hero Background"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </AnimatePresence>
      </div>

      {/* Deep purple overlay for text readability, matches brand better than black */}
      <div className="absolute inset-0 z-10 bg-[#2E1065]/40 pointer-events-none" />

      {/* Massive smooth gradient blending into the rest of the website's pastel background */}
      <div className="absolute bottom-0 left-0 right-0 h-[40vh] min-h-[300px] bg-gradient-to-b from-transparent via-[#EDE9FE]/20 to-[#EDE9FE] z-20 pointer-events-none" />

      {/* Main Content Container (Clean, bold typography) */}
      <div className="relative z-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 w-full h-full flex flex-col justify-center pb-32">
        <div className="max-w-2xl text-left">
          
          <div className="mb-6">
            <span className="inline-block px-4 py-2 bg-white/90 backdrop-blur-sm text-[#9F7AEA] text-xs font-bold uppercase tracking-wide rounded-full shadow-sm">
              {lang === "ru" ? "Образовательный Форум" : lang === "kg" ? "Билим берүү форуму" : "Education Forum"}
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-white leading-tight mb-8 drop-shadow-md">
            {lang === "ru" ? (
              <>
                Твой путь в<br/><span className="text-[#c4a4ff]">топ-вузы мира</span>
              </>
            ) : lang === "kg" ? (
              <>
                Дүйнөнүн мыкты<br/><span className="text-[#c4a4ff]">окуу жайларына жол</span>
              </>
            ) : (
              <>
                Your path to<br/><span className="text-[#c4a4ff]">top universities</span>
              </>
            )}
          </h1>

          <p className="text-lg sm:text-xl text-slate-100 mb-12 max-w-2xl leading-relaxed drop-shadow-sm font-medium">
            {lang === "ru" 
              ? "Пошаговые инструкции поступления в Лигу Плюща и мировые университеты напрямую от тех, кто уже прошел этот путь. Наши спикеры расскажут про бакалавриат и магистратуру за рубежом, рассмотрят как бесплатные и бюджетные low-варианты, так и топовые университеты мира."
              : lang === "kg"
              ? "Плющ Лигасына жана дүйнөлүк университеттерге тапшыруу боюнча кадам-кадам нускамалар."
              : "Step-by-step admission instructions for Ivy League and world-class universities from those who have already walked this path."}
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => onNavigate("/tickets")}
              className="bg-[#9F7AEA] hover:bg-[#8B5CF6] text-white px-10 py-4 text-sm font-bold uppercase transition-colors rounded-full shadow-lg"
            >
              {lang === "ru" ? "Занять место" : lang === "kg" ? "Орун ээлөө" : "Secure your spot"}
            </button>
            <button
              onClick={() => scrollToSection("speakers")}
              className="flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-8 py-4 text-sm font-bold uppercase transition-colors rounded-full border border-white/30"
            >
              {lang === "ru" ? "Программа" : lang === "kg" ? "Программа" : "Program"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

    </section>
  );
}
