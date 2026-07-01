import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, FileText, Briefcase } from 'lucide-react';
import { motion } from 'framer-motion';

const Dashboard: React.FC = () => {
  const { userData, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'opportunities' | 'applications'>('applications');

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const hasDecision = userData?.decisionStatus === 'accepted' || userData?.decisionStatus === 'rejected';

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-display uppercase tracking-tighter">Admission Portal</h1>
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
        <h2 className="text-3xl font-display uppercase tracking-tight mb-8">Applicant Dashboard</h2>
        
        <div className="flex border-b border-slate-200 mb-8">
          <button
            onClick={() => setActiveTab('applications')}
            className={`pb-4 px-4 font-medium text-sm transition-colors relative ${activeTab === 'applications' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Applications
            {activeTab === 'applications' && (
              <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('opportunities')}
            className={`pb-4 px-4 font-medium text-sm transition-colors relative ${activeTab === 'opportunities' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Opportunities
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

            {/* Walking Dog Animation */}
            <div className="mt-12 overflow-hidden relative h-32 w-full flex items-end">
              <motion.img 
                src="/bulldog_walking.png"
                alt="Walking Mascot"
                className="w-24 h-24 object-contain mix-blend-multiply absolute"
                animate={{
                  left: ["-20%", "120%"],
                  y: [0, -8, 0, -8, 0]
                }}
                transition={{
                  left: {
                    duration: 12,
                    repeat: Infinity,
                    ease: "linear"
                  },
                  y: {
                    duration: 0.6,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }
                }}
              />
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
              className="w-48 h-48 mb-6 object-contain mix-blend-multiply"
              animate={{ 
                y: [0, -15, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
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
