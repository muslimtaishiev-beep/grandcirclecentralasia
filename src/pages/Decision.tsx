import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Confetti from 'react-confetti';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion } from 'framer-motion';

const Decision: React.FC = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  
  const [videoFinished, setVideoFinished] = useState(false);
  const [letterTemplate, setLetterTemplate] = useState('');
  const [loading, setLoading] = useState(true);

  const status = userData?.decisionStatus || 'pending';
  const isAccepted = status === 'accepted';

  useEffect(() => {
    if (status === 'pending') {
      navigate('/dashboard');
      return;
    }

    const fetchTemplate = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'admission'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          const template = isAccepted ? data.acceptanceTemplate : data.rejectionTemplate;
          
          if (template) {
            // Replace variables
            let personalizedTemplate = template
              .replace(/{{firstName}}/g, userData?.firstName || 'Student')
              .replace(/{{lastName}}/g, userData?.lastName || '');
            setLetterTemplate(personalizedTemplate);
          }
        }
      } catch (error) {
        console.error('Error fetching letter template:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [status, userData, isAccepted, navigate]);

  // If video is still playing, show video layer
  if (!videoFinished) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        {/* Make sure public/acceptance.mp4 exists, or it will just immediately fire onEnded if not found in a real app, 
            but for safety we add a fallback button. */}
        <video 
          src="/acceptance.mp4" 
          autoPlay 
          playsInline 
          onEnded={() => setVideoFinished(true)}
          className="w-full h-full object-cover"
        />
        <button 
          onClick={() => setVideoFinished(true)}
          className="absolute bottom-8 right-8 text-white/50 hover:text-white text-sm uppercase tracking-widest transition-colors"
        >
          Skip Video
        </button>
      </div>
    );
  }

  // Letter Layer
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12 relative overflow-hidden">
      {isAccepted && <Confetti recycle={false} numberOfPieces={800} gravity={0.15} />}

      <motion.div 
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="w-full max-w-3xl bg-white border border-slate-200 p-8 sm:p-16 shadow-lg relative z-10"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12 border-b border-slate-200 pb-8 space-y-6 sm:space-y-0">
          <div className="flex items-center space-x-6">
            <img src="/logo1.png" alt="Logo 1" className="h-12 sm:h-14 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
            <img src="/logo2.png" alt="Logo 2" className="h-12 sm:h-14 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
            <img src="/logo3.png" alt="Logo 3" className="h-12 sm:h-14 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
          </div>
          <div className="text-left sm:text-right">
            <h2 className="font-display uppercase tracking-tight text-xl mb-1">Office of Admissions</h2>
            <p className="text-sm text-slate-500">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse w-8 h-8 bg-slate-200"></div>
          </div>
        ) : (
          <div 
            className="prose prose-slate max-w-none text-slate-800 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: letterTemplate || `<p>Dear ${userData?.firstName}, your status is: <strong>${status}</strong>.</p>` }}
          />
        )}

        <div className="mt-16 pt-8 border-t border-slate-100 flex justify-center">
          <button 
            onClick={() => navigate('/dashboard')}
            className="px-8 py-3 bg-slate-900 text-white font-bold text-sm uppercase tracking-wider hover:bg-slate-800 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Decision;
