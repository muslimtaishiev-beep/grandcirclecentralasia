/** ЗАГЛУШКА: интерфейс зафиксирован, реализацию пишет отдельная задача. */
import type { Journal, JournalEntry } from "../../shared/journals";
import type { DigitizedScan } from "../../shared/digitize";

export interface DigitizeWizardProps {
  tenantId: string;
  /** Открыт из журнала: режим «Журнал», цель — этот журнал, выбора нет. */
  journal?: Journal;
  onClose: () => void;
  /** После сохранения. entries — созданные записи, если сохраняли в журнал. */
  onSaved?: (r: { scan: DigitizedScan | null; entries?: JournalEntry[] }) => void;
}

export default function DigitizeWizard(_props: DigitizeWizardProps) {
  return null;
}
