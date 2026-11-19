/** Темы ленты изменений организации (документ live/{tenantId}). */
export type LiveTopic = "admissions" | "exams";

/** Отметка темы: когда изменилось и что (id поступающего или работы; пусто — «что-то в списке»). */
export interface LiveMark { at: number; id: string }
