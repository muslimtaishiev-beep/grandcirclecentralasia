import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';

interface MetricsCarouselProps {
  lang: string;
}



export const MetricsCarousel: React.FC<MetricsCarouselProps> = ({ lang }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const cards = [
    {
      id: 0,
      color: "bg-blue-300",
      shape: "rounded-3xl",
      content: (
        <div className="flex flex-col justify-between h-full p-8 md:p-10 text-slate-900">
          <span className="text-6xl md:text-8xl font-black relative z-10 tracking-tighter">500+</span>
          <span className="text-lg md:text-2xl font-bold leading-tight relative z-10">
            {lang === "ru" ? "Участников" : lang === "kg" ? "Катышуучулар" : "Attendees"}<br/>
            <span className="font-medium text-slate-700 text-sm md:text-base mt-2 block">
              {lang === "ru" ? "Школьники, студенты, родители" : lang === "kg" ? "Окуучулар, студенттер, ата-энелер" : "Students, parents, professionals"}
            </span>
          </span>
        </div>
      )
    },
    {
      id: 1,
      color: "bg-emerald-200",
      shape: "rounded-3xl", 
      content: (
        <div className="flex flex-col items-center justify-center h-full p-8 text-slate-900 text-center">
          <span className="text-4xl md:text-5xl font-black leading-none tracking-tight mb-4">Essay<br/>Comp.</span>
          <span className="text-sm font-bold opacity-90 px-4">
            {lang === "ru" ? "Крупнейший в ЦА" : lang === "kg" ? "Борбордук Азиядагы эң чоң" : "Largest in CA"}
          </span>
        </div>
      )
    },
    {
      id: 2,
      color: "bg-sky-200",
      shape: "rounded-3xl", 
      content: (
        <div className="flex flex-col items-center justify-center h-full p-8 text-slate-900 text-center">
          <span className="text-8xl md:text-9xl font-black">1</span>
          <span className="text-xl md:text-2xl font-bold leading-tight mt-4">
            {lang === "ru" ? "День форума" : lang === "kg" ? "Күн форум" : "Intense Day"}
          </span>
        </div>
      )
    },
    {
      id: 3,
      color: "bg-teal-200",
      shape: "rounded-3xl", 
      content: (
        <div className="flex flex-col items-center justify-center h-full p-8 text-slate-900 text-center">
          <span className="text-7xl md:text-8xl font-black relative z-10">20+</span>
          <span className="text-xl md:text-2xl font-bold leading-tight relative z-10 mt-6">
            {lang === "ru" ? "Спикеров" : lang === "kg" ? "Спикерлер" : "Speakers"}
          </span>
        </div>
      )
    },
    {
      id: 4,
      color: "bg-indigo-200",
      shape: "rounded-3xl", 
      content: (
        <div className="flex flex-col items-center justify-center h-full p-8 text-slate-900 text-center">
          <span className="text-7xl md:text-8xl font-black relative z-10 tracking-tighter">
            ∞
          </span>
          <span className="text-xl md:text-2xl font-bold mt-4 uppercase tracking-widest">
            {lang === "ru" ? "мотивации" : lang === "kg" ? "мотивация" : "motivation"}
          </span>
        </div>
      )
    },
    {
      id: 5,
      color: "bg-cyan-200",
      shape: "rounded-3xl", 
      content: (
        <div className="flex flex-col justify-between h-full p-8 md:p-10 text-slate-900">
          <span className="text-8xl md:text-9xl font-black leading-none">4</span>
          <div>
            <span className="block text-2xl md:text-3xl font-bold leading-tight mb-2">
              {lang === "ru" ? "сессии" : lang === "kg" ? "сессиялар" : "sessions"}
            </span>
            <span className="text-base md:text-lg font-medium text-slate-700">
              {lang === "ru" ? "Стратегии поступления" : lang === "kg" ? "Кирүү стратегиялары" : "Admission strategies"}
            </span>
          </div>
        </div>
      )
    },
    {
      id: 6,
      color: "bg-blue-200",
      shape: "rounded-3xl", 
      content: (
        <div className="flex items-center justify-center h-full p-8 text-slate-900">
          <span className="text-4xl md:text-5xl font-black uppercase tracking-widest">networking</span>
        </div>
      )
    },
    {
      id: 7,
      color: "bg-green-200",
      shape: "rounded-3xl", 
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full p-8 text-slate-900">
          <span className="text-5xl md:text-6xl font-black leading-tight">
            VIP<br/>
            <span className="text-3xl md:text-4xl mt-2 block">
              {lang === "ru" ? "ужин" : lang === "kg" ? "кечки тамак" : "dinner"}
            </span>
          </span>
        </div>
      )
    }
  ];

  // Static array of bubbles for the background
  const BUBBLES = [
    { size: 120, x: "10%", y: "20%", delay: 0 },
    { size: 80, x: "85%", y: "15%", delay: 1 },
    { size: 150, x: "45%", y: "75%", delay: 2 },
    { size: 60, x: "25%", y: "60%", delay: 0.5 },
    { size: 100, x: "70%", y: "80%", delay: 1.5 },
    { size: 90, x: "5%", y: "85%", delay: 0.2 },
    { size: 130, x: "95%", y: "50%", delay: 2.5 },
    { size: 70, x: "55%", y: "10%", delay: 1.2 },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % cards.length);
    }, 2500); 
    
    return () => clearInterval(timer);
  }, [cards.length]);

  return (
    <div className="relative w-full h-[450px] md:h-[600px] flex items-center justify-center overflow-hidden py-10 perspective-1000 bg-slate-50/50">
      
      {/* Floating Bubbles Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {BUBBLES.map((bubble, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-blue-400/10 backdrop-blur-3xl"
            style={{
              width: bubble.size,
              height: bubble.size,
              left: bubble.x,
              top: bubble.y,
            }}
            animate={{
              y: [0, -40, 0],
              x: [0, 20, 0],
              opacity: [0.4, 0.8, 0.4]
            }}
            transition={{
              duration: 6 + (i % 3),
              repeat: Infinity,
              delay: bubble.delay,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {cards.map((card, index) => {
        const diff = (index - currentIndex + cards.length) % cards.length;
        
        let x = "0%";
        let scale = 1;
        let zIndex = 10;
        let opacity = 1;

        if (diff === 0) {
          x = "0%";
          scale = 1;
          zIndex = 10;
          opacity = 1;
        } else if (diff === 1) {
          x = "60%";
          scale = 0.85;
          zIndex = 8;
          opacity = 0.8;
        } else if (diff === 2) {
          x = "110%";
          scale = 0.7;
          zIndex = 6;
          opacity = 0.4;
        } else if (diff === cards.length - 1) {
          x = "-60%";
          scale = 0.85;
          zIndex = 8;
          opacity = 0.8;
        } else if (diff === cards.length - 2) {
          x = "-110%";
          scale = 0.7;
          zIndex = 6;
          opacity = 0.4;
        } else {
          x = "0%";
          scale = 0.5;
          zIndex = 1;
          opacity = 0;
        }

        return (
          <motion.div
            key={card.id}
            initial={false}
            animate={{ x, scale, zIndex, opacity }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            className={`absolute w-[260px] h-[340px] md:w-[360px] md:h-[460px] cursor-pointer shadow-2xl border-4 border-white overflow-hidden group ${card.color} ${card.shape}`}
            onClick={() => setCurrentIndex(index)}
          >

            
            <div className="relative z-10 w-full h-full pointer-events-none">
              {card.content}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
