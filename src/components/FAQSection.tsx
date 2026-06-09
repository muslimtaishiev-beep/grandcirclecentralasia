import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";

interface FAQItem {
  q_ru: string;
  a_ru: string;
  q_en: string;
  a_en: string;
}

const FAQS: FAQItem[] = [
  {
    q_ru: "Будет ли организовано питание и кофе-брейк?",
    a_ru: "На мероприятии будут установлены стенды с компаниями, где можно приобрести их продукцию. Для обладателей билета категории VIP предусмотрен небольшой кофе-брейк на мероприятии, а также эксклюзивный закрытый ужин со спикерами в ресторане после окончания форума.",
    q_en: "Will there be food and coffee breaks?",
    a_en: "There will be stands from companies where you can purchase their products. VIP ticket holders will also have a small coffee break at the event, and an exclusive private dinner with the speakers at a restaurant after the forum."
  },
  {
    q_ru: "Как получить именной сертификат?",
    a_ru: "Для получения именного электронного сертификата об участии, пожалуйста, заполните форму рассылки на сайте, указав ваше имя, номер билета и почту. Мы отправим сертификат вам на почту.",
    q_en: "How do I get a personalized certificate?",
    a_en: "To receive a personalized electronic certificate of participation, please fill out the newsletter form on the site with your name, ticket number, and email. We will send the certificate to your email."
  }
];

interface FAQSectionProps {
  lang: "ru" | "en" | "kg";
}

export default function FAQSection({ lang }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-20 bg-slate-50 relative">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">
            {lang === "ru" ? "Частые вопросы" : lang === "kg" ? "Көп берилүүчү суроолор" : "FAQ"}
          </h2>
          <p className="mt-4 text-lg text-slate-600 font-medium">
            {lang === "ru" 
              ? "Все, что вам нужно знать перед тем, как посетить форум." 
              : lang === "kg" 
              ? "Форумга катышардан мурун эмнелерди билишиңиз керек." 
              : "Everything you need to know before attending the forum."}
          </p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div 
                key={idx} 
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="w-full flex items-center justify-between p-6 text-left cursor-pointer focus:outline-none"
                >
                  <span className="text-lg font-bold text-slate-800">
                    {lang === "ru" ? faq.q_ru : lang === "kg" ? faq.q_ru : faq.q_en}
                  </span>
                  <div className={cn("ml-4 flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 text-slate-500 transition-transform duration-300", isOpen && "rotate-180 bg-[#9F7AEA]/10 text-[#9F7AEA]")}>
                    <ChevronDown className="h-5 w-5" />
                  </div>
                </button>
                <div 
                  className={cn(
                    "px-6 overflow-hidden transition-all duration-300 ease-in-out",
                    isOpen ? "max-h-96 pb-6 opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <p className="text-slate-600 leading-relaxed font-medium">
                    {lang === "ru" ? faq.a_ru : lang === "kg" ? faq.a_ru : faq.a_en}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
