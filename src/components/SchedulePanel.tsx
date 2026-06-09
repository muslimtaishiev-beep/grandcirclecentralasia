import React, { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";

interface SchedulePanelProps {
  program?: any[];
  speakers?: any[];
  universities?: any[];
  lang: "ru" | "en" | "kg";
}

const FALLBACK_IMAGES = [
  "/assets/map_region_start_v2_1780228834772.png",
  "/assets/map_region_europe_1780228519337.png",
  "/assets/map_region_usa_1780228532055.png",
  "/assets/map_region_asia_v2_1780228848350.png"
];

export default function SchedulePanel({ program = [], speakers = [], universities = [], lang }: SchedulePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 80%", "end 60%"]
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 60, damping: 20 });
  const pathLength = useTransform(smoothProgress, [0, 1], [0, 1]);

  // Generate node positions deterministically to avoid hydration / re-render jumps
  const points = program.map((stop, i) => {
    const isEven = i % 2 === 0;
    const stepY = program.length > 1 ? 80 / (program.length - 1) : 0;
    const x = isEven ? 25 + (i * 5) % 15 : 75 - (i * 5) % 15;
    const y = 10 + stepY * i;
    return { x, y, absX: x * 10, absY: y * 10 }; // Scale x and y to 0-1000 for SVG
  });

  // Generate a dynamic smooth bezier curve to connect all nodes
  let pathD = "";
  if (points.length > 0) {
    pathD = `M ${points[0].absX} ${points[0].absY}`;
    for (let i = 1; i < points.length; i++) {
       const prev = points[i-1];
       const curr = points[i];
       const midY = (prev.absY + curr.absY) / 2;
       pathD += ` C ${prev.absX} ${midY}, ${curr.absX} ${midY}, ${curr.absX} ${curr.absY}`;
    }
  }

  return (
    <div className="mx-auto w-full py-8 px-4 sm:px-6 relative overflow-hidden">
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
        
        {/* Dynamic SVG Route */}
        {points.length > 1 && (
          <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-lg">
            {/* Base dashed path */}
            <path 
              d={pathD} 
              fill="none" stroke="#E2E8F0" strokeWidth="8" strokeDasharray="16 16" strokeLinecap="round"
            />
            {/* Animated filling path */}
            <motion.path 
              d={pathD} 
              fill="none" stroke="#A259FF" strokeWidth="8" strokeDasharray="16 16" strokeLinecap="round"
              style={{ pathLength }}
            />
          </svg>
        )}

        {/* Scattered Cards */}
        {program.map((stop, i) => {
          const title = lang === "ru" ? stop.title_ru : lang === "kg" ? stop.title_kg : stop.title_en;
          const desc = lang === "ru" ? stop.description_ru : lang === "en" ? stop.description_en : stop.description_kg;

          const point = points[i];
          
          const speaker = speakers.find(s => s.id === stop.speakerId);
          const uni = universities.find(u => u.name === speaker?.university);
          const logo = uni?.logoBase64;
          const fallbackImg = FALLBACK_IMAGES[i % FALLBACK_IMAGES.length];
          const finalImage = logo || fallbackImg;
          const objectClass = logo ? "object-contain p-2" : "object-cover";

          return (
            <div 
              key={stop.id || i}
              className="absolute z-10"
              style={{
                left: `${point.x}%`,
                top: `${point.y}%`,
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
                <div className="w-full h-full rounded-[2rem] overflow-hidden relative bg-white border border-slate-100 flex items-center justify-center">
                   <img src={finalImage} alt={title} className={`w-full h-full group-hover:scale-110 transition-transform duration-700 ${objectClass}`} style={{ transform: logo ? `scale(${uni?.logoScale || 1})` : "none" }} />
                   
                   {/* Time Tag overlaid on image */}
                   <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm text-slate-900 font-bold px-3 py-1 text-sm rounded-xl shadow-sm">
                     {lang === "ru" ? stop.time_ru : lang === "kg" ? stop.time_kg : stop.time_en || stop.time}
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
          {program.map((stop, index) => {
            const title = lang === "ru" ? stop.title_ru : lang === "kg" ? stop.title_kg : stop.title_en;
            const desc = lang === "ru" ? stop.description_ru : lang === "kg" ? stop.description_kg : stop.description_en;
            
            const speaker = speakers.find(s => s.id === stop.speakerId);
            const uni = universities.find(u => u.name === speaker?.university);
            const logo = uni?.logoBase64;
            const fallbackImg = FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
            const finalImage = logo || fallbackImg;
            const objectClass = logo ? "object-contain p-4" : "object-cover";

            return (
              <div key={stop.id} className="w-full pl-20 relative">
                
                {/* Node Marker */}
                <div className="absolute left-[34px] top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#A259FF] border-4 border-white shadow-md z-20" />
                
                {/* Mobile Card */}
                <div className="w-full bg-white rounded-[2rem] shadow-xl border-2 border-slate-100 overflow-hidden p-2">
                  <div className="w-full h-48 rounded-3xl overflow-hidden relative bg-white border-b border-slate-100 flex items-center justify-center">
                    <img src={finalImage} alt={title} className={`w-full h-full ${objectClass}`} style={{ transform: logo ? `scale(${uni?.logoScale || 1})` : "none" }} />
                    <div className="absolute top-3 left-3 bg-white/95 text-slate-900 font-bold px-3 py-1 text-sm rounded-xl shadow-sm">
                        {lang === "ru" ? stop.time_ru : lang === "kg" ? stop.time_kg : stop.time_en || stop.time}
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
