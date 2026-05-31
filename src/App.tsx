import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Award, Globe, Landmark, Clock, ArrowRight, Phone, Mail, 
  MapPin, Loader2, ChevronRight, CheckCircle2
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
import { MetricsCarousel } from "./components/MetricsCarousel";
import GlobalWatermarks from "./components/GlobalWatermarks";

import { PublicData } from "./types";

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
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" />
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
          Loading Data...
        </p>
      </div>
    );
  }

  const data = publicData || {
    settings: {
      eventDate: "TBD",
      eventVenue: "Кыргызстан, Бишкек, Технопарк",
      contactPhone: "+995 222 140 709",
      contactEmail: "info@mainedu.kz"
    },
    speakers: [],
    program: [
      { id: "p1", time: "12:00", title_ru: "Открытие и Развлекательная программа", title_en: "Opening & Entertainment", title_kg: "Ачылыш жана Көңүл ачуу программасы", description_ru: "", description_en: "", speakerId: "" },
      { id: "p2", time: "14:00", title_ru: "Крупнейшее Essay Competition в Центральной Азии", title_en: "Largest Essay Competition in Central Asia", title_kg: "Борбордук Азиядагы эң чоң эссе конкурсу", description_ru: "", description_en: "", speakerId: "" },
      { id: "p3", time: "19:00", title_ru: "Закрытие форума", title_en: "Closing", title_kg: "Форумдун жабылышы", description_ru: "", description_en: "", speakerId: "" }
    ],
    partners: [],
    tickets: [
      {
        id: "t1",
        name_ru: "Онлайн", name_en: "Online", name_kg: "Онлайн", price: "500 мест",
        features_ru: ["Доступ к онлайн-трансляции", "Записи лекций", "Электронный сертификат"], features_en: ["Live stream access", "Lecture recordings", "E-certificate"], features_kg: ["Онлайн трансляцияга кирүү", "Лекциялардын жазуулары", "Электрондук сертификат"],
        url: "#", utm_source: "", utm_medium: "", utm_campaign: ""
      },
      {
        id: "t2",
        name_ru: "Офлайн (Early/Regular/Late)", name_en: "Offline (Early/Regular/Late)", name_kg: "Офлайн (Early/Regular/Late)", price: "Потоки",
        features_ru: ["Личное участие", "Увлекательная развлекательная программа", "Крупнейший Essay Competition"], features_en: ["In-person attendance", "Exciting entertainment", "Largest Essay Competition"], features_kg: ["Жеке катышуу", "Кызыктуу көңүл ачуу программасы", "Эң чоң эссе конкурсу"],
        url: "#", utm_source: "", utm_medium: "", utm_campaign: ""
      },
      {
        id: "t3",
        name_ru: "Офлайн + Ужин со спикерами", name_en: "Offline + Dinner with Speakers", name_kg: "Офлайн + Спикерлер менен кечки тамак", price: "VIP",
        features_ru: ["Все опции Офлайн", "Ужин в ресторане со спикерами", "Личный нетворкинг"], features_en: ["All Offline features", "Restaurant dinner with speakers", "Personal networking"], features_kg: ["Бардык Офлайн опциялары", "Спикерлер менен ресторанда кечки тамак", "Жеке нетворкинг"],
        url: "#", utm_source: "", utm_medium: "", utm_campaign: ""
      }
    ]
  };

  const isAdminPath = currentPath === "/admin";
  const isTicketsPath = currentPath === "/tickets";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans flex flex-col justify-between" id="main_app_wrapper">
      
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
          <div className="bg-slate-50 min-h-[75vh]">
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
          <div className="space-y-32 pb-32 relative">
            <GlobalWatermarks />
            
            <Hero lang={lang} settings={data.settings} onNavigate={navigate} />

            {/* KEY METRICS BENTO GRID */}
            <motion.section 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-20 relative z-20"
            >
              <MetricsCarousel lang={lang} />
            </motion.section>

            {/* SPEAKERS SECTION */}
            <motion.section 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" id="speakers"
            >
              <div className="text-center mb-16">
                <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">
                  {lang === "ru" 
                    ? "Узнайте стратегии поступления напрямую от студентов" 
                    : lang === "kg" 
                    ? "Кирүү стратегияларын түз эле студенттерден үйрөнүңүз"
                    : "Learn admission strategies directly from students"}
                </h2>
                <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto">
                  {lang === "ru"
                    ? "Мы пригласили студентов Лиги Плюща. Они покажут свои реальные эссе, результаты тестов и портфолио."
                    : lang === "kg"
                    ? "Биз Плющ Лигасынын студенттерин чакырдык. Алар өздөрүнүн реалдуу эсселерин, тест жыйынтыктарын жана портфолиолорун көрсөтүшөт."
                    : "We invited Ivy League students. They will show their actual essays, test scores, and portfolios."}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {(showAllSpeakers ? data.speakers : data.speakers.slice(0, 4)).map(speaker => (
                  <SpeakerCard key={speaker.id} speaker={speaker} lang={lang} />
                ))}
              </div>

              {data.speakers.length > 4 && (
                <div className="mt-12 text-center">
                  <button 
                    onClick={() => setShowAllSpeakers(!showAllSpeakers)}
                    className="inline-flex items-center justify-center bg-white border border-slate-300 hover:border-[#2563EB] px-8 py-3 text-sm font-bold text-slate-700 hover:text-[#2563EB] uppercase rounded-full transition-colors shadow-sm"
                  >
                    {showAllSpeakers 
                      ? (lang === "ru" ? "Скрыть" : lang === "kg" ? "Жашыруу" : "Hide") 
                      : (lang === "ru" ? "Показать всех" : lang === "kg" ? "Бардыгын көрсөтүү" : "Show All")}
                  </button>
                </div>
              )}
            </motion.section>
 
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
              className="bg-white py-24 border-y border-slate-200" id="partners"
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
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-100 pb-8 gap-4">
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
              <span className="block text-xl font-bold text-slate-900 tracking-tight">
                LEAD+ <span className="text-[#2563EB]">Forum</span>
              </span>
              <span className="block text-sm text-slate-500 mt-1">
                Кыргызстан, Бишкек, Технопарк
              </span>
            </div>
 
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600 font-medium">
              <a href={`tel:${data.settings.contactPhone}`} className="hover:text-[#2563EB] flex items-center space-x-2 transition">
                <Phone className="h-4 w-4 text-slate-400" />
                <span>{data.settings.contactPhone}</span>
              </a>
              <span className="hidden sm:inline text-slate-300">|</span>
              <a href="https://www.instagram.com/youthleadnetwork?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==" target="_blank" rel="noopener noreferrer" className="hover:text-[#2563EB] font-bold">
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
