import React, { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Modal, btn, btnPrimary, input, label } from "../journals/components/ui";
import type { Api } from "./admissionApi";

/**
 * «Новый поступающий» — заводит администрация: с главной страницы экзаменов,
 * со страницы вступительного теста (класс уже подставлен) или из «Поступающих».
 */
export default function NewApplicantModal({ api, grade, onClose, onDone }: { api: Api; grade?: string; onClose: () => void; onDone: (id: string, grade: string) => void }) {
  const [f, setF] = useState({ name: "", birthDate: "", grade: grade || "", parentName: "", phone: "", email: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setError(null);
    try {
      const j = await api("/applicants", { method: "POST", body: JSON.stringify({ child: { name: f.name, birthDate: f.birthDate, grade: f.grade }, parent: { name: f.parentName, phone: f.phone, email: f.email }, note: f.note }) });
      onDone(j.id, f.grade);
    } catch (e: any) { setError(e.message); setBusy(false); }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={grade ? `Новый поступающий · ${grade} класс` : "Новый поступающий"} onClose={onClose}>
      <div className="space-y-3">
        <div><span className={label}>ФИО ребёнка</span><input className={input} value={f.name} onChange={set("name")} autoFocus /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><span className={label}>Поступает в класс</span><input className={input} inputMode="numeric" value={f.grade} onChange={set("grade")} placeholder="7" /></div>
          <div><span className={label}>Дата рождения</span><input type="date" className={input} value={f.birthDate} onChange={set("birthDate")} /></div>
        </div>
        <div><span className={label}>ФИО родителя</span><input className={input} value={f.parentName} onChange={set("parentName")} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><span className={label}>Телефон родителя</span><input className={input} inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="+996 …" /></div>
          <div><span className={label}>Почта родителя</span><input className={input} type="email" inputMode="email" value={f.email} onChange={set("email")} placeholder="name@mail.com" /></div>
        </div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2">
          <button className={btn} onClick={onClose}>Отмена</button>
          <button className={btnPrimary} disabled={busy || !f.name.trim() || !f.grade.trim()} onClick={save}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Завести</button>
        </div>
      </div>
    </Modal>
  );
}
