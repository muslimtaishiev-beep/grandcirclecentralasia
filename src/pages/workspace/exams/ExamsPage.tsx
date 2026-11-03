import React from "react";
import { useOutletContext } from "react-router-dom";
import BankTab from "./BankTab";
import { useExamApi } from "./examApi";

/**
 * «Экзамены» — единый раздел вместо «Тестов», «Проверки и прокторинга» и
 * «Вступительного среза». Собирается по этапам: сейчас — банк вопросов
 * организации; конструктор экзаменов и кабинет проверки — следующие.
 */
export default function ExamsPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const api = useExamApi(activeTenant?.id || "");
  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[var(--text-main)]">Экзамены</h1>
        <p className="text-sm text-[var(--text-muted)]">Банк вопросов организации: дисциплины с кодами, все типы заданий, загрузка из Excel</p>
      </div>
      <div className="flex gap-1 border-b border-[var(--border-color)]">
        <span className="px-4 py-2 text-sm font-medium border-b-2 -mb-px border-[var(--accent)] text-[var(--accent)]">Банк вопросов</span>
      </div>
      {activeTenant?.id && <BankTab api={api} />}
    </div>
  );
}
