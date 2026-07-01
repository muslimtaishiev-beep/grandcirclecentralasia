import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface LandingProps {
  lang?: "ru" | "en" | "kg";
}

const Landing: React.FC<LandingProps> = ({ lang = "ru" }) => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden font-sans">
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

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-3xl"
        >
          <h1 className="text-4xl md:text-6xl font-display uppercase tracking-tighter mb-6 leading-tight">
            Future Leaders School<br/>
            <span className="text-[#9F7AEA]">
              Olympiad 2026
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl mx-auto font-medium leading-relaxed">
            {lang === "ru" 
              ? "Официальный портал грандиозной олимпиады. Победители получают эксклюзивный шанс на бесплатное обучение в Школе Будущих Лидеров — ведущем проекте страны по подготовке к поступлению в топовые мировые вузы." 
              : lang === "kg" 
              ? "Грандиоздук олимпиаданын расмий порталы. Жеңүүчүлөр өлкөнүн алдыңкы долбоору болгон Келечектеги Лидерлер Мектебинде акысыз билим алууга эксклюзивдүү мүмкүнчүлүк алышат — алдыңкы дүйнөлүк университеттерге даярдоо." 
              : "The official portal of the grand Olympiad. Winners gain an exclusive, fully-funded opportunity to join the Future Leaders School — the nation's premier program preparing students for top-tier global universities."}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => navigate('/register')}
              className="w-full sm:w-auto px-8 py-4 bg-white text-black font-bold uppercase tracking-wider border-2 border-white hover:bg-transparent hover:text-white transition-colors"
            >
              {lang === "ru" ? "Регистрация" : lang === "kg" ? "Катталуу" : "Register"}
            </button>
            <button 
              onClick={() => navigate('/login')}
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
