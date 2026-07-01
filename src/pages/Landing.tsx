import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const Landing: React.FC = () => {
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

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-3xl"
        >
          <h1 className="text-5xl md:text-7xl font-display uppercase tracking-tighter mb-6">
            Admission Portal
          </h1>
          <p className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
            Welcome to the official admissions platform. Start your application or check your decision status.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => navigate('/register')}
              className="w-full sm:w-auto px-8 py-4 bg-white text-black font-bold uppercase tracking-wider border-2 border-white hover:bg-transparent hover:text-white transition-colors"
            >
              Apply Now
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-8 py-4 bg-transparent text-white font-bold uppercase tracking-wider border-2 border-white hover:bg-white hover:text-black transition-colors"
            >
              Applicant Login
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Landing;
