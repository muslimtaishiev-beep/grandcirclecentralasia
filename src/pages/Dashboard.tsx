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
            className="grid gap-6"
          >
            <div className="bg-white p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-slate-100 text-slate-900">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Fall Admission 2026</h3>
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
          </motion.div>
        )}

        {activeTab === 'opportunities' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-6"
          >
            <div className="bg-white p-6 border border-slate-200 shadow-sm">
              <div className="flex items-start space-x-4 mb-4">
                <div className="p-3 bg-slate-100 text-slate-900">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Scholarships & Grants</h3>
                  <p className="text-sm text-slate-500">Explore financial aid opportunities</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                We offer several merit-based and need-based scholarships. The application for financial aid will open once admissions decisions are finalized.
              </p>
              <button disabled className="px-6 py-2 bg-slate-100 text-slate-400 font-bold text-sm uppercase tracking-wider cursor-not-allowed">
                Not Available Yet
              </button>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;
