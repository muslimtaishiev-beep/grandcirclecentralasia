import { privacyHref, termsHref } from "../../shared/legalDocs";

/** Ссылки на политику и соглашение внизу публичных страниц (раньше их давал подвал форума). */
export default function LegalLinks({ orgId, dark }: { orgId?: string | null; dark?: boolean }) {
  const c = dark ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-600";
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs mt-6">
      <a href={privacyHref(orgId)} target="_blank" rel="noreferrer" className={`${c} hover:underline`}>Политика конфиденциальности</a>
      <a href={termsHref(orgId)} target="_blank" rel="noreferrer" className={`${c} hover:underline`}>Пользовательское соглашение</a>
    </div>
  );
}
