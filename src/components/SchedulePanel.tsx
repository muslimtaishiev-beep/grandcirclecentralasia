import React, { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";

interface SchedulePanelProps {
  lang: "ru" | "en" | "kg";
}

const travelStops = [
  {
    id: "extracurriculars",
    title_ru: "База & Внеучебка",
    title_kg: "Мектептен тышкаркы",
    title_en: "Extracurriculars",
    time: "10:00 - 11:30",
    desc_ru: "Старт маршрута. Плавание, проекты и спорт.",
    desc_en: "Journey starts here. Swimming, projects, and sports.",
    image: "/assets/map_region_start_v2_1780228834772.png",
    image: "/assets/map_region_start_v2_1780228834772.png",
    x: 25,
    y: 10
  },
  {
    id: "europe",
    title_ru: "Европа",
    title_kg: "Европа",
    title_en: "Europe",
    time: "12:00 - 13:30",
    desc_ru: "Архитектура и культура Старого Света.",
    desc_en: "Architecture and culture of the Old World.",
    image: "/assets/map_region_europe_1780228519337.png",
    image: "/assets/map_region_europe_1780228519337.png",
    x: 75,
    y: 35
  },
  {
    id: "usa",
    title_ru: "США",
    title_kg: "АКШ",
    title_en: "USA",
    time: "14:30 - 16:00",
    desc_ru: "Дух свободы и инноваций Нового Света.",
    desc_en: "The spirit of freedom and innovation.",
    image: "/assets/map_region_usa_1780228532055.png",
    image: "/assets/map_region_usa_1780228532055.png",
    x: 30,
    y: 55
  },
  {
    id: "asia",
    title_ru: "Китай и Азия",
    title_kg: "Кытай жана Азия",
    title_en: "China & Asia",
    time: "16:30 - 18:00",
    desc_ru: "Завершение пути на Востоке. Традиции и sci-fi будущее.",
    desc_en: "Ending the journey in the East. Tradition meets sci-fi.",
    image: "/assets/map_region_asia_v2_1780228848350.png",
    image: "/assets/map_region_asia_v2_1780228848350.png",
    x: 70,
    y: 75
  }
];

export default function SchedulePanel({ lang }: SchedulePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 80%", "end 60%"]
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 60, damping: 20 });
  const pathLength = useTransform(smoothProgress, [0, 1], [0, 1]);

  return (
    <div className="mx-auto w-full py-8 px-4 sm:px-6 relative overflow-hidden" id="schedule">
      <div className="text-center mb-24 md:mb-32 relative z-10">
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tighter">
          <span className="text-slate-900">
            {lang === "kg" ? "Маршрут" : "Карта"}
          </span>{" "}
          <span className="text-[#A259FF]">
            {lang === "kg" ? "форуму" : lang === "en" ? "Journey" : "маршрута"}
          </span>
        </h2>
        <p className="mt-4 text-slate-500 max-w-2xl mx-auto font-medium">
          {lang === "ru" ? "Визуальное путешествие по программе. Отправляйтесь в путь!" : "A visual journey through the schedule. Let's hit the road!"}
        </p>
      </div>

      {/* --- DESKTOP 2D MAP --- */}
      <div ref={containerRef} className="hidden md:block relative w-full max-w-[1200px] mx-auto aspect-[4/3] xl:aspect-[16/10]">
        
        {/* Zigzag SVG Route */}
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-lg">
          {/* Base dashed path */}
          <path 
            d="M 250 100 C 500 100, 500 350, 750 350 C 1000 350, 0 550, 300 550 C 550 550, 450 750, 700 750" 
            fill="none" stroke="#E2E8F0" strokeWidth="8" strokeDasharray="16 16" strokeLinecap="round"
          />
          {/* Animated filling path */}
          <motion.path 
            d="M 250 100 C 500 100, 500 350, 750 350 C 1000 350, 0 550, 300 550 C 550 550, 450 750, 700 750" 
            fill="none" stroke="#A259FF" strokeWidth="8" strokeDasharray="16 16" strokeLinecap="round"
            style={{ pathLength }}
          />
        </svg>

        {/* Scattered Cards */}
        {travelStops.map((stop, i) => {
          const title = lang === "ru" ? stop.title_ru : lang === "kg" ? stop.title_kg : stop.title_en;
          const desc = lang === "ru" ? stop.desc_ru : lang === "en" ? stop.desc_en : stop.desc_ru;

          return (
            <div 
              key={stop.id}
              className="absolute z-10"
              style={{
                left: `${stop.x}%`,
                top: `${stop.y}%`,
              }}
            >
              <motion.div 
                className="w-56 lg:w-64 flex flex-col bg-white rounded-[2rem] shadow-2xl border-2 border-white overflow-hidden group cursor-pointer will-change-transform"
                initial={{ x: "-50%", y: "-50%", rotate: i % 2 === 0 ? -2 : 3 }}
                whileHover={{ scale: 1.05, rotate: 0, zIndex: 30 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {/* Watercolor Illustration */}
              <div className="w-full h-36 lg:h-40 p-2">
                <div className="w-full h-full rounded-[2rem] overflow-hidden relative bg-white">
                   <img src={stop.image} alt={title} className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-700" />
                   
                   {/* Time Tag overlaid on image */}
                   <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm text-slate-900 font-bold px-3 py-1 text-sm rounded-xl shadow-sm">
                     {stop.time}
                   </div>
                </div>
              </div>

              {/* Text Info */}
              <div className="px-5 pb-5 pt-1 text-center">
                <h3 className="text-lg lg:text-xl font-black text-slate-800 mb-1">{title}</h3>
                <p className="text-slate-500 font-medium text-xs leading-snug">
                  {desc}
                </p>
              </div>
            </motion.div>
          </div>
          );
        })}
      </div>

      {/* --- MOBILE FALLBACK (Vertical Timeline) --- */}
      <div className="md:hidden flex flex-col gap-12 relative w-full pt-10">
        
        {/* Vertical Dashed Line */}
        <div className="absolute left-8 top-0 bottom-0 w-1 border-l-4 border-dashed border-slate-200" />
        
        <div className="flex flex-col gap-12 relative z-10">
          {travelStops.map((stop) => {
            const title = lang === "ru" ? stop.title_ru : lang === "kg" ? stop.title_kg : stop.title_en;
            const desc = lang === "ru" ? stop.desc_ru : lang === "en" ? stop.desc_en : stop.desc_ru;

            return (
              <div key={stop.id} className="w-full pl-20 relative">
                
                {/* Node Marker */}
                <div className="absolute left-[34px] top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#A259FF] border-4 border-white shadow-md z-20" />
                
                {/* Mobile Card */}
                <div className="w-full bg-white rounded-[2rem] shadow-xl border-2 border-slate-100 overflow-hidden p-2">
                  <div className="w-full h-48 rounded-3xl overflow-hidden relative bg-slate-50">
                    <img src={stop.image} alt={title} className="w-full h-full object-cover object-center" />
                    <div className="absolute top-3 left-3 bg-white/95 text-slate-900 font-bold px-3 py-1 text-sm rounded-xl shadow-sm">
                      {stop.time}
                    </div>
                  </div>
                  <div className="px-4 py-4">
                    <h3 className="text-xl font-black text-slate-800 mb-1">{title}</h3>
                    <p className="text-slate-500 font-medium text-sm leading-snug">
                      {desc}
                    </p>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>
      
    </div>
  );
}
