import React, { useState, useEffect } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, HeartPulse, UserCheck, Calendar, Search, Loader2, Save } from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, getDocs, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import { AttendanceStatus, StudentSubscription } from '../../../types/edu';

interface StudentItem {
  id: string;
  name: string;
  groupName: string;
  subscriptionId?: string;
  remainingLessons?: number;
}

export default function AttendanceJournal() {
  const { activeTenant } = useOutletContext<any>();
  const { orgId } = useParams();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedGroup, setSelectedGroup] = useState('Группа А-1');

  const [subscriptions, setSubscriptions] = useState<StudentSubscription[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Demo Students list tied to active subscriptions or fallback
  const [students, setStudents] = useState<StudentItem[]>([
    { id: 'std_1', name: 'Алина Русланова', groupName: 'Группа А-1' },
    { id: 'std_2', name: 'Данияр Исмаилов', groupName: 'Группа А-1' },
    { id: 'std_3', name: 'Азиз Нурбеков', groupName: 'Группа А-1' },
    { id: 'std_4', name: 'Сабина Султанова', groupName: 'Группа Б-2' },
  ]);

  useEffect(() => {
    if (!orgId) return;

    // Fetch subscriptions
    const qSub = query(collection(db, 'subscriptions'), where('tenantId', '==', orgId));
    const unsubSub = onSnapshot(qSub, (snap) => {
      const subs: StudentSubscription[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentSubscription));
      setSubscriptions(subs);
    });

    // Fetch existing attendance logs for the date
    const qAtt = query(
      collection(db, 'attendance_logs'),
      where('tenantId', '==', orgId),
      where('date', '==', date)
    );

    const unsubAtt = onSnapshot(qAtt, (snap) => {
      const recs: Record<string, AttendanceStatus> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        recs[data.studentId] = data.status;
      });
      setAttendanceRecords(recs);
      setLoading(false);
    });

    return () => {
      unsubSub();
      unsubAtt();
    };
  }, [orgId, date]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleSaveAttendance = async () => {
    if (!orgId) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      const currentUserId = auth.currentUser?.uid || 'manager_system';

      for (const student of students) {
        const status = attendanceRecords[student.id];
        if (!status) continue;

        const sub = subscriptions.find(s => s.studentId === student.id && s.status === 'active');

        // Use atomic runTransaction to guarantee attendance record creation + remainingLessons decrement
        await runTransaction(db, async (transaction) => {
          let subRef = null;
          let newRemaining = 0;
          let subStatus = 'active';

          if (status === 'present' && sub) {
            subRef = doc(db, 'subscriptions', sub.id);
            const subDoc = await transaction.get(subRef);
            if (subDoc.exists()) {
              const data = subDoc.data() as any;
              const currentLessons = data.remainingLessons || 0;
              newRemaining = Math.max(0, currentLessons - 1);
              subStatus = newRemaining === 0 ? 'expired' : 'active';
            }
          }

          const attRef = doc(collection(db, 'attendance_logs'));
          transaction.set(attRef, {
            tenantId: orgId,
            eventId: 'evt_' + selectedGroup,
            eventTitle: selectedGroup + ' Занятие',
            studentId: student.id,
            studentName: student.name,
            date,
            status,
            deductedFromSubscriptionId: sub ? sub.id : null,
            markedByUserId: currentUserId,
            markedAt: serverTimestamp(),
          });

          if (subRef && status === 'present') {
            transaction.update(subRef, {
              remainingLessons: newRemaining,
              status: subStatus
            });
          }
        });
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('Ошибка при сохранении посещаемости:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)] flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-[var(--accent)]" /> Журнал Посещаемости
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            1-клик журнал отметок с автоматическим списанием уроков с абонементов
          </p>
        </div>

        <button
          onClick={handleSaveAttendance}
          disabled={saving}
          className="bg-[var(--accent)] text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:opacity-90 transition shadow-sm self-start sm:self-auto disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Save className="w-4.5 h-4.5" />}
          Сохранить журнал
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]">
            <Calendar className="w-4 h-4 text-[var(--accent)]" /> Дата:
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-[var(--text-muted)]">Группа:</span>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="Группа А-1">Группа А-1 (Английский B2)</option>
            <option value="Группа Б-2">Группа Б-2 (Математика)</option>
          </select>
        </div>
      </div>

      {/* Student Journal Table */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 flex items-center justify-center text-[var(--text-muted)]">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--bg-app)] border-b border-[var(--border-color)] text-[var(--text-muted)] font-mono text-xs uppercase">
              <tr>
                <th className="px-6 py-3 font-medium">ФИО Ученика</th>
                <th className="px-6 py-3 font-medium">Остаток Абонемента</th>
                <th className="px-6 py-3 font-medium text-center">Отметка в 1 клик</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {students
                .filter(s => s.groupName === selectedGroup)
                .map((std) => {
                  const sub = subscriptions.find(s => s.studentId === std.id && s.status === 'active');
                  const currentStatus = attendanceRecords[std.id];

                  return (
                    <tr key={std.id} className="hover:bg-[var(--bg-app)]/50 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-[var(--text-main)]">{std.name}</div>
                        <div className="text-xs text-[var(--text-muted)]">{std.groupName}</div>
                      </td>

                      <td className="px-6 py-4">
                        {sub ? (
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              Осталось: {sub.remainingLessons} из {sub.totalLessons}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-500 font-mono">Нет активного абонемента</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          
                          {/* Present */}
                          <button
                            onClick={() => handleStatusChange(std.id, 'present')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                              currentStatus === 'present'
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-emerald-500 border border-[var(--border-color)]'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" /> Был
                          </button>

                          {/* Absent */}
                          <button
                            onClick={() => handleStatusChange(std.id, 'absent')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                              currentStatus === 'absent'
                                ? 'bg-red-500 text-white shadow-sm'
                                : 'bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-red-500 border border-[var(--border-color)]'
                            }`}
                          >
                            <XCircle className="w-4 h-4" /> Пропуск
                          </button>

                          {/* Sick */}
                          <button
                            onClick={() => handleStatusChange(std.id, 'sick')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                              currentStatus === 'sick'
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-amber-500 border border-[var(--border-color)]'
                            }`}
                          >
                            <HeartPulse className="w-4 h-4" /> Болен
                          </button>

                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
