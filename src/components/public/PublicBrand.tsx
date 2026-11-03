import { useEffect } from "react";

/**
 * Шапка страниц, которые открывают люди со стороны: подпись по QR, форма
 * заявки, билет. Человек должен с первого взгляда понять, чья это страница
 * — иначе ссылка из QR выглядит как подозрительный сторонний сайт.
 *
 * Логотип крупно по центре, без логотипа — название организации. Название
 * уходит и во вкладку браузера.
 */
export default function PublicBrand({ name, logoUrl, dark }: {
  name?: string | null; logoUrl?: string | null; dark?: boolean;
}) {
  useEffect(() => {
    if (!name) return;
    const prev = document.title;
    document.title = name;
    return () => { document.title = prev; };
  }, [name]);

  if (!logoUrl && !name) return null;
  return (
    <div className="flex justify-center mb-5">
      {logoUrl ? (
        // На тёмной странице — белая плашка: логотипы почти всегда рисуют под светлый фон.
        <div className={dark ? "bg-white rounded-2xl px-4 py-3" : ""}>
          <img src={logoUrl} alt={name || ""} className="h-14 sm:h-16 w-auto max-w-[260px] object-contain" />
        </div>
      ) : (
        <div className={`text-lg font-bold text-center ${dark ? "text-slate-100" : "text-slate-800"}`}>{name}</div>
      )}
    </div>
  );
}
