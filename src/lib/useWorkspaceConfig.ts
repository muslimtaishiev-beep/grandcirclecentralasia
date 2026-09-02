import { useOutletContext } from "react-router-dom";
import { resolveWorkspaceConfig } from "../shared/workspaceConfig";

/**
 * Конфиг воркспейса текущей организации — из контекста Layout.
 *
 * Для организации без сохранённого конфига возвращаются прежние тексты
 * («Преподаватель», «Кабинет», «Урок»…) — существующие организации выглядят
 * ровно как раньше.
 */
export function useWorkspaceConfig() {
  const ctx = useOutletContext<{ activeTenant?: any } | null>();
  return resolveWorkspaceConfig(ctx?.activeTenant?.workspaceConfig);
}

/** Короткий доступ к терминологии: t.teacher, t.room, t.lesson… */
export function useWorkspaceTerms() {
  return useWorkspaceConfig().terms;
}
