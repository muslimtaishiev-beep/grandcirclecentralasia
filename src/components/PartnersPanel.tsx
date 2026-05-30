import React from "react";
import { Award, Briefcase, Network, Landmark } from "lucide-react";
import { Partner } from "../types";

interface PartnersPanelProps {
  partners: Partner[];
  lang: "ru" | "en";
}

export default function PartnersPanel({ partners, lang }: PartnersPanelProps) {
  // Sort partners by tier
  const general = partners.filter((p) => p.tier === "general");
  const sponsors = partners.filter((p) => p.tier === "sponsor");
  const regular = partners.filter((p) => p.tier === "partner" || !p.tier);

  return (
    <div className="mx-auto max-w-6xl text-center" id="partners_panel_container">
      {/* Little Tag */}
      <span className="border border-slate-200 bg-slate-100/30 px-3.5 py-1.5 text-2xs font-extrabold text-slate-500 tracking-widest uppercase font-mono">
        {lang === "ru" ? "ЭКОСИСТЕМА" : "ECOSYSTEM PARTNERS"}
      </span>
      <h2 className="mt-5 text-2xl font-extrabold text-slate-900 tracking-tight sm:text-3xl uppercase font-display" id="partners_sec_title">
        {lang === "ru" ? "При поддержке ведущих брендов" : "Supported by Trusted Leagues"}
      </h2>

      {/* Tiers distribution */}
      <div className="mt-12 space-y-12">
        {/* Tier 1: General Partner (Astana Technopark) */}
        {general.length > 0 && (
          <div className="space-y-4" id="tier_general">
            <h3 className="text-3xs font-extrabold text-blue-500 uppercase tracking-widest font-mono">
              ⚡ {lang === "ru" ? "Генеральный партнер и Место проведения" : "General Host Partner"} ⚡
            </h3>
            <div className="flex justify-center flex-wrap gap-6">
              {general.map((p) => (
                <div
                  key={p.id}
                  className="inline-flex flex-col items-center justify-center border border-slate-200 bg-white px-8 py-6 shadow-xs min-w-[240px] rounded-none transition-all hover:border-slate-400"
                  id={`partner_${p.id}`}
                >
                  <Landmark className="h-6 w-6 text-blue-500 mb-2.5" />
                  <span className="text-base font-extrabold text-slate-900 tracking-tight font-display">{p.name}</span>
                  <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider mt-1.5 font-mono">
                    {lang === "ru" ? p.role_ru : p.role_en}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tier 2: Academic Sponsors / Leaders */}
        {sponsors.length > 0 && (
          <div className="space-y-4" id="tier_sponsors">
            <h3 className="text-3xs font-extrabold text-slate-400 uppercase tracking-widest font-mono">
              ✦ {lang === "ru" ? "Академические спонсоры" : "Academic Language Sponsors"} ✦
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
              {sponsors.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center space-x-4 border border-slate-200 bg-white p-5 text-left rounded-none transition hover:border-slate-400"
                  id={`partner_${p.id}`}
                >
                  <div className="rounded-none bg-slate-50 border border-slate-200 p-2.5 text-blue-500">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-sm sm:text-base font-extrabold text-slate-900 tracking-tight font-display">{p.name}</span>
                    <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                      {lang === "ru" ? p.role_ru : p.role_en}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tier 3: Communication Partners / Media */}
        {regular.length > 0 && (
          <div className="space-y-4" id="tier_regular">
            <h3 className="text-3xs font-extrabold text-slate-400 uppercase tracking-widest font-mono">
              {lang === "ru" ? "Комьюнити и информационные партнеры" : "Information Outreach & Support"}
            </h3>
            <div className="flex justify-center flex-wrap gap-4 max-w-4xl mx-auto">
              {regular.map((p) => (
                <div
                  key={p.id}
                  className="border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition hover:border-slate-300 rounded-none"
                  id={`partner_${p.id}`}
                >
                  <span className="font-mono text-3xs font-bold text-slate-300 mr-1.5">#</span>
                  <span>{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
