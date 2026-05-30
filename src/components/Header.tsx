import React from "react";
import { Globe, Shield, Sparkles } from "lucide-react";

interface HeaderProps {
  lang: "ru" | "en";
  setLang: (l: "ru" | "en") => void;
  isAdminOpen: boolean;
  setIsAdminOpen: (b: boolean) => void;
}

export default function Header({ lang, setLang, isAdminOpen, setIsAdminOpen }: HeaderProps) {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md" id="header_container">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo / Title */}
        <div 
          onClick={() => scrollTo("hero")} 
          className="flex cursor-pointer items-baseline gap-1.5 transition hover:opacity-85"
          id="logo_btn"
        >
          <span className="font-display font-black tracking-tighter uppercase text-slate-900 text-lg sm:text-xl">
            THE MAIN <span className="text-blue-500 font-bold font-mono">2026</span>
          </span>
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-10 text-xs font-bold tracking-widest uppercase text-slate-600">
          <button 
            onClick={() => scrollTo("speakers")} 
            className="transition hover:text-blue-500 cursor-pointer text-slate-500 hover:text-slate-900"
            id="nav_speakers"
          >
            {lang === "ru" ? "Спикеры" : "Speakers"}
          </button>
          <button 
            onClick={() => scrollTo("schedule")} 
            className="transition hover:text-blue-500 cursor-pointer text-slate-500 hover:text-slate-900"
            id="nav_schedule"
          >
            {lang === "ru" ? "Программа" : "Program"}
          </button>
          <button 
            onClick={() => scrollTo("tickets")} 
            className="transition hover:text-blue-500 cursor-pointer text-slate-500 hover:text-slate-900"
            id="nav_tickets"
          >
            {lang === "ru" ? "Билеты" : "Tickets"}
          </button>
          <button 
            onClick={() => scrollTo("partners")} 
            className="transition hover:text-blue-500 cursor-pointer text-slate-500 hover:text-slate-900"
            id="nav_partners"
          >
            {lang === "ru" ? "Партнеры" : "Partners"}
          </button>
        </nav>

        {/* Global Controls & Actions */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Language Switch Panel */}
          <div className="flex items-center bg-slate-100/70 border border-slate-200 p-0.5 rounded-none" id="lang_switcher">
            <button
              onClick={() => setLang("ru")}
              className={`px-3 py-1 text-2xs font-extrabold rounded-none transition-all cursor-pointer ${
                lang === "ru" 
                   ? "bg-white text-slate-900 shadow-xs border border-slate-200" 
                  : "text-slate-400 hover:text-slate-600"
              }`}
              id="btn_lang_ru"
            >
              RU
            </button>
            <button
              onClick={() => setLang("en")}
              className={`px-3 py-1 text-2xs font-extrabold rounded-none transition-all cursor-pointer ${
                lang === "en" 
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200" 
                  : "text-slate-400 hover:text-slate-600"
              }`}
              id="btn_lang_en"
            >
              EN
            </button>
          </div>

          {/* CMS Admin Button */}
          <button
            onClick={() => setIsAdminOpen(!isAdminOpen)}
            className={`flex items-center space-x-1.5 border px-3 py-1.5 text-2xs font-bold tracking-wider uppercase cursor-pointer transition rounded-none ${
              isAdminOpen 
                ? "bg-blue-50 border-blue-200 text-blue-600" 
                : "border-slate-200 hover:bg-slate-50 text-slate-600"
            }`}
            title="CMS Panel"
            id="admin_panel_toggle_btn"
          >
            <Shield className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {isAdminOpen ? (lang === "ru" ? "Выйти" : "Exit CMS") : (lang === "ru" ? "Админка" : "CMS")}
            </span>
          </button>

          {/* Quick Registration Button */}
          <button
            onClick={() => scrollTo("tickets")}
            className="hidden sm:flex items-center justify-center bg-slate-900 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-blue-500 transition-all cursor-pointer rounded-none animate-fade-in"
            id="header_cta_btn"
          >
            {lang === "ru" ? "Забронировать" : "Register"}
          </button>
        </div>
      </div>
    </header>
  );
}
