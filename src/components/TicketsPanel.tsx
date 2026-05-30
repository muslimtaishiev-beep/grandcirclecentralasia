import React from "react";
import { Check, ArrowRight, HelpCircle, Sparkles } from "lucide-react";
import { Ticket } from "../types";

interface TicketsPanelProps {
  tickets: Ticket[];
  lang: "ru" | "en";
}

export default function TicketsPanel({ tickets, lang }: TicketsPanelProps) {
  // Concat website links with UTM tagging parameters
  const buildUtmLink = (ticket: Ticket) => {
    try {
      const urlObj = new URL(ticket.url);
      if (ticket.utm_source) urlObj.searchParams.set("utm_source", ticket.utm_source);
      if (ticket.utm_medium) urlObj.searchParams.set("utm_medium", ticket.utm_medium);
      if (ticket.utm_campaign) urlObj.searchParams.set("utm_campaign", ticket.utm_campaign);
      return urlObj.toString();
    } catch (e) {
      // Fallback if URL is not absolute
      const separator = ticket.url.includes("?") ? "&" : "?";
      let fullUrl = ticket.url;
      if (ticket.utm_source) fullUrl += `${separator}utm_source=${encodeURIComponent(ticket.utm_source)}`;
      if (ticket.utm_medium) fullUrl += `&utm_medium=${encodeURIComponent(ticket.utm_medium)}`;
      if (ticket.utm_campaign) fullUrl += `&utm_campaign=${encodeURIComponent(ticket.utm_campaign)}`;
      return fullUrl;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" id="tickets_panel_container">
      {/* Intro Heading Section */}
      <div className="text-center mb-12">
        <span className="border border-slate-200 bg-slate-100/30 px-3.5 py-1.5 text-2xs font-extrabold text-slate-500 tracking-widest uppercase font-mono">
          {lang === "ru" ? "РЕГИСТРАЦИЯ" : "SECURE PASSES"}
        </span>
        <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl uppercase font-display" id="tickets_sec_title">
          {lang === "ru" ? "ТАРИФЫ УЧАСТИЯ" : "Seating and Admission Formats"}
        </h2>
        <p className="mt-3 text-sm text-slate-500 max-w-2xl mx-auto leading-relaxed">
          {lang === "ru" 
            ? "Доступны три категории билетов. Выберите подходящий уровень погружения и забронируйте место, пока билеты по текущей цене есть в наличии." 
            : "Choose the level of feedback that fits your admissions goals. Prices will increase as our event capacity approaches maximum limits."}
        </p>
      </div>

      {/* Pricing cards grid container */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch pt-4" id="tickets_grid">
        {tickets.map((ticket) => {
          // Check if it's the premium 'Business' pass to highlight it
          const isBusiness = ticket.id === "t2";
          const isVip = ticket.id === "t3";
          
          return (
            <div
              key={ticket.id}
              className={`relative flex flex-col justify-between p-8 transition-all duration-300 rounded-none ${
                isBusiness 
                  ? "border-2 border-blue-500 bg-white scale-100 z-10 md:-translate-y-1" 
                  : "border border-slate-200 bg-white hover:border-slate-300"
              }`}
              id={`ticket_card_${ticket.id}`}
            >
              {/* Highlight Ribbon for Business pass */}
              {isBusiness && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center space-x-1 border border-blue-500 bg-blue-500 px-4 py-1 text-[10px] font-bold tracking-widest text-white uppercase font-mono rounded-none">
                  <span>{lang === "ru" ? "РЕКОМЕНДУЕМ" : "RECOMMENDED"}</span>
                </span>
              )}

              {/* Box Top */}
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-900 font-display">
                  {lang === "ru" ? ticket.name_ru : ticket.name_en}
                </h3>
                
                {/* Price block */}
                <div className="mt-4 flex items-baseline">
                  <span className="text-3xl font-black font-mono tracking-tight text-slate-900">
                    {ticket.price}
                  </span>
                  <span className="ml-1.5 text-2xs font-extrabold uppercase tracking-widest text-slate-400 font-mono">
                    / {lang === "ru" ? "пропуск" : "seat"}
                  </span>
                </div>

                {/* Benefits Bullet Checklist */}
                <ul className="mt-8 space-y-4 border-t border-slate-200 pt-6">
                  {(lang === "ru" ? ticket.features_ru : ticket.features_en).map((feature, fIdx) => (
                    <li key={fIdx} className="flex items-start space-x-3 text-left">
                      <div className={`mt-1.5 rounded-none p-0.5 flex-shrink-0 ${isBusiness ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-700 border border-slate-200"}`}>
                        <Check className="h-3 w-3" />
                      </div>
                      <span className="text-xs text-slate-600 font-medium leading-relaxed">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Outbound Booking CTA with custom UTM parameters concatenated string */}
              <div className="mt-8 pt-4">
                <a
                  href={buildUtmLink(ticket)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex w-full items-center justify-center space-x-2 px-5 py-4 text-xs font-bold uppercase tracking-widest transition-all duration-150 rounded-none cursor-pointer ${
                    isBusiness
                      ? "bg-blue-500 hover:bg-slate-900 text-white"
                      : isVip
                      ? "bg-slate-900 hover:bg-blue-500 text-white"
                      : "bg-white border border-slate-200 hover:bg-slate-55 flex hover:border-slate-350 text-slate-900"
                  }`}
                  id={`cta_booking_link_${ticket.id}`}
                >
                  <span>{lang === "ru" ? "Купить билет" : "Purchase Ticket"}</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
                
                {/* Additional tracking parameters tiny diagnostic feedback link for user transparency */}
                <p className="mt-3.5 text-center text-3xs font-bold font-mono text-slate-400 tracking-widest uppercase">
                  ⭐ {lang === "ru" ? "включает UTM " : "UTM attributes attached"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Helpful Guarantee Tag line */}
      <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 text-center text-xs text-slate-400">
        <span className="flex items-center space-x-1.5 justify-center">
          <HelpCircle className="h-3.5 w-3.5 text-slate-300" />
          <span>{lang === "ru" ? "Возникли вопросы по оплате?" : "Trouble ordering online?"}</span>
        </span>
        <span className="hidden sm:inline font-bold text-slate-200">|</span>
        <span>
          {lang === "ru" 
            ? "Свяжитесь с организаторами: info@mainedu.kz или +7 (7172) 55-44-33" 
            : "Direct support contact: info@mainedu.kz or +7 (7172) 55-44-33"}
        </span>
      </div>
    </div>
  );
}
