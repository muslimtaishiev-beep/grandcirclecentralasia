import React from 'react';
import { motion } from 'motion/react';

import { Metric } from '../types';

interface MetricsCarouselProps {
  lang: string;
  metrics?: Metric[];
}

export const MetricsCarousel: React.FC<MetricsCarouselProps> = ({ lang, metrics = [] }) => {


  return (
    <div className="w-full max-w-7xl mx-auto py-4 md:py-6 px-4 sm:px-6 overflow-hidden relative">
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
      {metrics.map((item, idx) => {
        const isEven = idx % 2 === 0;
        
        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ type: "spring", stiffness: 220, damping: 25, delay: idx * 0.05 }}
            className="w-full"
          >
            <div className="relative overflow-hidden bg-[#F5F3FF] shadow-md ring-1 ring-[#9F7AEA]/50 rounded-2xl p-3 md:p-4 w-full h-[120px] md:h-[130px] text-center group flex flex-col justify-center transition-all hover:shadow-lg">
              
              {/* Chaotic SVG Fragment - perfectly aligned to form a whole across the 4x2 grid on desktop */}
              <div className="hidden md:flex absolute inset-0 z-0 opacity-30 pointer-events-none items-center justify-center">
                <svg 
                  viewBox={`${(idx % 4) * 300} ${Math.floor(idx / 4) * 200} 300 200`} 
                  preserveAspectRatio="none" 
                  className="w-full h-full object-fill scale-[1.02]" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <motion.path 
                    d="M -100,50 C 200,350 400,-100 700,250 C 1000,600 1100,-50 1300,350" 
                    stroke="#9F7AEA" strokeWidth="12" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0, pathOffset: 0 }}
                    animate={{ pathLength: [0, 1, 1, 0], pathOffset: [0, 0, 1, 1] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.path 
                    d="M -50,450 C 250,100 450,500 750,100 C 1050,-300 1150,400 1350,100" 
                    stroke="#C4B5FD" strokeWidth="16" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0, pathOffset: 1 }}
                    animate={{ pathLength: [0, 1, 1, 0], pathOffset: [1, 1, 0, 0] }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  />
                  <motion.path 
                    d="M 100,-100 C 50,300 350,450 450,100 C 550,-250 800,500 950,200 C 1100,-100 1200,550 1400,0" 
                    stroke="#9F7AEA" strokeWidth="20" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0, pathOffset: 0 }}
                    animate={{ pathLength: [0, 1, 1, 0], pathOffset: [0, 0, 1, 1] }}
                    transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                  />
                  <motion.path 
                    d="M 200,550 C 350,50 650,-150 800,350 C 950,850 1100,50 1400,450" 
                    stroke="#C4B5FD" strokeWidth="10" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0, pathOffset: 0 }}
                    animate={{ pathLength: [0, 1, 1, 0], pathOffset: [0, 0, 1, 1] }}
                    transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 0 }}
                  />
                  <motion.path 
                    d="M -150,200 C 300,500 500,-100 900,350 C 1300,800 1400,-150 1600,200" 
                    stroke="#E9D5FF" strokeWidth="24" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0, pathOffset: 1 }}
                    animate={{ pathLength: [0, 1, 1, 0], pathOffset: [1, 1, 0, 0] }}
                    transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 3 }}
                  />
                </svg>
              </div>

              {/* Vertical SVG Fragment for Mobile - flows top to bottom */}
              <div className="flex md:hidden absolute inset-0 z-0 opacity-30 pointer-events-none items-center justify-center">
                <svg 
                  viewBox={`0 ${idx * 150} 300 150`} 
                  preserveAspectRatio="none" 
                  className="w-full h-full object-fill scale-[1.02]" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <motion.path 
                    d="M 150,-100 C 50,200 250,400 150,700 C 50,1000 250,1200 150,1500" 
                    stroke="#9F7AEA" strokeWidth="12" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0, pathOffset: 0 }}
                    animate={{ pathLength: [0, 1, 1, 0], pathOffset: [0, 0, 1, 1] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.path 
                    d="M 100,-50 C 300,150 -100,550 100,750 C 300,950 -100,1350 100,1550" 
                    stroke="#C4B5FD" strokeWidth="16" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0, pathOffset: 1 }}
                    animate={{ pathLength: [0, 1, 1, 0], pathOffset: [1, 1, 0, 0] }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  />
                  <motion.path 
                    d="M 200,-100 C 0,300 300,450 200,850 C 0,1150 300,1300 200,1700" 
                    stroke="#E9D5FF" strokeWidth="24" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0, pathOffset: 1 }}
                    animate={{ pathLength: [0, 1, 1, 0], pathOffset: [1, 1, 0, 0] }}
                    transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 3 }}
                  />
                </svg>
              </div>

              <div className="relative z-10 flex flex-col items-center justify-center w-full h-full">
                <div className="flex-1 flex items-end justify-center pb-1">
                  <span className="block text-3xl md:text-4xl font-heading font-black text-slate-800 tracking-tight drop-shadow-sm leading-none">
                    {item.value}
                  </span>
                </div>
                <div className="flex-1 flex flex-col items-center justify-start pt-1">
                  <span className="block text-sm md:text-base font-heading font-bold text-slate-800 leading-tight">
                    {lang === "ru" ? item.label_ru : lang === "kg" ? item.label_kg || item.label_ru : item.label_en}
                  </span>
                  {(item.sublabel_ru || item.sublabel_en) && (
                    <span className="block text-[10px] md:text-xs font-heading font-medium text-slate-600 mt-0.5">
                      {lang === "ru" ? item.sublabel_ru : lang === "kg" ? item.sublabel_kg || item.sublabel_ru : item.sublabel_en}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
      </div>
    </div>
  );
};
