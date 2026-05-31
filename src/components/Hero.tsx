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
    <section id="hero" className="relative min-h-[90vh] flex flex-col justify-center overflow-hidden bg-slate-900">
      
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

      {/* Dark gradient for text readability (solid, no blur, non-glassmorphism) */}
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-black/90 via-black/50 to-transparent pointer-events-none" />

      {/* Main Content Container (Clean, bold typography) */}
      <div className="relative z-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 w-full h-full flex flex-col justify-center pb-32">
        <div className="max-w-2xl text-left">
          
          <div className="mb-6">
            <span className="inline-block px-4 py-2 bg-white text-black text-xs font-bold uppercase tracking-wide rounded-full shadow-md">
              {lang === "ru" ? "Образовательный Форум" : lang === "kg" ? "Билим берүү форуму" : "Education Forum"}
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-white leading-tight mb-8 drop-shadow-md">
            {lang === "ru" ? (
              <>
                Твой путь в<br/><span className="text-sky-400">топ-вузы мира</span>
              </>
            ) : lang === "kg" ? (
              <>
                Дүйнөнүн мыкты<br/><span className="text-sky-400">окуу жайларына жол</span>
              </>
            ) : (
              <>
                Your path to<br/><span className="text-sky-400">top universities</span>
              </>
            )}
          </h1>

          <p className="text-xl text-slate-200 mb-12 max-w-xl leading-relaxed drop-shadow-sm font-medium">
            {lang === "ru" 
              ? "Пошаговые инструкции поступления в Лигу Плюща и мировые университеты напрямую от тех, кто уже прошел этот путь."
              : lang === "kg"
              ? "Плющ Лигасына жана дүйнөлүк университеттерге тапшыруу боюнча кадам-кадам нускамалар."
              : "Step-by-step admission instructions for Ivy League and world-class universities from those who have already walked this path."}
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => onNavigate("/tickets")}
              className="bg-[#2563EB] hover:bg-blue-700 text-white px-10 py-4 text-sm font-bold uppercase transition-colors rounded-full shadow-lg"
            >
              {lang === "ru" ? "Занять место" : lang === "kg" ? "Орун ээлөө" : "Secure your spot"}
            </button>
            <button
              onClick={() => scrollToSection("speakers")}
              className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-8 py-4 text-sm font-bold uppercase transition-colors rounded-full border border-white/20"
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
