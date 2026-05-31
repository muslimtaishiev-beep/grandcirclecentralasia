import React, { useState } from "react";
import { Mail, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface NewsletterProps {
  lang: "ru" | "en" | "kg";
}

export default function Newsletter({ lang }: NewsletterProps) {
  const [email, setEmail] = useState("");
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
    setStatus("success");
  };

  return (
    <div className="mx-auto max-w-4xl bg-slate-900 text-white p-10 sm:p-16 text-center rounded-[32px] shadow-2xl relative overflow-hidden">
      
      {status === "success" ? (
        <div className="space-y-6 py-10 relative z-10 animate-fade-in">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <CheckCircle className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-3xl font-bold tracking-tight">
              {lang === "ru" ? "Успешно" : lang === "kg" ? "Ийгиликтүү" : "Success"}
            </h3>
            <p className="mt-4 text-base text-slate-300 max-w-md mx-auto leading-relaxed">
              {lang === "ru" 
                ? "Мы отправим материалы на указанную электронную почту." 
                : lang === "kg"
                ? "Биз материалдарды көрсөтүлгөн электрондук почтага жөнөтөбүз."
                : "We will send the materials to the provided email address."}
            </p>
          </div>
          <button
            onClick={() => setStatus("idle")}
            className="mt-6 bg-white px-8 py-3 text-xs font-bold uppercase tracking-wide text-slate-900 hover:bg-slate-200 transition rounded-full"
          >
            {lang === "ru" ? "Вернуться" : lang === "kg" ? "Артка" : "Go Back"}
          </button>
        </div>
      ) : (
        <div className="space-y-8 relative z-10">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {lang === "ru" ? "Получите полезные материалы" : lang === "kg" ? "Пайдалуу материалдарды алыңыз" : "Get Useful Materials"}
            </h2>
            <p className="mt-4 text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
              {lang === "ru" 
                ? "Оставьте почту, чтобы получить подборку эссе студентов." 
                : lang === "kg"
                ? "Студенттердин эсселер жыйнагын алуу үчүн почтаңызды калтырыңыз."
                : "Leave your email to receive a collection of successful student essays."}
            </p>
          </div>

          <form onSubmit={handleSubscribe} className="mt-10 max-w-xl mx-auto flex flex-col sm:flex-row gap-4 text-left">
            <div className="relative flex-1">
              <Mail className="absolute top-1/2 -translate-y-1/2 left-5 h-5 w-5 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@gmail.com"
                className="w-full rounded-full border border-slate-700 bg-slate-800 p-4 pl-14 text-sm text-white focus:outline-none focus:border-sky-500 transition"
              />
            </div>
            
            <button
              type="submit"
              disabled={status === "loading"}
              className="bg-[#2563EB] px-8 py-4 text-xs font-bold uppercase tracking-wide text-white transition-all rounded-full hover:bg-blue-600 disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {status === "loading" ? (
                <Loader2 className="h-5 w-5 animate-spin text-white mx-auto" />
              ) : (
                <span>{lang === "ru" ? "Отправить" : lang === "kg" ? "Жөнөтүү" : "Submit"}</span>
              )}
            </button>
          </form>

          {status === "error" && (
            <div className="mt-4 flex items-center justify-center space-x-2 text-red-400 animate-shake text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
