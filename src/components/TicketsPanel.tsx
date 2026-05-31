import React from "react";
import { Check, ArrowRight, HelpCircle } from "lucide-react";
import { Ticket } from "../types";

interface TicketsPanelProps {
  tickets: Ticket[];
  lang: "ru" | "en" | "kg";
}

export default function TicketsPanel({ tickets, lang }: TicketsPanelProps) {
  const buildUtmLink = (ticket: Ticket) => {
    return ticket.url; // Simplified for brevity in demo
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      
      <div className="text-center mb-16">
        <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">
          {lang === "ru" ? "Тарифы участия" : lang === "kg" ? "Катышуу тарифтери" : "Admission Tickets"}
        </h2>
        <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto font-medium">
          {lang === "ru" 
            ? "Выберите подходящий формат погружения и забронируйте место." 
            : lang === "kg" 
            ? "Өзүңүзгө ылайыктуу форматты тандап, орун ээлеп коюңуз."
            : "Choose the format that fits your goals and secure your spot."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch pt-4">
        {tickets.map((ticket) => {
          const isBusiness = ticket.id === "t2";
          
          return (
            <div
              key={ticket.id}
              className={`relative flex flex-col justify-between p-10 transition-all duration-300 rounded-[24px] ${
                isBusiness 
                  ? "bg-[#2563EB] text-white shadow-2xl scale-100 z-10 lg:-translate-y-4 border-none" 
                  : "bg-white border border-slate-100 shadow-xl hover:shadow-2xl text-slate-900"
              }`}
            >
              {isBusiness && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center bg-slate-900 text-white px-4 py-1.5 text-xs font-bold uppercase tracking-wide rounded-full shadow-md">
                    {lang === "ru" ? "Популярный выбор" : lang === "kg" ? "Көп тандалган" : "Most Popular"}
                  </span>
                </div>
              )}

              <div>
                <h3 className={`text-xl font-bold uppercase tracking-wide ${isBusiness ? "text-white" : "text-[#2563EB]"}`}>
                  {lang === "ru" ? ticket.name_ru : lang === "kg" ? (ticket.name_kg || ticket.name_ru) : ticket.name_en}
                </h3>
                
                <div className="mt-4 flex items-baseline border-b pb-8" style={{ borderColor: isBusiness ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.05)" }}>
                  <span className="text-4xl font-bold tracking-tight">
                    {ticket.price}
                  </span>
                </div>

                <ul className="mt-8 space-y-5">
                  {(lang === "ru" ? ticket.features_ru : lang === "kg" ? (ticket.features_kg || ticket.features_ru) : ticket.features_en).map((feature, fIdx) => (
                    <li key={fIdx} className="flex items-start space-x-4 text-left">
                      <div className={`mt-0.5 rounded-full p-1 flex-shrink-0 ${isBusiness ? "bg-white/20 text-white" : "bg-sky-50 text-[#2563EB]"}`}>
                        <Check className="h-3 w-3" />
                      </div>
                      <span className={`text-sm font-medium leading-relaxed ${isBusiness ? "text-white/90" : "text-slate-600"}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-10 pt-4">
                <a
                  href={buildUtmLink(ticket)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex w-full items-center justify-center space-x-2 px-6 py-4 text-sm font-bold uppercase tracking-wide transition-all duration-300 rounded-full shadow-sm ${
                    isBusiness
                      ? "bg-white text-[#2563EB] hover:bg-slate-50"
                      : "bg-slate-50 text-slate-900 hover:bg-[#2563EB] hover:text-white"
                  }`}
                >
                  <span>{lang === "ru" ? "Купить билет" : lang === "kg" ? "Билет сатып алуу" : "Purchase Ticket"}</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-4 text-center text-sm text-slate-500 font-medium">
        <span className="flex items-center space-x-2">
          <HelpCircle className="h-4 w-4 text-slate-400" />
          <span>{lang === "ru" ? "Возникли вопросы по оплате?" : lang === "kg" ? "Төлөм боюнча суроолоруңуз барбы?" : "Trouble ordering?"}</span>
        </span>
        <span className="hidden sm:inline font-bold text-slate-300">|</span>
        <span>
          {lang === "ru" 
            ? "Свяжитесь с организаторами: +995 222 140 709" 
            : lang === "kg"
            ? "Уюштуруучулар менен байланышыңыз: +995 222 140 709"
            : "Contact: +995 222 140 709"}
        </span>
      </div>
    </div>
  );
}
