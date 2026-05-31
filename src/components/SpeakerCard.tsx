import React, { useState } from "react";
import { X, Clock, BookOpen, Award } from "lucide-react";
import { Speaker } from "../types";

interface SpeakerCardProps {
  key?: string;
  speaker: Speaker;
  lang: "ru" | "en" | "kg";
}

export default function SpeakerCard({ speaker, lang }: SpeakerCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Map theme colors to the vibrant solid colors from the screenshot
  const getSolidColor = (theme: string) => {
    switch (theme) {
      case "blue": return "bg-[#3B82F6]";
      case "purple": return "bg-[#1E3A8A]"; // Dark blue
      case "rose": return "bg-[#EF4444]";   // Red
      case "emerald": return "bg-[#10B981]"; // Green
      case "amber": return "bg-[#F97316]";   // Orange
      default: return "bg-[#3B82F6]";
    }
  };

  return (
    <>
      <div
        onClick={() => setIsOpen(true)}
        className={`group relative cursor-pointer overflow-hidden rounded-[24px] aspect-[4/5] shadow-lg transition-transform duration-300 hover:-translate-y-1 ${getSolidColor(speaker.colorTheme)}`}
      >
        {/* Top Left Badge (University Initial) */}
        <div className="absolute top-3 left-4 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md z-10">
          <span className="text-[#2563EB] font-black text-sm">
            {speaker.university[0]}
          </span>
        </div>

        {/* Creative "Hand-drawn" Background Squiggles */}
        <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden flex items-center justify-center">
          {speaker.id.charCodeAt(speaker.id.length - 1) % 3 === 0 ? (
            <svg viewBox="0 0 200 200" className="w-[150%] h-[150%] -rotate-12" xmlns="http://www.w3.org/2000/svg">
              <path d="M 0,160 C 50,0 100,0 120,100 C 140,200 180,200 220,40" stroke="white" strokeWidth="12" fill="none" strokeLinecap="round" />
            </svg>
          ) : speaker.id.charCodeAt(speaker.id.length - 1) % 3 === 1 ? (
            <svg viewBox="0 0 200 200" className="w-[140%] h-[140%] rotate-12" xmlns="http://www.w3.org/2000/svg">
              <path d="M -20,100 Q 50,-20 100,100 T 220,100" stroke="white" strokeWidth="14" fill="none" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 200 200" className="w-[160%] h-[160%] rotate-45" xmlns="http://www.w3.org/2000/svg">
               <path d="M 20,220 C 100,220 60,-20 100,-20 C 140,-20 100,220 180,220" stroke="white" strokeWidth="10" fill="none" strokeLinecap="round" />
            </svg>
          )}
        </div>

        {/* Yellow Bottom Pill Badge */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] bg-[#FFEA00] rounded-2xl py-2 px-3 text-center shadow-md z-10 transform transition-transform duration-300 group-hover:-translate-y-1">
          <h3 className="text-[11px] font-black tracking-tight text-black leading-tight uppercase">
            {lang === "ru" ? speaker.name_ru : lang === "kg" ? (speaker.name_kg || speaker.name_ru) : speaker.name_en}
          </h3>
          <p className="text-[9px] font-bold text-black/80 mt-0.5 leading-tight">
            {lang === "ru" ? speaker.major_ru : lang === "kg" ? (speaker.major_kg || speaker.major_ru) : speaker.major_en}
          </p>
        </div>
      </div>

      {/* Pop-Up Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsOpen(false)}>
          <div 
            className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl text-left flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`p-8 ${getSolidColor(speaker.colorTheme)} text-white flex justify-between items-start`}>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-white/80 mb-2">
                  {speaker.university} {speaker.admissionYear && `| ${speaker.admissionYear}`}
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-2">
                  {lang === "ru" ? speaker.name_ru : lang === "kg" ? (speaker.name_kg || speaker.name_ru) : speaker.name_en}
                </h2>
                <p className="text-sm font-medium text-white/90">
                  {lang === "ru" ? speaker.major_ru : lang === "kg" ? (speaker.major_kg || speaker.major_ru) : speaker.major_en}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-8 space-y-8 overflow-y-auto bg-white">
              <div className="rounded-2xl p-6 border border-slate-200 bg-slate-50 flex items-start space-x-4">
                <div className="bg-white p-3 rounded-full text-[#2563EB] shadow-sm">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">
                    {lang === "ru" ? "Тема выступления" : lang === "kg" ? "Сөз сүйлөө темасы" : "Lecture Topic"}
                  </h4>
                  <p className="text-lg font-bold text-slate-900 leading-snug">
                    {lang === "ru" ? speaker.lectureTopic_ru : lang === "kg" ? (speaker.lectureTopic_kg || speaker.lectureTopic_ru) : speaker.lectureTopic_en}
                  </p>
                  <p className="mt-2 inline-flex items-center space-x-1.5 text-xs font-medium text-slate-500">
                    <Clock className="h-4 w-4" />
                    <span>{speaker.lectureTime}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-2">
                  <Award className="h-5 w-5 text-[#2563EB]" />
                  <span>{lang === "ru" ? "История успеха" : lang === "kg" ? "Ийгилик тарыхы" : "Success Journey"}</span>
                </h4>
                <div className="text-sm text-slate-600 leading-relaxed space-y-4 font-medium">
                  {lang === "ru" ? (
                    <p className="whitespace-pre-line">{speaker.story_ru}</p>
                  ) : lang === "kg" ? (
                    <p className="whitespace-pre-line">{speaker.story_kg || speaker.story_ru}</p>
                  ) : (
                    <p className="whitespace-pre-line">{speaker.story_en}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
