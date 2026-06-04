import React from "react";
import { Globe, GraduationCap } from "lucide-react";

interface HeaderProps {
  lang: "ru" | "en" | "kg";
  setLang: (lang: "ru" | "en" | "kg") => void;
  onNavigate?: (path: string) => void;
}

export default function Header({ lang, setLang, onNavigate }: HeaderProps) {
  const handleNavigate = (id: string, path: string = "/") => {
    if (onNavigate && window.location.pathname !== path) {
      onNavigate(path);
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className="hidden md:block sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleNavigate("hero")}>
          <GraduationCap className="h-8 w-8 text-[#9F7AEA]" />
          <span className="text-xl font-black tracking-tighter text-slate-900 hidden sm:block">
            Study Free <span className="text-[#9F7AEA]">Forum</span>
          </span>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-10 font-medium text-sm text-slate-600">
          <button onClick={() => handleNavigate("speakers")} className="hover:text-[#9F7AEA] transition-colors">
            {lang === "ru" ? "Спикеры" : lang === "kg" ? "Спикерлер" : "Speakers"}
          </button>
          <button onClick={() => handleNavigate("schedule")} className="hover:text-[#9F7AEA] transition-colors">
            {lang === "ru" ? "Программа" : lang === "kg" ? "Программа" : "Program"}
          </button>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLang(lang === "ru" ? "en" : lang === "en" ? "kg" : "ru")}
            className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Globe className="h-4 w-4 text-[#9F7AEA]" />
            <span>{lang.toUpperCase()}</span>
          </button>

          <button
            onClick={() => onNavigate && onNavigate("/tickets")}
            className="hidden lg:flex items-center justify-center bg-[#9F7AEA] rounded-full px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-[#8B5CF6] transition-colors shadow-md"
          >
            {lang === "ru" ? "Забронировать" : lang === "kg" ? "Билет алуу" : "Get Tickets"}
          </button>
        </div>
      </div>
    </header>
  );
}
