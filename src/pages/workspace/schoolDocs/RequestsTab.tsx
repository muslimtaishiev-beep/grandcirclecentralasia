import { EmptyState } from "../../../components/ui";
import { ClipboardCheck } from "lucide-react";
import type { DocsApi } from "./docsApi";

/** Сборы документов — следующий этап. */
export default function RequestsTab(_p: { api: DocsApi; tenantId: string; tree: any; onOpenFolder: (id: string) => void }) {
  return <EmptyState icon={<ClipboardCheck />} title="Сборы документов скоро появятся" />;
}
