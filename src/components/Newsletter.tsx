import React, { useState } from "react";
import { Mail, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface NewsletterProps {
  lang: "ru" | "en" | "kg";
}

export default function Newsletter({ lang }: NewsletterProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [ticket, setTicket] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setStatus("error");
      setMessage(
        lang === "ru" 
          ? "Введите корректный email." 
          : lang === "kg" 
          ? "Жарактуу электрондук почта дарегин киргизиңиз." 
          : "Please enter a valid email."
      );
      return;
    }
    setStatus("loading");
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "";
      const response = await fetch(`${apiUrl}/api/public/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), ticket: ticket.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to subscribe");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setMessage(
        lang === "ru" 
          ? "Произошла ошибка при отправке. Попробуйте позже." 
          : lang === "kg" 
          ? "Ката кетти. Кийинчерээк кайра аракет кылыңыз." 
          : "An error occurred. Please try again later."
      );
    }
  };

  return (
    <div className="mx-auto max-w-4xl bg-white p-10 sm:p-16 text-center rounded-[32px] shadow-lg relative overflow-hidden">
      
      {status === "success" ? (
        <div className="space-y-6 py-10 relative z-10 animate-fade-in">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <CheckCircle className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-3xl font-bold tracking-tight text-slate-900">
              {lang === "ru" ? "Успешно" : lang === "kg" ? "Ийгиликтүү" : "Success"}
            </h3>
            <p className="mt-4 text-base text-slate-600 max-w-md mx-auto leading-relaxed">
              {lang === "ru" 
                ? "Мы отправим ваш именной сертификат на указанную электронную почту." 
                : lang === "kg"
                ? "Биз сертификатты көрсөтүлгөн электрондук почтага жөнөтөбүз."
                : "We will send your personalized certificate to the provided email address."}
            </p>
          </div>
          <button
            onClick={() => setStatus("idle")}
            className="mt-6 bg-blue-600 px-8 py-3 text-xs font-bold uppercase tracking-wide text-white hover:bg-blue-700 transition rounded-full"
          >
            {lang === "ru" ? "Вернуться" : lang === "kg" ? "Артка" : "Go Back"}
          </button>
        </div>
      ) : (
        <div className="space-y-8 relative z-10">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              {lang === "ru" ? "Получите именной сертификат" : lang === "kg" ? "Сертификатыңызды алыңыз" : "Get Your Certificate"}
            </h2>
            <p className="mt-4 text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
              {lang === "ru" 
                ? "Оставьте данные вашего билета и почту, чтобы получить именной электронный сертификат участника форума." 
                : lang === "kg"
                ? "Катышуучунун сертификатын алуу үчүн билетиңиздин маалыматын жана почтаңызды калтырыңыз."
                : "Leave your ticket details and email to receive your personalized participant certificate."}
            </p>
          </div>

          <form onSubmit={handleSubscribe} className="mt-10 max-w-2xl mx-auto flex flex-col gap-4 text-left">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={lang === "ru" ? "Ваше Имя и Фамилия" : "Full Name"}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-sm font-medium text-slate-800 outline-hidden transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={ticket}
                  onChange={(e) => setTicket(e.target.value)}
                  placeholder={lang === "ru" ? "Номер Билета" : "Ticket Number"}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-sm font-medium text-slate-800 outline-hidden transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
            </div>
            
            <div className="relative flex w-full">
              <Mail className="absolute top-1/2 -translate-y-1/2 left-5 h-5 w-5 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  lang === "ru" 
                    ? "Ваш email адрес" 
                    : lang === "kg" 
                    ? "Электрондук почтаңыз" 
                    : "Your email address"
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-4 pl-14 pr-32 text-sm font-medium text-slate-800 outline-hidden transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="absolute right-2 top-2 bottom-2 rounded-xl bg-blue-600 px-6 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
              >
                {status === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : lang === "ru" ? (
                  "Получить"
                ) : lang === "kg" ? (
                  "Жазылуу"
                ) : (
                  "Get"
                )}
              </button>
            </div>
          </form>

          {status === "error" && (
            <div className="mt-4 flex items-center justify-center space-x-2 text-red-500 animate-shake text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
