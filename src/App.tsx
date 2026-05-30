import React, { useState, useEffect } from "react";
import { 
  Award, Globe, Landmark, Clock, ArrowRight, Sparkles, HelpCircle, GraduationCap, Phone, Mail, 
  MapPin, Loader2, ChevronRight, CheckCircle2, ShieldAlert
} from "lucide-react";

// Components
import Header from "./components/Header";
import Hero from "./components/Hero";
import SpeakerCard from "./components/SpeakerCard";
import SchedulePanel from "./components/SchedulePanel";
import TicketsPanel from "./components/TicketsPanel";
import PartnersPanel from "./components/PartnersPanel";
import Newsletter from "./components/Newsletter";
import AdminCMS from "./components/AdminCMS";

import { PublicData } from "./types";

export default function App() {
  const [lang, setLang] = useState<"ru" | "en">("ru");
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataTrigger, setDataTrigger] = useState(0);

  // Core public information state
  const [publicData, setPublicData] = useState<PublicData | null>(null);

  // Fetch all database metrics from backend
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

  // Loading skeleton layout
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50/50 space-y-4" id="global_loader">
        <Loader2 className="h-10 w-10 animate-spin text-sky-400" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">
          Assembling Forum Workspace...
        </p>
      </div>
    );
  }

  // Fallback state if server returns empty
  const data = publicData || {
    settings: {
      eventDate: "June 26, 2026",
      eventVenue: "Astana Technopark, Block C4",
      contactPhone: "+7 (7172) 55-44-33",
      contactEmail: "info@mainedu.kz"
    },
    speakers: [],
    program: [],
    partners: [],
    tickets: []
  };

  const featuredSpeakers = data.speakers.filter(s => s.isFeatured);
  const normalSpeakers = data.speakers.filter(s => !s.isFeatured);

  return (
    <div className="min-h-screen bg-white text-slate-700 antialiased font-sans flex flex-col justify-between selection:bg-sky-100 selection:text-sky-950" id="main_app_wrapper">
      
      {/* 1. Header Navigation and lang switcher */}
      <Header 
        lang={lang} 
        setLang={setLang} 
        isAdminOpen={isAdminOpen} 
        setIsAdminOpen={setIsAdminOpen} 
      />

      {/* 2. Main Page content panels */}
      <main className="flex-grow">
        {isAdminOpen ? (
          /* ADMINISTRATIVE CMS CONSOLE VIEW */
          <div className="bg-slate-50/30 min-h-[75vh] animate-fade-in" id="admin_cms_panel_wrapper">
            <AdminCMS lang={lang} onDataChange={forceRefetch} />
          </div>
        ) : (
          /* STANDARD PUBLIC VISITOR LANDING VIEW */
          <div className="space-y-24 sm:space-y-32 pb-24" id="visitor_landing_wrapper">
            
            {/* HERO SECTION */}
            <Hero lang={lang} settings={data.settings} />

            {/* KEY METRICS BENTO GRID */}
            <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 animate-fade-in" id="stats_metrics_section">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-slate-200 bg-white divide-x-0 md:divide-x divide-y md:divide-y-0 divide-slate-200">
                <div className="p-8 text-left bg-white">
                  <span className="block text-4xl font-extrabold font-mono tracking-tight text-slate-900">500+</span>
                  <span className="mt-2.5 block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                    {lang === "ru" ? "Участников" : "Live Attendees"}
                  </span>
                  <p className="mt-1.5 text-2xs text-slate-400 font-medium">Astana Technopark scale limits</p>
                </div>
                
                <div className="p-8 text-left bg-white">
                  <span className="block text-4xl font-extrabold font-mono tracking-tight text-slate-900">16+</span>
                  <span className="mt-2.5 block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                    {lang === "ru" ? "Топ-советников" : "Ivy Advisers"}
                  </span>
                  <p className="mt-1.5 text-2xs text-slate-400 font-medium font-sans">Harvard, Stanford, Oxford, Cambridge</p>
                </div>

                <div className="p-8 text-left bg-white">
                  <span className="block text-4xl font-extrabold font-mono tracking-tight text-slate-900">1</span>
                  <span className="mt-2.5 block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                    {lang === "ru" ? "Полный День" : "Intense Day"}
                  </span>
                  <p className="mt-1.5 text-2xs text-slate-400 font-medium">From 09:30 am to 06:00 pm</p>
                </div>

                <div className="p-8 text-left bg-slate-50/50">
                  <span className="block text-4xl font-extrabold font-mono tracking-tight text-slate-900">100%</span>
                  <span className="mt-2.5 block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                    {lang === "ru" ? "Реальный Опыт" : "Practical Focus"}
                  </span>
                  <p className="mt-1.5 text-2xs text-slate-400 font-medium">Live essay tuning & evaluations</p>
                </div>
              </div>
            </section>

            {/* SPEAKERS SECTION */}
            <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" id="speakers">
              <div className="text-left mb-12 sm:mb-16">
                <span className="inline-flex items-center gap-3 border border-slate-200 bg-slate-100/30 px-3.5 py-1.5 text-2xs font-extrabold text-slate-500 tracking-widest uppercase font-mono">
                  {lang === "ru" ? "ПРИГЛАШЕННЫЕ ЛЕКТОРЫ" : "REPRESENTING ELITE ACADEMIA"}
                </span>
                <h2 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl uppercase">
                  {lang === "ru" 
                    ? "Более 16 Спикеров из Лучших Университетов" 
                    : "Meet Your Ivy & Global Admissions Advisers"}
                </h2>
                <p className="mt-4 text-sm text-slate-500 max-w-3xl leading-relaxed">
                  {lang === "ru"
                    ? "Наши лекторы — не просто теоретики, а казахстанские студенты, успешно прошедшие отбор в топ-вузы Лиги Плюща и мира. Кликните на карточку спикера, чтобы узнать детали презентации."
                    : "These are real-world high achievers, sharing their portfolios, standardized score tactics, and actual application essays. Click any presenter card to check details."}
                </p>
              </div>

              {/* 1. Feature Speakers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8" id="featured_speakers_grid">
                {featuredSpeakers.map(speaker => (
                  <SpeakerCard key={speaker.id} speaker={speaker} lang={lang} />
                ))}
              </div>

              {/* 2. Standard Speakers Grid */}
              {normalSpeakers.length > 0 && (
                <div className="mt-12 sm:mt-16 border-t border-slate-200 pt-12 text-left">
                  <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] font-mono mb-8">
                    {lang === "ru" ? "Все спикеры и консультанты" : "Additional Admissions Consultants"}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8" id="all_speakers_list">
                    {normalSpeakers.map(speaker => (
                      <SpeakerCard key={speaker.id} speaker={speaker} lang={lang} />
                    ))}
                  </div>
                </div>
              )}
            </section>
 
            {/* TIMELINE SECTION */}
            <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" id="schedule">
              <SchedulePanel program={data.program} speakers={data.speakers} lang={lang} />
            </section>
 
            {/* TICKETS SECTION */}
            <section className="bg-slate-50 py-20 border-y border-slate-200" id="tickets">
              <TicketsPanel tickets={data.tickets} lang={lang} />
            </section>
 
            {/* PARTNERS SECTION */}
            <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" id="partners">
              <PartnersPanel partners={data.partners} lang={lang} />
            </section>
 
            {/* NEWSLETTER CAPTURE */}
            <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" id="newsletter">
              <Newsletter lang={lang} />
            </section>
 
          </div>
        )}
      </main>
 
      {/* 3. Footer Branding Area */}
      <footer className="border-t border-slate-200 bg-[#F8FAFC] py-12" id="footer_container">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8 space-y-6">
          
          <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-200 pb-8 gap-4">
            <div className="flex items-center gap-2.5 text-left">
              <div>
                <span className="block font-display font-black tracking-tight text-slate-900 text-sm">
                  THE MAIN <span className="text-blue-500 font-bold font-mono">2026</span>
                </span>
                <span className="block text-[10px] text-slate-400 uppercase font-mono font-bold tracking-widest mt-1">
                  Hosted inside Astana Technopark • June 26, 2026
                </span>
              </div>
            </div>
 
            {/* Outbound Contacts display */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500 font-mono">
              <a href={`mailto:${data.settings.contactEmail}`} className="hover:text-blue-500 flex items-center space-x-1.5 transition">
                <Mail className="h-4 w-4 text-slate-400" />
                <span>{data.settings.contactEmail}</span>
              </a>
              <span className="hidden sm:inline text-slate-200">|</span>
              <a href={`tel:${data.settings.contactPhone}`} className="hover:text-blue-500 flex items-center space-x-1.5 transition">
                <Phone className="h-4 w-4 text-slate-400" />
                <span>{data.settings.contactPhone}</span>
              </a>
            </div>
          </div>
 
          <div className="flex flex-col sm:flex-row items-center justify-between text-2xs text-slate-400 font-medium">
            <p>
              © {new Date().getFullYear()} {lang === "ru" ? "Главное Образовательное Событие Года." : "The Main Educational Event of the Year."} All Rights Reserved.
            </p>
            <p className="mt-2 sm:mt-0 font-mono text-[10px] uppercase tracking-wider text-slate-400">
              Designed with Swiss/Airy Minimalism • Powered by Technopark Hub
            </p>
          </div>
 
        </div>
      </footer>
    </div>
  );
}
