import React from "react";
import { Partner } from "../types";

interface PartnersPanelProps {
  partners: Partner[];
  lang: "ru" | "en" | "kg";
}

export default function PartnersPanel({ partners, lang }: PartnersPanelProps) {
  // If there are no partners, we can render some empty placeholders for demonstration
  // In a real scenario, this would just be empty until data is added
  const displayPartners = partners.length > 0 ? partners : [
    { id: "p1", name: "Partner Logo" },
    { id: "p2", name: "Partner Logo" },
    { id: "p3", name: "Partner Logo" },
    { id: "p4", name: "Partner Logo" },
  ] as Partner[];

  return (
    <div className="mx-auto max-w-6xl text-center px-4 sm:px-6">
      <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-12">
        {lang === "ru" ? "Партнеры" : lang === "kg" ? "Өнөктөштөр" : "Partners"}
      </h2>

      <div className="flex justify-center flex-wrap gap-6 max-w-4xl mx-auto">
        {displayPartners.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-center border border-slate-200 bg-white px-8 py-6 shadow-sm rounded-2xl w-48 h-28 grayscale hover:grayscale-0 transition-all duration-300 group"
          >
            {p.logo ? (
              <img src={p.logo} alt={p.name} className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-lg font-bold text-slate-300 tracking-tight group-hover:text-slate-500 transition-colors">
                {p.name}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
