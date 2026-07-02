import React, { useState, useEffect, Suspense, lazy } from "react";
import { motion } from "motion/react";
import { 
  Award, Globe, Landmark, Clock, ArrowRight, Phone, Mail, 
  MapPin, Loader2, ChevronRight, CheckCircle2
} from "lucide-react";

// Components
import Header from "./components/Header";
import Hero from "./components/Hero";
import { GlobeSplitSection } from "./components/GlobeSplitSection";
import SchedulePanel from "./components/SchedulePanel";
import TicketsPanel from "./components/TicketsPanel";
import PartnersPanel from "./components/PartnersPanel";
import Newsletter from "./components/Newsletter";
import FAQSection from "./components/FAQSection";
const AdminCMS = lazy(() => import("./components/AdminCMS"));
import GlobalWatermarks from "./components/GlobalWatermarks";
import { MetricsCarousel } from "./components/MetricsCarousel";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";

// New Pages
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Decision = lazy(() => import("./pages/Decision"));
const Landing = lazy(() => import("./pages/Landing"));
import { ProtectedRoute } from "./components/ProtectedRoute";

import { PublicData } from "./types";
import { staticDb } from "./data/staticDb";

export default function App() {
  const [lang, setLang] = useState<"ru" | "en" | "kg">("ru");
  
  // Basic routing via react-router
  const location = useLocation();
  const navigateRouter = useNavigate();
  const currentPath = location.pathname;
  const [loading, setLoading] = useState(true);
  const [dataTrigger, setDataTrigger] = useState(0);
  const [showAllSpeakers, setShowAllSpeakers] = useState(false);

  const navigate = (path: string) => {
    navigateRouter(path);
    window.scrollTo(0, 0);
  };

  const [publicData, setPublicData] = useState<PublicData | null>(null);

  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        const response = await fetch((import.meta.env.VITE_API_URL || "") + "/api/public/data");
        if (response.ok) {
          const resJson = await response.json();
          setPublicData(resJson);
        }
      } catch (err) {
        console.error("Failed to load global server resources.", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPublicData();
  }, [dataTrigger]);

  const forceRefetch = () => {
    setDataTrigger(prev => prev + 1);
  };

  // The app will now render immediately using staticDb while the backend wakes up in the background.

  const data = {
    settings: publicData?.settings || staticDb.settings,
    speakers: publicData?.speakers || staticDb.speakers,
    program: publicData?.program || staticDb.program,
    partners: publicData?.partners || staticDb.partners,
    tickets: publicData?.tickets || staticDb.tickets,
    metrics: publicData?.metrics && publicData.metrics.length > 0 ? publicData.metrics : staticDb.metrics,
    universities: publicData?.universities && publicData.universities.length > 0 ? publicData.universities : []
  } as unknown as PublicData;

  const isAdminPath = currentPath === "/admin";
  const isTicketsPath = currentPath === "/tickets";

  return (
    <div className="min-h-screen bg-[#EDE9FE] text-slate-800 antialiased font-sans flex flex-col justify-between" id="main_app_wrapper">
      
      {/* Header is global */}
      {!isAdminPath && !currentPath.startsWith("/admission") && !currentPath.startsWith("/login") && !currentPath.startsWith("/register") && !currentPath.startsWith("/dashboard") && !currentPath.startsWith("/decision") && (
        <Header 
          lang={lang} 
          setLang={setLang} 
          onNavigate={navigate}
        />
      )}

      {/* Floating Language Switcher for Admission Portal Pages */}
      {(!isAdminPath && (currentPath.startsWith("/admission") || currentPath.startsWith("/login") || currentPath.startsWith("/register") || currentPath.startsWith("/dashboard") || currentPath.startsWith("/decision"))) && (
        <div className="absolute top-4 right-4 md:top-8 md:right-8 z-50">
          <button 
            onClick={() => setLang(lang === "ru" ? "en" : lang === "en" ? "kg" : "ru")}
            className="px-4 py-2 bg-slate-900/50 backdrop-blur-md border border-white/20 text-white font-mono text-sm uppercase tracking-widest hover:bg-slate-800/80 transition-colors rounded-full shadow-lg flex items-center gap-2"
          >
            <Globe className="w-4 h-4" />
            {lang === "ru" ? "RU" : lang === "en" ? "EN" : "KG"}
          </button>
        </div>
      )}

      <main className="flex-grow">
        <Suspense fallback={<div className="min-h-screen flex flex-col items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 animate-spin text-slate-400 mb-4" /><div className="text-slate-500 text-sm font-medium uppercase tracking-widest">Loading...</div></div>}>
        <Routes>
          <Route path="/admin" element={
            <div className="bg-[#EDE9FE] min-h-[75vh]">
              <AdminCMS lang={lang} onDataChange={forceRefetch} />
            </div>
          } />
          
          <Route path="/tickets" element={
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="pt-20 pb-32"
            >
              <TicketsPanel tickets={data.tickets} lang={lang} />
            </motion.div>
          } />

          {/* Admission Portal Routes */}
          <Route path="/admission" element={<Landing lang={lang} />} />
          <Route path="/login" element={<Login lang={lang} />} />
          <Route path="/register" element={<Signup lang={lang} />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard lang={lang} />
            </ProtectedRoute>
          } />
          <Route path="/decision" element={
            <ProtectedRoute>
              <Decision lang={lang} />
            </ProtectedRoute>
          } />

          {/* Main Forum Route */}
          <Route path="/" element={
            <div className="space-y-0 pb-10 relative">
              <GlobalWatermarks />
              
              <Hero lang={lang} settings={data.settings} onNavigate={navigate} />

              {/* KEY METRICS BENTO GRID */}
              <motion.section 
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-20"
              >
                <MetricsCarousel lang={lang} metrics={data.metrics} />
              </motion.section>

              {/* GLOBE & SPEAKERS SECTION */}
              <GlobeSplitSection speakers={data.speakers} universities={data.universities} />
   
              {/* TIMELINE SECTION */}
              <motion.section 
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" id="schedule"
              >
                <SchedulePanel program={data.program} speakers={data.speakers} universities={data.universities} lang={lang} />
              </motion.section>
   
              {/* PARTNERS SECTION */}
              <motion.section 
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="py-8 md:py-10 border-y border-[#E9D5FF]/50" id="partners"
              >
                <PartnersPanel partners={data.partners} lang={lang} />
              </motion.section>

              {/* NEWSLETTER */}
              <motion.section 
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="py-12 md:py-16"
              >
                <Newsletter lang={lang} />
              </motion.section>

              {/* FAQ */}
              <FAQSection lang={lang} />
            </div>
          } />
        </Routes>
        </Suspense>
      </main>
 
      {/* Footer Branding Area */}
      <footer className="border-t border-[#E9D5FF]/80 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-100 pb-8 gap-4">
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
              <span className="block text-xl font-bold text-slate-900 tracking-tight">
                LEAD+ <span className="text-[#9F7AEA]">Forum</span>
              </span>
              <span className="block text-sm text-slate-500 mt-1">
                Кыргызстан, Бишкек, Технопарк
              </span>
            </div>
 
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600 font-medium">
              <a href={`tel:${data.settings.contactPhone}`} className="hover:text-[#9F7AEA] flex items-center space-x-2 transition">
                <Phone className="h-4 w-4 text-slate-400" />
                <span>{data.settings.contactPhone}</span>
              </a>
              <span className="hidden sm:inline text-slate-300">|</span>
              <a href="https://www.instagram.com/youthleadnetwork?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==" target="_blank" rel="noopener noreferrer" className="hover:text-[#9F7AEA] font-bold">
                Instagram
              </a>
            </div>
          </div>
 
          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 mt-8">
            <p>
              © {new Date().getFullYear()} {lang === "ru" ? "Главное Образовательное Событие Года." : lang === "kg" ? "Жылдын башкы билим берүү окуясы." : "The Main Educational Event of the Year."} All Rights Reserved.
            </p>
          </div>
 
        </div>
      </footer>
    </div>
  );
}
