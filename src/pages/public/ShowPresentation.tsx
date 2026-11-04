import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import SlidePlayer from "../../components/presentations/SlidePlayer";
import type { PresentationAccessMode, PresentationFace, PresentationSlide } from "../../shared/presentations";

/**
 * Презентация по ссылке /show/<код>. Открытая «всем по ссылке» показывается
 * без входа; остальные — после входа, если человеку дан доступ. Видео и
 * картинки приходят временными ссылками, которые сервер выдаёт после
 * проверки.
 */
type Data = {
  org: { name: string; logoUrl: string | null };
  presentation: { title: string; description: string; kind: "slides" | "html"; slides: PresentationSlide[]; faces: Record<string, PresentationFace>; code: string; accessMode: PresentationAccessMode; tenantId: string };
  assets: Record<string, string>;
  canManage: boolean;
};

export default function ShowPresentation() {
  const { code = "" } = useParams();
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<{ kind: "loading" } | { kind: "login" | "denied" | "error"; message: string; org?: Data["org"] }>({ kind: "loading" });

  useEffect(() => {
    // Ждём, пока Firebase поднимет сессию: иначе вошедший сотрудник на
    // мгновение выглядел бы гостем и получал «войдите».
    const off = onAuthStateChanged(auth, async user => {
      try {
        const token = user ? await user.getIdToken() : "";
        const r = await fetch(`/api/presentations/show/${encodeURIComponent(code)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.success) { setData(j); document.title = j.presentation.title; return; }
        setState({ kind: j.needLogin ? "login" : r.status === 403 ? "denied" : "error", message: j.error || "Не удалось открыть презентацию", org: j.org });
      } catch { setState({ kind: "error", message: "Нет связи с сервером. Проверьте интернет и обновите страницу." }); }
    });
    return off;
  }, [code]);

  if (data) {
    // Тому, кто управляет, — путь к доступу и ссылке прямо из показа.
    const manage = data.canManage && (
      <a href={`/workspace/${data.presentation.tenantId}/presentations`} className="shrink-0 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold">Доступ и управление</a>
    );
    const brand0 = data.org.logoUrl
      ? <img src={data.org.logoUrl} alt={data.org.name} className="h-7 w-auto max-w-[140px] object-contain rounded bg-white/90 px-1.5 py-0.5" />
      : <span className="text-xs font-semibold text-white/60 truncate max-w-[160px]">{data.org.name}</span>;
    const brand = <>{brand0}{manage}</>;
    if (data.presentation.kind === "html") {
      return (
        <div className="h-dvh flex flex-col bg-[#0b0d12]">
          <div className="shrink-0 h-12 flex items-center gap-3 px-4 text-white">{brand}<div className="truncate text-sm font-semibold">{data.presentation.title}</div></div>
          {/* Чужая страница — со своего адреса хранилища и в песочнице: к нашему сайту доступа у неё нет. */}
          <iframe src={data.assets.index} title={data.presentation.title} className="flex-1 w-full border-0 bg-white"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals" allow="autoplay; fullscreen" allowFullScreen />
        </div>
      );
    }
    return <SlidePlayer title={data.presentation.title} slides={data.presentation.slides} faces={data.presentation.faces} assets={data.assets} header={brand} />;
  }

  if (state.kind === "loading") return <div className="h-dvh grid place-items-center bg-[#0b0d12] text-white/50 text-sm">Открываем презентацию…</div>;
  const next = `/show/${encodeURIComponent(code)}${location.hash}`;
  return (
    <div className="min-h-dvh grid place-items-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
        {state.org?.logoUrl && <img src={state.org.logoUrl} alt={state.org.name} className="h-12 mx-auto object-contain" />}
        {state.org?.name && !state.org.logoUrl && <div className="text-sm font-semibold text-slate-500">{state.org.name}</div>}
        <div className="text-4xl">{state.kind === "login" ? "🔒" : state.kind === "denied" ? "⛔" : "⚠️"}</div>
        <h1 className="text-lg font-bold text-slate-900">{state.kind === "login" ? "Презентация для сотрудников" : state.kind === "denied" ? "Нет доступа" : "Не получилось открыть"}</h1>
        <p className="text-sm text-slate-500">{state.message}</p>
        {state.kind === "login" && <Link to={`/login?next=${encodeURIComponent(next)}`} className="inline-block w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold">Войти</Link>}
        {state.kind === "denied" && <button className="text-sm text-blue-600 hover:underline" onClick={() => auth.signOut()}>Войти под другим аккаунтом</button>}
      </div>
    </div>
  );
}
