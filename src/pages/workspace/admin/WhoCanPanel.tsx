import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Spinner, EmptyState, Table, input } from "../../../components/ui";
import { PERMISSIONS } from "../../../shared/permissions";
import { apiCall, errText } from "./api";

interface Holder { uid: string; name: string; via: string[]; effective: boolean }
interface Report { key: string; label: string; moduleOff: boolean; holders: Holder[] }

const viaText = (v: string) => v.startsWith("role:") ? `Роль: ${v.slice(5)}` : v.startsWith("position:") ? `Должность: ${v.slice(9)}` : "Личное право";

/** «Кто может…»: выбираем право — видим людей и откуда у них оно. */
export default function WhoCanPanel({ tenantId, base }: { tenantId: string; base: string }) {
  const [perm, setPerm] = useState<string>(PERMISSIONS[0]?.key || "");
  const [rep, setRep] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tenantId || !perm) return;
    let alive = true;
    setRep(null); setError("");
    apiCall<{ report: Report[] }>(`/api/tenants/${tenantId}/access-report?perm=${encodeURIComponent(perm)}`)
      .then(j => { if (alive) setRep(j.report[0] || null); })
      .catch(e => { if (alive) setError(errText(e)); });
    return () => { alive = false; };
  }, [tenantId, perm]);

  const groups = [...new Set(PERMISSIONS.map(p => p.category))];
  return (
    <div>
      <div className="mb-3">
        <select value={perm} onChange={e => setPerm(e.target.value)} aria-label="Право" className={`${input} sm:!w-96`}>
          {groups.map(g => (
            <optgroup key={g} label={g}>
              {PERMISSIONS.filter(p => p.category === g).map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      {error && <div className="mb-3 text-sm text-rose-600 dark:text-rose-400">{error}</div>}
      {!rep && !error ? <Spinner /> : rep && (!rep.holders.length ? <EmptyState title="Ни у кого нет этого права" /> : (
        <Table minWidth={520}>
          <thead><tr><th>Сотрудник</th><th>Откуда право</th><th>Действует</th></tr></thead>
          <tbody>
            {rep.holders.map(h => (
              <tr key={h.uid}>
                <td><Link to={`${base}/admin/staff/${encodeURIComponent(h.uid)}`} className="font-medium hover:underline">{h.name || h.uid}</Link></td>
                <td>{h.via.map(viaText).join(", ")}</td>
                <td>{h.effective ? "Да" : <span className="text-amber-600 dark:text-amber-400">Модуль выключен</span>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ))}
    </div>
  );
}
