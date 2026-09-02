import { useEffect, useState } from "react";

/**
 * Резолюция «человеческого» имени организации из URL в её id.
 *
 * Публичные страницы (/oxford-school/placement) получают из пути слаг, а все
 * API работают с id вида org_oxford_school. Раньше слаг подставлялся в
 * tenantId как есть — работали только адреса с длинным org_..., а при
 * неизвестном имени часть кода молча подставляла org_future_leaders, и чужая
 * школа видела данные Академии. Теперь неизвестное имя — это честная ошибка.
 */

const cacheKey = (slug: string) => `tenant_resolve_${slug}`;

export async function resolveTenantId(orgSlug: string): Promise<{ id: string; name: string } | null> {
  const slug = String(orgSlug || "").toLowerCase().trim();
  if (!slug) return null;
  // id передан напрямую — резолвить нечего.
  if (slug.startsWith("org_")) return { id: slug, name: "" };

  // Кэш на сессию: одна и та же страница дёргает резолвер на каждом переходе.
  try {
    const cached = sessionStorage.getItem(cacheKey(slug));
    if (cached) return JSON.parse(cached);
  } catch { /* приватный режим — работаем без кэша */ }

  try {
    const res = await fetch(`/api/tenant/resolve?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    const j = await res.json();
    if (!j.success) return null;
    const value = { id: j.id as string, name: (j.name as string) || "" };
    try { sessionStorage.setItem(cacheKey(slug), JSON.stringify(value)); } catch { /* ignore */ }
    return value;
  } catch {
    return null;
  }
}

/**
 * Хук для страниц: пока резолвим — loading, не нашли — notFound.
 * Никогда не подставляет чужую организацию вместо ненайденной.
 */
export function useResolvedTenantId(orgSlug: string | undefined) {
  const [state, setState] = useState<{
    tenantId: string; name: string; loading: boolean; notFound: boolean;
  }>({
    // org_-адреса резолвятся синхронно — без мигания экрана загрузки.
    tenantId: orgSlug?.startsWith("org_") ? orgSlug : "",
    name: "",
    loading: !!orgSlug && !orgSlug.startsWith("org_"),
    notFound: false,
  });

  useEffect(() => {
    let cancelled = false;
    if (!orgSlug) { setState({ tenantId: "", name: "", loading: false, notFound: true }); return; }
    if (orgSlug.startsWith("org_")) {
      setState({ tenantId: orgSlug, name: "", loading: false, notFound: false });
      return;
    }
    setState(s => ({ ...s, loading: true, notFound: false }));
    void resolveTenantId(orgSlug).then(r => {
      if (cancelled) return;
      if (r) setState({ tenantId: r.id, name: r.name, loading: false, notFound: false });
      else setState({ tenantId: "", name: "", loading: false, notFound: true });
    });
    return () => { cancelled = true; };
  }, [orgSlug]);

  return state;
}
