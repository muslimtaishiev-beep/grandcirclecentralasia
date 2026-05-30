import React, { useState } from "react";
import { X, GraduationCap, Clock, Award, BookOpen, Share2 } from "lucide-react";
import { Speaker } from "../types";

interface SpeakerCardProps {
  key?: string;
  speaker: Speaker;
  lang: "ru" | "en";
}

export default function SpeakerCard({ speaker, lang }: SpeakerCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Map theme colors to CSS gradients
  const getThemeGradient = (theme: string, active: boolean) => {
    if (!active) {
      return "from-slate-200 to-slate-100 border-slate-300 text-slate-500";
    }
    switch (theme) {
      case "blue":
        return "from-sky-500 to-blue-600 border-sky-400 text-white";
      case "purple":
        return "from-purple-500 to-indigo-600 border-purple-400 text-white";
      case "rose":
        return "from-rose-500 to-pink-600 border-rose-400 text-white";
      case "cyan":
        return "from-cyan-500 to-teal-600 border-cyan-400 text-white";
      case "indigo":
        return "from-indigo-500 to-blue-700 border-indigo-400 text-white";
      case "teal":
        return "from-teal-400 to-emerald-600 border-teal-300 text-white";
      case "amber":
        return "from-amber-400 to-orange-500 border-amber-300 text-white";
      case "orange":
        return "from-orange-500 to-amber-600 border-orange-400 text-white";
      case "slate":
        return "from-slate-700 to-slate-900 border-slate-600 text-white";
      case "emerald":
        return "from-emerald-500 to-teal-600 border-emerald-400 text-white";
      default:
        return "from-sky-500 to-blue-600 border-sky-400 text-white";
    }
  };

  const getThemeText = (theme: string) => {
    switch (theme) {
      case "blue": return "text-blue-500 bg-blue-50";
      case "purple": return "text-purple-500 bg-purple-50";
      case "rose": return "text-rose-500 bg-rose-50";
      case "cyan": return "text-cyan-500 bg-cyan-50";
      case "indigo": return "text-indigo-500 bg-indigo-50";
      case "teal": return "text-teal-600 bg-teal-50";
      case "amber": return "text-amber-600 bg-amber-50";
      case "orange": return "text-orange-500 bg-orange-50";
      case "slate": return "text-slate-600 bg-slate-50";
      case "emerald": return "text-emerald-600 bg-emerald-50";
      default: return "text-blue-500 bg-blue-50";
    }
  };

  // Get speaker initials
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <>
      {/* Interactive Speaker Card */}
      <div
        onClick={() => setIsOpen(true)}
        className="group relative cursor-pointer overflow-hidden border border-slate-200 bg-white p-5 transition-all duration-300 hover:border-slate-400 hover:-translate-y-0.5 block"
        id={`speaker_card_${speaker.id}`}
      >
        {/* Grayscale to Color avatar mockup using pure typography and CSS Filters */}
        <div className="relative mb-5 flex h-48 items-center justify-center bg-slate-50 overflow-hidden border border-slate-200 rounded-none">
          {/* Inner Abstract Background starting gray, blooming into color on hover */}
          <div 
            className={`absolute inset-0 bg-gradient-to-tr opacity-95 transition-all duration-500 ${getThemeGradient(speaker.colorTheme, false)} group-hover:${getThemeGradient(speaker.colorTheme, true)}`}
            style={{ filter: "saturate(0.08)" }} // default is extremely desaturated (grayscale mockup)
          />
          {/* Grayscale hover override on absolute avatar box to fully handle user transition request */}
          <div className="absolute inset-0 flex items-center justify-center transition duration-500 filter grayscale group-hover:grayscale-0">
            {/* The University Initials Background */}
            <span className="font-mono text-8xl font-black opacity-10 uppercase tracking-widest text-white pointer-events-none">
              {speaker.university.split(" ")[0]}
            </span>
          </div>

          {/* Interactive Initials floating display inside avatar area */}
          <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-none border border-white/40 bg-white/10 backdrop-blur-md transition duration-500 filter grayscale group-hover:grayscale-0">
            <span className="font-sans text-2xl font-black tracking-tight text-white">
              {getInitials(lang === "ru" ? speaker.name_ru : speaker.name_en)}
            </span>
          </div>

          {/* Dynamic University Flag overlay */}
          <div className="absolute bottom-3 left-3 rounded-none bg-white px-3 py-1 text-[9px] font-extrabold tracking-widest text-slate-800 border border-slate-200 shadow-xs uppercase font-mono">
            {speaker.university}
          </div>
        </div>

        {/* Text information block */}
        <div className="text-left">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">
            {lang === "ru" ? speaker.major_ru : speaker.major_en}
            {speaker.admissionYear && ` • ${speaker.admissionYear}`}
          </p>
          <h3 className="mt-2 text-base font-extrabold tracking-tight text-slate-900 font-display transition group-hover:text-blue-500" id={`speaker_name_${speaker.id}`}>
            {lang === "ru" ? speaker.name_ru : speaker.name_en}
          </h3>
          <p className="mt-1.5 text-xs text-slate-500 leading-relaxed line-clamp-2">
            {lang === "ru" ? speaker.lectureTopic_ru : speaker.lectureTopic_en}
          </p>

          <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-3">
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-200 rounded-none font-mono">
              <Clock className="h-3 w-3 text-slate-400" />
              <span>{speaker.lectureTime}</span>
            </span>
            <span className="text-xs font-bold text-blue-500 group-hover:underline flex items-center space-x-0.5">
              <span>{lang === "ru" ? "Детали" : "Bio"}</span>
              <span>→</span>
            </span>
          </div>
        </div>
      </div>

      {/* Modern Pop-Up / Modal Detail Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in" id={`speaker_modal_${speaker.id}`}>
          <div 
            className="relative w-full max-w-2xl overflow-hidden rounded-none bg-white shadow-xl border border-slate-200 text-left transition-all animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header with color matching the university brand color */}
            <div className={`p-8 bg-gradient-to-r text-white ${getThemeGradient(speaker.colorTheme, true)} relative`}>
              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-6 right-6 rounded-none bg-black/10 p-2 text-white hover:bg-black/30 hover:scale-102 transition cursor-pointer"
                id="btn_modal_close"
              >
                <X className="h-5 w-5" />
              </button>

              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/80 font-mono">
                {speaker.university} {speaker.admissionYear && `| ${speaker.admissionYear}`}
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight uppercase font-display" id={`modal_speaker_name_${speaker.id}`}>
                {lang === "ru" ? speaker.name_ru : speaker.name_en}
              </h2>
              <p className="mt-1.5 text-xs font-bold tracking-wider uppercase text-white/90">
                🎓 {lang === "ru" ? speaker.major_ru : speaker.major_en}
              </p>
            </div>

            {/* Modal Content */}
            <div className="p-8 space-y-6 max-h-[65vh] overflow-y-auto">
              {/* Lecture Topic Box */}
              <div className="rounded-none p-5 border border-slate-200 bg-slate-50 flex items-start space-x-4">
                <BookOpen className="h-5 w-5 mt-0.5 text-blue-500 flex-shrink-0" />
                <div>
                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-mono">
                    {lang === "ru" ? "Тема выступления" : "Lecture Presentation Topic"}
                  </h4>
                  <p className="mt-1 text-sm sm:text-base font-bold text-slate-900 leading-snug">
                    {lang === "ru" ? speaker.lectureTopic_ru : speaker.lectureTopic_en}
                  </p>
                  <p className="mt-1.5 inline-flex items-center space-x-1.5 text-[10px] font-bold text-slate-500 font-mono">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{speaker.lectureTime}</span>
                  </p>
                </div>
              </div>

              {/* Biography Section */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-mono flex items-center space-x-1.5 border-b border-slate-100 pb-2">
                  <Award className="h-4.5 w-4.5 text-blue-500" />
                  <span>{lang === "ru" ? "История успеха и советы" : "Success Journey & Admissions Hacks"}</span>
                </h4>
                <div className="text-sm text-slate-600 leading-relaxed space-y-3" id="modal_speaker_story">
                  {lang === "ru" ? (
                    <p className="whitespace-pre-line">{speaker.story_ru}</p>
                  ) : (
                    <p className="whitespace-pre-line">{speaker.story_en}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-8 py-5 border-t border-slate-200 flex items-center justify-between">
              <span className="text-3xs font-extrabold text-slate-400 uppercase tracking-[0.2em] font-mono">
                {lang === "ru" ? "Астана • Технопарк" : "Astana • Technopark"}
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-none bg-slate-900 hover:bg-blue-500 text-white font-bold text-2xs uppercase tracking-widest px-6 py-3 transition cursor-pointer duration-150"
                id="btn_modal_confirm"
              >
                {lang === "ru" ? "Понятно" : "Got it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
