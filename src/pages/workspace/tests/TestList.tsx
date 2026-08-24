import React, { useState, useEffect } from 'react';
import { useOutletContext, Link, useParams } from 'react-router-dom';
import { FileQuestion, ShieldCheck, Play, Plus, Loader2, Database } from 'lucide-react';
import { CopyButton } from '../../../components/ui/CopyButton';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { testsData } from '../../../data/testsData';

export default function TestList() {
  const { activeTenant } = useOutletContext<any>() || {};
  const { orgId } = useParams();
  const currentOrgId = activeTenant?.id || orgId || 'org_future_leaders';

  const [dbTests, setDbTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);



  useEffect(() => {
    if (!currentOrgId) return;

    setLoading(true);
    const q = query(
      collection(db, 'tests'),
      where('tenantId', '==', currentOrgId)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetched: any[] = [];
      snapshot.forEach(d => {
        fetched.push({ id: d.id, ...d.data() });
      });

      if (fetched.length === 0 && !syncing) {
        setSyncing(true);
        // Auto-seed entrance tests for the tenant
        try {
          const grades = [7, 8, 9, 10, 11];
          for (const g of grades) {
            const rawData = testsData[g] || testsData[`grade_${g}`];
            const questionsGrouped = rawData?.questions || {
              russian: rawData?.russian || [],
              math: rawData?.math || [],
              logic: rawData?.logic || [],
              english: rawData?.english || []
            };
            const ruCount = (questionsGrouped.russian || []).length;
            const maCount = (questionsGrouped.math || []).length;
            const loCount = (questionsGrouped.logic || []).length;
            const enCount = (questionsGrouped.english || []).length;
            const totalCount = ruCount + maCount + loCount + enCount;

            const docId = `test_grade_${g}_${currentOrgId}`;
            await setDoc(doc(db, 'tests', docId), {
              id: docId,
              tenantId: currentOrgId,
              grade: g,
              title: `Вступительный экзамен — ${g} класс`,
              status: 'Active',
              timeLimit: 90,
              questionsCount: totalCount,
              details: `Русский (${ruCount}), Математика (${maCount}), Логика (${loCount}), Английский (${enCount})`,
              questions: questionsGrouped,
              createdAt: serverTimestamp()
            }, { merge: true });
          }
        } catch (e) {
          console.warn("Auto-seed tests notice:", e);
        } finally {
          setSyncing(false);
          setLoading(false);
        }
      } else {
        fetched.sort((a, b) => (a.grade || 0) - (b.grade || 0));
        setDbTests(fetched);
        setLoading(false);
      }
    }, (err) => {
      console.warn("Firestore tests listener notice:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentOrgId]);

  const displayTests = dbTests;

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-[var(--text-main)]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span>Вступительные Тесты (7–11 Классы)</span>
            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1 border border-emerald-500/20">
              <Database className="w-3 h-3" /> Firestore DB Sync
            </span>
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">Официальные экзаменационные материалы, загружаемые из базы данных Firestore для {activeTenant?.name || "Grand Circle Central Asia"}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link 
            to={`/workspace/${currentOrgId}/tests/manage`}
            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition"
          >
            <ShieldCheck className="w-4 h-4" /> Кабинет Проверки Управляющего
          </Link>
          
          <Link 
            to={`/workspace/${currentOrgId}/tests/new`}
            className="bg-[var(--accent)] text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:opacity-90 transition shadow-xs"
          >
            <Plus className="w-4 h-4" /> Создать Тест
          </Link>
        </div>
      </div>

      {/* Manager Test Review Banner */}
      <div className="bg-emerald-950/40 border border-emerald-800/80 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h3 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Кабинет Проверки Ответников и Прокторинга для Управляющего</span>
          </h3>
          <p className="text-xs text-emerald-200/70 mt-1">Просмотр результатов абитуриентов, видеозаписей кадра прокторинга, выгрузка PDF-отчетов и официальных сертификатов.</p>
        </div>
        <Link
          to={`/workspace/${currentOrgId}/tests/manage`}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 shrink-0"
        >
          <span>Открыть Кабинет Проверки</span>
          <span>➔</span>
        </Link>
      </div>

      {/* List */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-xs">
        {loading && dbTests.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-[var(--text-muted)] text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
            <span>Синхронизация тестов с базой данных Firestore...</span>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-panel)] border-b border-[var(--border-color)] text-[var(--text-muted)] font-mono uppercase">
              <tr>
                <th className="px-6 py-3.5 font-bold">Класс / Название Теста</th>
                <th className="px-6 py-3.5 font-bold">Предметы & Задания</th>
                <th className="px-6 py-3.5 font-bold">Статус</th>
                <th className="px-6 py-3.5 font-bold text-right">Действия & Ссылка</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {displayTests.map(test => {
                const gradeNum = test.grade || 10;
                const testDocId = test.id || `test_grade_${gradeNum}_${currentOrgId}`;
                const studentLink = `${window.location.origin}/${currentOrgId}/test/${testDocId}`;
                return (
                  <tr key={test.id || gradeNum} className="hover:bg-black/5 dark:hover:bg-white/5 transition group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center border border-purple-500/20 font-bold font-mono">
                          {gradeNum} кл
                        </div>
                        <div>
                          <div className="font-bold text-[var(--text-main)]">{test.title}</div>
                          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Время прохождения: {test.timeLimit || 90} мин.</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="font-semibold text-[var(--text-main)]">{test.questionsCount || 25} вопросов в сумме</div>
                        <div className="text-[11px] text-[var(--text-muted)]">{test.details || "Стандартный комплексный экзамен"}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        {test.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/${currentOrgId}/test/${testDocId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition"
                        >
                          <Play className="w-3.5 h-3.5" /> Пройти Тест
                        </a>
                        <CopyButton text={studentLink} label="Скопировать ссылку" />
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
