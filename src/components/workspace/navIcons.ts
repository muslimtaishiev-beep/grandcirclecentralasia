import {
  BookOpen, Briefcase, Calendar, CheckSquare, ClipboardList, CreditCard, DollarSign, FileCheck2, FileSpreadsheet,
  FileText, FolderTree, Globe, Hammer, LayoutDashboard, Mail, MessageSquare, MonitorPlay, QrCode, Settings2,
  Plug, ScrollText, Sliders, Sparkles, UserPlus, Users, Zap, type LucideIcon,
} from "lucide-react";
import type { NavIcon } from "../../shared/navigation";

/** Иконки пунктов реестра навигации. */
export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  home: LayoutDashboard, admissions: UserPlus, exams: ClipboardList, schedule: Calendar, journals: BookOpen,
  subscriptions: CreditCard, presentations: MonitorPlay, crm: Briefcase, forms: FileCheck2, tickets: QrCode,
  intake: Sliders, chat: MessageSquare, tasks: CheckSquare, docs: FileText, sheets: FileSpreadsheet,
  payroll: DollarSign, team: Users, audit: ScrollText, integrations: Plug, departments: FolderTree, workspace: Sparkles, emails: Mail,
  automations: Zap, sites: Globe, functions: Settings2, billing: CreditCard, builder: Hammer,
};
