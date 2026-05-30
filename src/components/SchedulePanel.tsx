import React, { useState } from "react";
import { Clock, MessageSquare, ChevronDown, ChevronUp, User, Globe } from "lucide-react";
import { ProgramSlot, Speaker } from "../types";

interface SchedulePanelProps {
  program: ProgramSlot[];
  speakers: Speaker[];
  lang: "ru" | "en";
}

export default function SchedulePanel({ program, speakers, lang }: SchedulePanelProps) {
  const [expandedSlots, setExpandedSlots] = useState<Record<string, boolean>>({
    "s1": true, // Pre-expand first slot
    "s3": true, // Pre-expand key session
  });

  const toggleSlot = (id: string) => {
    setExpandedSlots(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Find associated speaker for a slot
  const findSpeaker = (speakerId: string): Speaker | undefined => {
    if (!speakerId) return undefined;
    return speakers.find(s => s.id === speakerId);
  };

  const scrollToSpeaker = (speakerId: string) => {
    const el = document.getElementById(`speaker_card_${speakerId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Add a brief flashing highlight
      el.classList.add("ring-4", "ring-sky-400", "ring-offset-2");
      setTimeout(() => {
        el.classList.remove("ring-4", "ring-sky-400", "ring-offset-2");
      }, 2000);
    }
  };

  return (
    <div className="mx-auto max-w-4xl" id="schedule_panel_container">
      {/* Intro text */}
      <div className="text-center mb-10">
        <span className="border border-slate-200 bg-slate-100/30 px-3.5 py-1.5 text-2xs font-extrabold text-slate-500 tracking-widest uppercase font-mono">
          {lang === "ru" ? "ПРОГРАММА ДНЯ" : "AGENDA TIMELINE"}
        </span>
        <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl uppercase font-display" id="schedule_sec_title">
          {lang === "ru" ? "Интерактивная Программа" : "Interactive Program Schedule"}
        </h2>
        <p className="mt-3 text-sm text-slate-500 leading-relaxed max-w-2xl mx-auto">
          {lang === "ru" 
            ? "Весь день наполнен практическими разборами, живым нетворкингом и полезными сессиями." 
            : "A packed timeline of profile audits, writing workshops, and direct networking with Ivy League students."}
        </p>
      </div>

      {/* Timeline Tree */}
      <div className="relative border-l border-slate-200 pl-4 sm:pl-8 ml-2 sm:ml-6 space-y-6" id="schedule_timeline_tree">
        {/* Sort program by schedule slots structure or return raw mapped items */}
        {program.map((slot, index) => {
          const isExpanded = !!expandedSlots[slot.id];
          const speaker = findSpeaker(slot.speakerId);

          return (
            <div 
              key={slot.id} 
              className="relative group transition-all"
              id={`timeline_node_${slot.id}`}
            >
              {/* Vertical line connector badge node */}
              <div 
                className={`absolute -left-[20px] sm:-left-[36px] top-6 flex h-[10px] w-[9px] items-center justify-center border transition duration-200 ${
                  isExpanded 
                    ? "border-blue-500 bg-blue-500 text-white shadow-xs" 
                    : "border-slate-300 bg-white group-hover:border-slate-400"
                }`}
                style={{ zIndex: 5 }}
              />

              {/* Main row card */}
              <div className={`border transition-all duration-300 p-5 rounded-none ${
                isExpanded 
                  ? "border-slate-300 bg-white" 
                  : "border-slate-200 bg-white hover:border-slate-350"
              }`}>
                {/* Clicking toggles the detail content */}
                <div 
                  onClick={() => toggleSlot(slot.id)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                  id={`slot_trigger_${slot.id}`}
                >
                  {/* Left Side: Time and Title */}
                  <div className="flex items-start sm:items-center space-x-3 text-left">
                    <span className="flex items-center space-x-1 font-mono text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-600 rounded-none px-2.5 py-1 flex-shrink-0">
                      <Clock className="h-3 w-3 text-slate-450" />
                      <span>{slot.time}</span>
                    </span>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight uppercase font-display group-hover:text-blue-500">
                      {lang === "ru" ? slot.title_ru : slot.title_en}
                    </h3>
                  </div>

                  {/* Right Side: Indicators / Expand details toggle indicator */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0">
                    {/* Speaker indicator tag */}
                    {speaker && (
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          scrollToSpeaker(speaker.id);
                        }}
                        className="inline-flex items-center space-x-1 border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-bold text-slate-500 hover:border-slate-300 hover:text-blue-500 transition rounded-none font-mono"
                        title={lang === "ru" ? "Посмотреть автора" : "View Speaker Link"}
                      >
                        <User className="h-3 w-3 text-slate-400" />
                        <span>{lang === "ru" ? speaker.name_ru.split(" ")[0] : speaker.name_en.split(" ")[0]}</span>
                      </span>
                    )}

                    <div className="text-slate-400 transition hover:text-slate-600">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="mt-4 border-t border-slate-200 pt-4 text-left animate-slide-down">
                    <p className="text-sm text-slate-600 leading-relaxed font-sans">
                      {lang === "ru" ? slot.description_ru : slot.description_en}
                    </p>

                    {/* Micro card of speaker inside the timeline description block */}
                    {speaker && (
                      <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between border border-slate-200 bg-slate-50/50 p-4 gap-3 rounded-none">
                        <div className="flex items-center space-x-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-none bg-white border border-slate-200">
                            <span className="font-mono text-2xs font-extrabold text-slate-550 uppercase">
                              {speaker.university.split(" ")[0]}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-800">
                              {lang === "ru" ? speaker.name_ru : speaker.name_en}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest mt-0.5">
                              {speaker.university} | {lang === "ru" ? speaker.major_ru : speaker.major_en}
                            </p>
                          </div>
                        </div>

                        <button 
                          onClick={() => scrollToSpeaker(speaker.id)}
                          className="w-full sm:w-auto bg-slate-900 px-4 py-2 text-2xs font-bold uppercase tracking-widest text-white hover:bg-blue-500 transition cursor-pointer text-center rounded-none duration-150"
                        >
                          {lang === "ru" ? "Профиль Спикера" : "View Story Bio"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
