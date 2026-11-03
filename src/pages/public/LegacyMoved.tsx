import PublicBrand from "../../components/public/PublicBrand";
import LegalLinks from "../../components/public/LegalLinks";

/**
 * Старые адреса прежнего теста и среза (/<организация>/test, /placement,
 * /results). Сами разделы перенесены в «Экзамены»: у каждого экзамена своя
 * ссылка, которую даёт организатор. Адреса остаются — они могли попасть на
 * распечатки и в чаты, — но ведут на понятное объяснение, а не на ошибку.
 */
export default function LegacyMoved() {
  return (
    <div className="min-h-dvh bg-slate-50 flex items-start justify-center p-4 py-16">
      <div className="w-full max-w-md">
        <PublicBrand />
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
          <div className="text-4xl">📝</div>
          <h1 className="text-xl font-bold text-slate-900">Тестирование перенесено</h1>
          <p className="text-sm text-slate-600">Экзамены теперь проходят по отдельной ссылке или QR-коду для каждого экзамена. Получите её у организатора — обычно её дают в аудитории вместе с PIN.</p>
          <p className="text-xs text-slate-400">Результаты прошлых тестирований сообщает организатор.</p>
        </div>
        <LegalLinks />
      </div>
    </div>
  );
}
