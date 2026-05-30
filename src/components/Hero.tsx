import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";

interface HeroProps {
  lang: "ru" | "en";
  settings: {
    eventDate: string;
    eventVenue: string;
    contactEmail: string;
    contactPhone: string;
  };
}

export default function Hero({ lang, settings }: HeroProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const targetDate = new Date("June 26, 2026 09:30:00").getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        clearInterval(interval);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="hero" className="relative min-h-[95vh] flex flex-col justify-center overflow-hidden bg-[#EFF6FF]">
      {/* Background Image with Ken Burns Effect */}
      <motion.div 
        className="absolute inset-0 z-0"
        initial={{ scale: 1.0 }}
        animate={{ scale: 1.1 }}
        transition={{ duration: 25, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
      >
        <div className="absolute inset-0 bg-[#1E40AF]/15 mix-blend-multiply z-10" />
        <img 
          src="/campus.png" 
          alt="Ivy League Campus" 
          className="w-full h-full object-cover"
        />
      </motion.div>

      {/* Main Content Container (Liquid Glass Pattern) */}
      <div className="relative z-20 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 w-full flex items-center justify-center">
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="bg-white/85 backdrop-blur-xl border border-white/60 shadow-[0_30px_60px_rgba(30,64,175,0.15)] rounded-[32px] p-8 md:p-14 max-w-4xl w-full text-center"
        >
          {/* Top Elegant Pill */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="inline-flex items-center gap-3 px-5 py-2.5 bg-[#EFF6FF] border border-[#1E40AF]/10 rounded-full mb-8 shadow-sm"
          >
            <span className="text-[11px] uppercase font-sans tracking-[0.2em] font-bold text-[#1E40AF]">
              {lang === "ru" 
                ? "26 ИЮНЯ, 2026 • АСТАНА ТЕХНОПАРК" 
                : "JUNE 26, 2026 • TECHNOPARK CAMPUS"}
            </span>
          </motion.div>

          {/* Luxury Academic Title */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="font-display text-5xl sm:text-6xl md:text-[84px] font-bold tracking-tight text-[#0F172A] leading-[1.05]"
          >
            {lang === "ru" ? (
              <>
                Путь в топ-вузы мира<br/><span className="text-[#1E40AF] italic font-medium">через Лигу Плюща</span>
              </>
            ) : (
              <>
                The Future of<br/><span className="text-[#1E40AF] italic font-medium">Global Admissions</span>
              </>
            )}
          </motion.h1>

          {/* Clean Sans-serif Description */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-8 text-base md:text-lg text-slate-600 max-w-2xl mx-auto font-sans leading-relaxed font-medium"
          >
            {lang === "ru" 
              ? "Эксклюзивный форум для 500 визионеров. Разборы эссе, стратегии и реальный опыт зачисления напрямую от студентов Гарварда, Стэнфорда и Оксфорда."
              : "An exclusive gathering of 500 visionaries. Experience dynamic profile breakdowns and portfolio tuning from Ivy League students and global scholars."}
          </motion.p>

          {/* Premium Countdown */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="mt-12 flex justify-center"
          >
            <div className="flex gap-4 text-center divide-x divide-slate-200">
              <div className="px-4 md:px-6">
                <span className="block text-3xl font-display font-bold text-[#1E40AF]">{timeLeft.days}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 block font-sans">{lang === "ru" ? "Дней" : "Days"}</span>
              </div>
              <div className="px-4 md:px-6">
                <span className="block text-3xl font-display font-bold text-[#1E40AF]">{String(timeLeft.hours).padStart(2, "0")}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 block font-sans">{lang === "ru" ? "Часов" : "Hours"}</span>
              </div>
              <div className="px-4 md:px-6">
                <span className="block text-3xl font-display font-bold text-[#1E40AF]">{String(timeLeft.minutes).padStart(2, "0")}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 block font-sans">{lang === "ru" ? "Минут" : "Mins"}</span>
              </div>
              <div className="px-4 md:px-6">
                <span className="block text-3xl font-display font-bold text-[#3B82F6]">{String(timeLeft.seconds).padStart(2, "0")}</span>
                <span className="text-[10px] font-bold text-[#3B82F6]/70 uppercase tracking-widest mt-1 block font-sans">{lang === "ru" ? "Сек" : "Secs"}</span>
              </div>
            </div>
          </motion.div>

          {/* Elegant CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={() => scrollToSection("tickets")}
              className="w-full sm:w-auto bg-[#1E40AF] px-10 py-4 text-[11px] font-bold uppercase tracking-[0.15em] text-white hover:bg-[#1E3A8A] transition-colors cursor-pointer rounded-none duration-300 shadow-md font-sans"
            >
              {lang === "ru" ? "Забронировать место" : "Secure Your Ticket"}
            </button>
            <button
              onClick={() => scrollToSection("speakers")}
              className="w-full sm:w-auto border border-slate-200 bg-white px-10 py-4 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer rounded-none duration-300 font-sans"
            >
              {lang === "ru" ? "Программа форума" : "Explore Program"}
            </button>
          </motion.div>
        </motion.div>

      </div>

      {/* Minimal Scroll Arrow pointing down */}
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 cursor-pointer p-4"
        onClick={() => scrollToSection("speakers")}
      >
        <div className="bg-white/50 backdrop-blur-md rounded-full p-2 border border-white/40 shadow-sm hover:bg-white transition-colors">
          <ChevronDown className="h-5 w-5 text-[#1E40AF]" />
        </div>
      </motion.div>

    </section>
  );
}
