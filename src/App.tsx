import React, { useState, useEffect } from "react";
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
import AdminCMS from "./components/AdminCMS";
import { MetricsCarousel } from "./components/MetricsCarousel";
import GlobalWatermarks from "./components/GlobalWatermarks";

import { PublicData } from "./types";
import { staticDb } from "./data/staticDb";

export default function App() {
  const [lang, setLang] = useState<"ru" | "en" | "kg">("ru");
  
  // Basic routing
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [loading, setLoading] = useState(true);
  const [dataTrigger, setDataTrigger] = useState(0);
  const [showAllSpeakers, setShowAllSpeakers] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  const [publicData, setPublicData] = useState<PublicData | null>(null);

  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        const response = await fetch("/api/public/data");
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

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#EDE9FE] space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#9F7AEA]" />
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
          Loading Data...
        </p>
      </div>
    );
  }

  const data = {
    settings: publicData?.settings || staticDb.settings,
    speakers: publicData?.speakers || staticDb.speakers,
    program: publicData?.program || staticDb.program,
    partners: publicData?.partners || staticDb.partners,
    tickets: publicData?.tickets || staticDb.tickets,
    metrics: publicData?.metrics && publicData.metrics.length > 0 ? publicData.metrics : staticDb.metrics
  } as unknown as PublicData;

  const isAdminPath = currentPath === "/admin";
  const isTicketsPath = currentPath === "/tickets";

  return (
    <div className="min-h-screen bg-[#EDE9FE] text-slate-800 antialiased font-sans flex flex-col justify-between" id="main_app_wrapper">
      
      {/* Header is global */}
      {!isAdminPath && (
        <Header 
          lang={lang} 
          setLang={setLang} 
          onNavigate={navigate}
        />
      )}

      <main className="flex-grow">
        {isAdminPath ? (
          <div className="bg-[#EDE9FE] min-h-[75vh]">
            <AdminCMS lang={lang} onDataChange={forceRefetch} />
          </div>
        ) : isTicketsPath ? (
          /* TICKETS PAGE */
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="pt-20 pb-32"
          >
            <TicketsPanel tickets={data.tickets} lang={lang} />
          </motion.div>
        ) : (
          /* MAIN LANDING PAGE */
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
            <GlobeSplitSection />
 
            {/* TIMELINE SECTION */}
            <motion.section 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" id="schedule"
            >
              <SchedulePanel program={data.program} speakers={data.speakers} lang={lang} />
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
 
            {/* NEWSLETTER CAPTURE */}
            <motion.section 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-10" id="newsletter"
            >
              <Newsletter lang={lang} />
            </motion.section>
 
          </div>
        )}
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
