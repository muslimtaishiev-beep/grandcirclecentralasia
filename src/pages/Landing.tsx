import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface LandingProps {
  lang?: "ru" | "en" | "kg";
}

const Landing: React.FC<LandingProps> = ({ lang = "ru" }) => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-dvh bg-black text-white overflow-hidden font-sans">
      {/* Background Video placeholder */}
      <div className="absolute inset-0 z-0 opacity-50 bg-slate-900">
        <video 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="w-full h-full object-cover"
        >
          <source src="/bg-video.mp4" type="video/mp4" />
        </video>
      </div>

      {/* Squiggly Lines Background */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none flex items-end justify-center">
        <svg 
          viewBox="0 -200 1600 1200" 
          preserveAspectRatio="none" 
          overflow="visible"
          className="w-full h-[100%] object-fill scale-[2] md:scale-[2.5] translate-y-1/3"
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

      <div className="relative z-10 flex flex-col items-center justify-center min-h-dvh px-4 py-20 text-center">
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl w-full"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs sm:text-sm font-medium mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            {lang === "ru" ? "Регистрация открыта" : lang === "kg" ? "Каттоо ачык" : "Registration Open"}
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-8xl font-black uppercase tracking-tighter mb-6 leading-none">
            FUTURE LEADERS
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-300 to-slate-500">
              ACADEMY
            </span>
          </h1>

          <p className="text-lg sm:text-2xl text-slate-300 mb-12 max-w-2xl mx-auto font-light">
            {lang === "ru" 
              ? "Первый этап отбора — диагностический тест. Покажи свои знания и стань частью будущего."
              : lang === "kg"
              ? "Тандоонун биринчи этапы - диагностикалык тест. Билимиңди көрсөт жана келечектин бир бөлүгү бол."
              : "First stage of selection — diagnostic test. Show your knowledge and become part of the future."}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => navigate('/register')}
              className="w-full sm:w-auto px-8 py-4 bg-white text-black font-bold uppercase tracking-wider border-2 border-white hover:bg-transparent hover:text-white transition-colors"
            >
              {lang === "ru" ? "Узнать результаты" : lang === "kg" ? "Жыйынтыкты көрүү" : "Check Results"}
            </button>
            <button 
              onClick={() => navigate(`/${orgSlug}/test`)}
              className="w-full sm:w-auto px-8 py-4 bg-transparent text-white font-bold uppercase tracking-wider border-2 border-white hover:bg-white hover:text-black transition-colors"
            >
              {lang === "ru" ? "Вход для участников" : lang === "kg" ? "Катышуучулар үчүн кирүү" : "Participant Login"}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Landing;
