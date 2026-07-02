import React, { useState, useEffect } from 'react';
import html2pdf from 'html2pdf.js';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Confetti from 'react-confetti';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion } from 'framer-motion';

interface DecisionProps {
  lang?: string;
}

const Decision: React.FC<DecisionProps> = ({ lang }) => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  
  const [videoFinished, setVideoFinished] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
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

  // If video is still playing and user is accepted, show video layer
  if (isAccepted && !videoFinished) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        {isVideoLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
             <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
             <p className="text-white/60 font-mono text-sm tracking-widest uppercase animate-pulse">
                {lang === "ru" ? "Загрузка видео..." : "Loading Video..."}
             </p>
          </div>
        )}
        <video 
          src="/acceptance.mp4" 
          autoPlay 
          playsInline
          preload="auto"
          onCanPlay={() => setIsVideoLoading(false)}
          onPlaying={() => setIsVideoLoading(false)}
          onWaiting={() => setIsVideoLoading(true)}
          onEnded={() => setVideoFinished(true)}
          className={`w-full h-full object-cover transition-opacity duration-1000 ${isVideoLoading ? 'opacity-0' : 'opacity-100'}`}
        />
        <button 
          onClick={() => setVideoFinished(true)}
          className="absolute bottom-8 right-8 text-white/50 hover:text-white z-10 text-sm uppercase tracking-widest transition-colors"
        >
          Skip Video
        </button>
      </div>
    );
  }

  const handleDownloadPdf = () => {
    const element = document.getElementById('decision-letter-content');
    if (!element) return;
    const opt = {
      margin:       [15, 15, 15, 15],
      filename:     `Decision_Letter_${userData?.firstName}_${userData?.lastName}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  // Letter Layer
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12 relative overflow-hidden">
      {isAccepted && <Confetti recycle={false} numberOfPieces={800} gravity={0.15} />}

      <motion.div 
        id="decision-letter-content"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="w-full max-w-3xl bg-white border border-slate-200 p-8 sm:p-16 shadow-lg relative z-10"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12 border-b border-slate-200 pb-8 space-y-6 sm:space-y-0">
          <div className="flex items-center space-x-6">
            <img src="/logo1.png" alt="Logo 1" className="h-24 sm:h-32 object-contain scale-150 origin-left" onError={(e) => (e.currentTarget.style.display = 'none')} />
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

        <div className="mt-16 pt-8 border-t border-slate-100 flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6" data-html2canvas-ignore>
          <button 
            onClick={() => navigate('/dashboard')}
            className="px-8 py-3 bg-slate-900 text-white font-bold text-sm uppercase tracking-wider hover:bg-slate-800 transition-colors"
          >
            Return to Dashboard
          </button>
          {!loading && (
            <button 
              onClick={handleDownloadPdf}
              className="px-8 py-3 bg-white text-slate-900 border border-slate-300 font-bold text-sm uppercase tracking-wider hover:bg-slate-50 transition-colors flex items-center space-x-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Download PDF</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Decision;
