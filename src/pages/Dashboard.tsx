import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, FileText, Briefcase } from 'lucide-react';
import { motion } from 'framer-motion';

interface DashboardProps {
  lang?: "ru" | "en" | "kg";
}

const Dashboard: React.FC<DashboardProps> = ({ lang = "ru" }) => {
  const { userData, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'opportunities' | 'applications'>('applications');

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const hasDecision = userData?.decisionStatus === 'accepted' || userData?.decisionStatus === 'rejected';
  const isAccepted = userData?.decisionStatus === 'accepted';

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Preload the heavy acceptance video in the background as soon as they enter dashboard! */}
      {isAccepted && (
        <video src="/acceptance.mp4" preload="auto" style={{ display: 'none' }} />
      )}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-display uppercase tracking-tighter">
                {lang === 'ru' ? 'Портал Олимпиады' : lang === 'kg' ? 'Олимпиада Порталы' : 'Olympiad Portal'}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-slate-700 hidden sm:block">
                {userData?.firstName} {userData?.lastName}
              </span>
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-slate-900 transition-colors"
                title="Log out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-3xl font-display uppercase tracking-tight mb-8">
          {lang === 'ru' ? 'Панель участника' : lang === 'kg' ? 'Катышуучу панели' : 'Participant Dashboard'}
        </h2>
        
        <div className="flex border-b border-slate-200 mb-8">
          <button
            onClick={() => setActiveTab('applications')}
            className={`pb-4 px-4 font-medium text-sm transition-colors relative ${activeTab === 'applications' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {lang === 'ru' ? 'Мои заявки' : lang === 'kg' ? 'Менин тиркемелерим' : 'Applications'}
            {activeTab === 'applications' && (
              <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('opportunities')}
            className={`pb-4 px-4 font-medium text-sm transition-colors relative ${activeTab === 'opportunities' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {lang === 'ru' ? 'Возможности' : lang === 'kg' ? 'Мүмкүнчүлүктөр' : 'Opportunities'}
            {activeTab === 'opportunities' && (
              <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
            )}
          </button>
        </div>

        {activeTab === 'applications' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6"
          >
            <div className="bg-white p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-slate-100 text-slate-900">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">FUTURE LEADERS SCHOOL OLYMPIAD 2026</h3>
                  <p className="text-sm text-slate-500">Submitted on {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
              <div>
                {hasDecision ? (
                  <button 
                    onClick={() => navigate('/decision')}
                    className="w-full sm:w-auto px-6 py-2 bg-slate-900 text-white font-bold text-sm uppercase tracking-wider hover:bg-slate-800 transition-colors"
                  >
                    View Status Update
                  </button>
                ) : (
                  <span className="inline-block px-4 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold uppercase tracking-wider">
                    Under Review
                  </span>
                )}
              </div>
            </div>

            {/* Animated Lines Graphic */}
            <div className="mt-8 overflow-hidden relative h-48 w-full bg-slate-50 border border-slate-200 shadow-inner flex items-center justify-center">
              <div className="absolute inset-0 opacity-40 pointer-events-none">
                <svg 
                  viewBox="0 0 1600 800" 
                  preserveAspectRatio="none" 
                  className="w-full h-full object-fill scale-125"
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
              <h3 className="relative z-10 text-xl font-display font-black text-slate-800 uppercase tracking-widest bg-white/80 px-6 py-2 border border-slate-200">
                Application Submitted
              </h3>
            </div>
          </motion.div>
        )}

        {activeTab === 'opportunities' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <motion.img 
              src="/totem_bulldog.png" 
              alt="Mascot" 
              className="w-48 h-48 object-contain mb-8 opacity-80 mix-blend-multiply"
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            <h3 className="text-xl font-bold text-slate-400 uppercase tracking-widest">
              no high school opportunities yet
            </h3>
          </motion.div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;
