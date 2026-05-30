import React, { useState } from "react";
import { Mail, User, Phone, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface NewsletterProps {
  lang: "ru" | "en";
}

export default function Newsletter({ lang }: NewsletterProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setStatus("error");
      setMessage(lang === "ru" ? "Пожалуйста, введите ваше имя." : "Please write down your name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setStatus("error");
      setMessage(lang === "ru" ? "Пожалуйста, введите корректный email." : "Please write a valid email.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setStatus("success");
        setName("");
        setEmail("");
        setPhone("");
      } else {
        setStatus("error");
        setMessage(result.error || (lang === "ru" ? "Ошибка при подписке." : "Error during registration."));
      }
    } catch (e) {
      setStatus("error");
      setMessage(lang === "ru" ? "Не удалось соединиться с сервером." : "Network connection failure.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl border border-slate-200 bg-white p-8 sm:p-12 text-center relative overflow-hidden rounded-none" id="newsletter_container">
      {status === "success" ? (
        // SUCCESS CARD FEEDBACK Layout
        <div className="space-y-6 py-6 animate-scale-up" id="subscribe_success_view">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-none bg-emerald-50 text-emerald-500 border border-emerald-250">
            <CheckCircle className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase font-display">
              {lang === "ru" ? "Поздравляем! Вы зарегистрировались" : "Thank You, Registration Logged"}
            </h3>
            <p className="mt-3 text-sm text-slate-500 max-w-md mx-auto leading-relaxed font-sans">
              {lang === "ru" 
                ? "Данные успешно добавлены в единую базу. Мы отправим вам приоритетные материалы форума и гайд по поступлению на указанную электронную почту!" 
                : "Your details are locked. Expect confirmation notices, Ivy League workbook packets, and schedule updates directly in your mailbox!"}
            </p>
          </div>
          <button
            onClick={() => setStatus("idle")}
            className="bg-slate-900 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-blue-500 transition cursor-pointer rounded-none duration-150"
            id="btn_subscribe_reset"
          >
            {lang === "ru" ? "Зарегистрировать заново" : "Log Another Address"}
          </button>
        </div>
      ) : (
        // RAW INPUT FORM Layout
        <div className="space-y-6" id="subscribe_form_layout">
          <div>
            <span className="border border-slate-200 bg-slate-100/30 px-3.5 py-1.5 text-2xs font-extrabold text-slate-500 tracking-widest uppercase font-mono">
              {lang === "ru" ? "РАССЫЛКА / ГАЙД" : "NEWSLETTER REGISTRATION"}
            </span>
            <h2 className="mt-5 text-2xl font-extrabold text-slate-900 tracking-tight sm:text-3xl uppercase font-display">
              {lang === "ru" ? "Присоединяйтесь к базе форума" : "Unlock Admissions Intelligence"}
            </h2>
            <p className="mt-2.5 text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
              {lang === "ru" 
                ? "Зарегистрируйтесь, чтобы скачать подробный PDF-гайд по написанию эссе от наших спикеров и получать уведомления о трансфере." 
                : "Register early to receive the 2026 Ivy League Essay Prompt Guide compilations compiled by our 17 admitted presenters."}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubscribe} className="mt-8 max-w-2xl mx-auto space-y-4 text-left" id="subscription_form">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name field */}
              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1 font-mono">
                  {lang === "ru" ? "Ваше Имя *" : "Your Name *"}
                </label>
                <div className="relative">
                  <User className="absolute top-3.5 left-4 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={lang === "ru" ? "Асель А." : "Asel A."}
                    className="w-full rounded-none border border-slate-200 bg-white p-3 pl-11 text-xs font-semibold text-slate-800 outline-hidden transition focus:border-blue-500 focus:bg-white"
                    id="input_sub_name"
                  />
                </div>
              </div>

              {/* Phone field */}
              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1 font-mono">
                  {lang === "ru" ? "Телефон (Необязательно)" : "Phone (Optional)"}
                </label>
                <div className="relative">
                  <Phone className="absolute top-3.5 left-4 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 (777) 123-4567"
                    className="w-full rounded-none border border-slate-200 bg-white p-3 pl-11 text-xs font-semibold text-slate-800 outline-hidden transition focus:border-blue-500 focus:bg-white"
                    id="input_sub_phone"
                  />
                </div>
              </div>
            </div>

            {/* Email field */}
            <div className="relative">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1 font-mono">
                {lang === "ru" ? "Электронная почта *" : "Email Address *"}
              </label>
              <div className="relative">
                <Mail className="absolute top-3.5 left-4 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="asel@gmail.com"
                  className="w-full rounded-none border border-slate-200 bg-white p-3 pl-11 text-xs font-semibold text-slate-800 outline-hidden transition focus:border-blue-500 focus:bg-white"
                  id="input_sub_email"
                />
              </div>
            </div>

            {/* Diagnostic warning / error state feedback banner */}
            {status === "error" && (
              <div className="rounded-none border border-red-200 bg-red-50 p-4 flex items-start space-x-3 text-left max-w-2xl mx-auto animate-shake" id="sub_error_banner">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs font-bold text-red-600">{message}</p>
              </div>
            )}

            {/* Submission triggers */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full bg-slate-900 px-6 py-4 text-xs font-bold uppercase tracking-widest text-white transition-all flex items-center justify-center space-x-2 cursor-pointer rounded-none disabled:bg-slate-400 hover:bg-blue-500 duration-150 animate-fade-in animate-duration-150"
                id="btn_submit_newsletter"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>{lang === "ru" ? "ОТПРАВКА..." : "LOGGING DETAILS..."}</span>
                  </>
                ) : (
                  <span>{lang === "ru" ? "ХОЧУ ПОЛУЧИТЬ PDF-ГАЙД И РАССЫЛКУ" : "REGISTER FOR UPDATES & PDF GUIDE"}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
