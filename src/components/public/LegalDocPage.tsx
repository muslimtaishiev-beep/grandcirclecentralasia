import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LEGAL_VERSION, PLATFORM_OPERATOR, privacyHref, termsHref, type Block, type OrgLegal } from "../../shared/legalDocs";
import PublicBrand from "./PublicBrand";

/**
 * Страница юридического документа. С ?org=<id> подставляет название и
 * реквизиты организации, со страницы которой пришёл человек.
 */
export default function LegalDocPage({ title, build, kind }: { title: string; build: (org?: OrgLegal | null) => Block[]; kind: "privacy" | "terms" }) {
  const [params] = useSearchParams();
  const orgId = params.get("org");
  const [org, setOrg] = useState<(OrgLegal & { logoUrl?: string | null }) | null>(null);
  useEffect(() => {
    if (!orgId) return;
    fetch(`/api/tenant/public?id=${encodeURIComponent(orgId)}`).then(r => r.json()).then(j => {
      if (!j.success) return;
      const t = j.tenant; const l = t.legal || {};
      setOrg({ name: t.name, legalName: l.legalName, address: l.address, phone: l.phone, inn: l.inn, email: t.workspaceConfig?.email?.replyTo || "", logoUrl: t.branding?.logoUrl || null });
    }).catch(() => {});
  }, [orgId]);
  const blocks = build(org);
  const date = LEGAL_VERSION.split("-").reverse().join(".");
  const op = PLATFORM_OPERATOR;
  const row = (l: string, v?: string) => (v ? <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">{l}</dt><dd className="text-slate-800">{v}</dd></div> : null);

  return (
    <div className="min-h-dvh bg-slate-50 py-8 sm:py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {org && <PublicBrand name={org.name} logoUrl={org.logoUrl} />}
        <article className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 text-slate-800">
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm mb-6">
            <Link to={privacyHref(orgId)} className={kind === "privacy" ? "font-semibold text-slate-900" : "text-blue-600 hover:underline"}>Политика конфиденциальности</Link>
            <Link to={termsHref(orgId)} className={kind === "terms" ? "font-semibold text-slate-900" : "text-blue-600 hover:underline"}>Пользовательское соглашение</Link>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{title}</h1>
          <p className="text-sm text-slate-500 mt-2">Редакция от {date}</p>

          <ol className="mt-6 mb-8 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {blocks.map((b, i) => <li key={i}><a href={`#s${i}`} className="text-blue-600 hover:underline">{b.h}</a></li>)}
          </ol>

          <div className="space-y-7 leading-relaxed">
            {blocks.map((b, i) => (
              <section key={i} id={`s${i}`} className="scroll-mt-6">
                <h2 className="text-lg font-bold mb-2">{b.h}</h2>
                {(b.p || []).map((t, k) => <p key={k} className="mb-2">{t}</p>)}
                {b.list && <ul className="list-disc pl-5 space-y-1.5">{b.list.map((t, k) => <li key={k}>{t}</li>)}</ul>}
              </section>
            ))}
          </div>

          <section className="mt-10 grid sm:grid-cols-2 gap-4 text-sm">
            {org && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <div className="font-semibold mb-2">Организация</div>
                <dl className="space-y-1">{row("Название", org.legalName || org.name)}{row("Почта", org.email)}{row("Адрес", org.address)}{row("Телефон", org.phone)}{row("ИНН", org.inn)}</dl>
              </div>
            )}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <div className="font-semibold mb-2">Оператор платформы</div>
              <dl className="space-y-1">{row("Владелец", op.name)}{row("Сайт", op.site)}{row("Почта", op.email)}{row("Телефон", op.phone)}{row("Адрес", op.address)}{row("ИНН", op.inn)}</dl>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
