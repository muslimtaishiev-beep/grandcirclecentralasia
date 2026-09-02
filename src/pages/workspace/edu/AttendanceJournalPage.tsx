import React, { useState } from 'react';
import { useWorkspaceTerms } from '../../../lib/useWorkspaceConfig';
import { Calendar, Users } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { useAttendanceJournal } from '../../../hooks/edu/useAttendanceJournal';
import AttendanceCellEditor from './components/AttendanceCellEditor';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { AttendanceStatus } from '../../../types/edu';

import { useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export default function AttendanceJournalPage() {
  const terms = useWorkspaceTerms();
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const [groupId, setGroupId] = useState('g1');
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [students, setStudents] = useState<{id: string, name: string}[]>([]);
  const [groups, setGroups] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!activeTenant?.id) return;

      try {
        // Fetch groups
        const groupsSnap = await getDocs(query(collection(db, 'edu_groups'), where('tenantId', '==', activeTenant.id)));
        const fetchedGroups = groupsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name || 'Без названия' }));
        if (fetchedGroups.length > 0) {
          setGroups(fetchedGroups);
          if (groupId === 'g1') setGroupId(fetchedGroups[0].id);
        }

        // Fetch students
        const studentsSnap = await getDocs(query(collection(db, 'crm_contacts'), where('tenantId', '==', activeTenant.id)));
        const fetchedStudents = studentsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name || doc.data().fullName || 'Неизвестный' }));
        if (fetchedStudents.length > 0) {
          setStudents(fetchedStudents);
        }
      } catch (error) {
        console.error("Error fetching attendance data:", error);
      }
    };
    
    fetchData();
  }, [activeTenant?.id]);

  const { records, markAttendance } = useAttendanceJournal(activeTenant?.id, groupId, month);

  const monthDate = new Date(`${month}-01T00:00:00Z`);
  const daysInMonth = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });
  
  // Let's assume lessons happen on Mon, Wed, Fri
  const lessonDates = daysInMonth.filter(d => [1, 3, 5].includes(getDay(d))).map(d => format(d, 'yyyy-MM-dd'));

  const handleStatusChange = async (lessonId: string, studentId: string, studentName: string, status: AttendanceStatus) => {
    await markAttendance(lessonId, studentId, studentName, status, 't1'); // using mock teacher ID 't1'
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[var(--bg-app)]">
      {/* Header Toolbar */}
      <div className="p-4 bg-[var(--bg-panel)] border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black text-[var(--text-main)]">Журнал посещаемости</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <select 
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2 text-sm font-bold focus:outline-none focus:border-[var(--accent)]"
            >
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input 
              type="month" 
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2 text-sm font-bold focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-2xl shadow-sm overflow-hidden inline-block min-w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-surface)] border-b border-[var(--border-color)]">
                <th className="p-4 text-sm font-bold text-[var(--text-muted)] sticky left-0 z-10 bg-[var(--bg-surface)] w-64 border-r border-[var(--border-color)]">
                  {terms.student}
                </th>
                {lessonDates.map(date => (
                  <th key={date} className="p-3 text-center min-w-[80px] border-r border-[var(--border-color)]">
                    <div className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1">
                      {format(new Date(date), 'EE', { locale: ru })}
                    </div>
                    <div className={`text-base font-black ${format(new Date(date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'text-[var(--accent)]' : 'text-[var(--text-main)]'}`}>
                      {format(new Date(date), 'd')}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map(student => (
                <tr key={student.id} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-surface)]/50 transition">
                  <td className="p-4 font-bold text-[var(--text-main)] sticky left-0 z-10 bg-[var(--bg-panel)] border-r border-[var(--border-color)]">
                    {student.name}
                  </td>
                  {lessonDates.map(date => {
                    const record = records.find(r => r.lessonId === date && r.studentContactId === student.id);
                    return (
                      <td key={date} className="p-2 text-center border-r border-[var(--border-color)]">
                        <div className="flex justify-center">
                          <AttendanceCellEditor 
                            initialStatus={record?.status}
                            onChange={(status) => handleStatusChange(date, student.id, student.name, status)}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
