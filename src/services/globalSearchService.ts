import { collection, query, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface SearchResult {
  id: string;
  title: string;
  category: string;
  path: string;
  icon?: string;
  description?: string;
}

export async function searchGlobal(tenantId: string, searchQuery: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  if (!searchQuery || searchQuery.trim().length < 1) return results;
  
  const lowerQuery = searchQuery.trim().toLowerCase();
  // Без tenantId поиска нет: раньше здесь подставлялась Академия, а её id
  // вдобавок работал как wildcard, совпадающий с данными ВСЕХ организаций, —
  // глобальный поиск был межтенантной утечкой. Совпадение только строгое;
  // документы без tenantId не показываем никому — принадлежность неизвестна.
  const activeOrgId = tenantId;
  if (!activeOrgId) return results;

  const matchesTenant = (dataTenant?: string) => dataTenant === activeOrgId;

  try {
    // 1. Search CRM Contacts & Submissions (Students)
    const contactsSnap = await getDocs(query(collection(db, 'crm_contacts'), limit(100)));
    contactsSnap.forEach(doc => {
      const data = doc.data();
      if (!matchesTenant(data.tenantId)) return;

      const fullName = (data.fullName || data.name || '').toLowerCase();
      const phone = (data.phone || '').toLowerCase();
      const shortId = (data.shortId || '').toLowerCase();
      const email = (data.email || '').toLowerCase();

      if (fullName.includes(lowerQuery) || phone.includes(lowerQuery) || shortId.includes(lowerQuery) || email.includes(lowerQuery)) {
        results.push({
          id: doc.id,
          title: data.fullName || data.name || `Ученик ${shortId}`,
          description: `Класс: ${data.grade || 7} | Тел: ${data.phone || '—'} | ID: ${data.shortId || doc.id}`,
          category: 'Ученики / Контакты',
          path: `/workspace/${activeOrgId}/crm/contacts`
        });
      }
    });

    // 2. Search Submissions
    const subSnap = await getDocs(query(collection(db, 'submissions'), limit(100)));
    subSnap.forEach(doc => {
      const data = doc.data();
      if (!matchesTenant(data.tenantId)) return;

      const name = (data.studentName || '').toLowerCase();
      const shortId = (data.studentShortId || data.shortId || '').toLowerCase();

      if ((name.includes(lowerQuery) || shortId.includes(lowerQuery)) && !results.some(r => r.id === `cnt_${activeOrgId}_${shortId}`)) {
        results.push({
          id: doc.id,
          title: data.studentName || `Сдача тестов #${shortId}`,
          description: `Класс: ${data.grade} | Балл: ${data.scores?.total || 0} | ID: ${shortId}`,
          category: 'Тесты / Сдачи',
          path: `/workspace/${activeOrgId}/dashboard`
        });
      }
    });

    // 3. Search CRM Deals
    const dealsSnap = await getDocs(query(collection(db, 'crm_deals'), limit(100)));
    dealsSnap.forEach(doc => {
      const data = doc.data();
      if (!matchesTenant(data.tenantId)) return;

      const title = (data.title || '').toLowerCase();
      const contactName = (data.contactName || '').toLowerCase();
      const shortId = (data.shortId || '').toLowerCase();

      if (title.includes(lowerQuery) || contactName.includes(lowerQuery) || shortId.includes(lowerQuery)) {
        results.push({
          id: doc.id,
          title: data.title || 'Сделка без названия',
          description: `Клиент: ${data.contactName || '—'} | ID: ${data.shortId || doc.id}`,
          category: 'Сделки CRM',
          path: `/workspace/${activeOrgId}/crm/deals`
        });
      }
    });

    // 4. Search Workspace Documents & Spreadsheets
    const docsSnap = await getDocs(query(collection(db, 'workspace_documents'), limit(100)));
    docsSnap.forEach(doc => {
      const data = doc.data();
      if (!matchesTenant(data.tenantId)) return;

      const title = (data.title || '').toLowerCase();

      if (title.includes(lowerQuery)) {
        results.push({
          id: doc.id,
          title: data.title || 'Безымянный документ',
          description: `Тип: ${data.type === 'sheet' ? 'Таблица' : 'Документ'}`,
          category: data.type === 'sheet' ? 'Таблицы' : 'Документы',
          path: data.type === 'sheet' ? `/workspace/${activeOrgId}/sheets/${doc.id}` : `/workspace/${activeOrgId}/docs/${doc.id}`
        });
      }
    });

    // 5. Search Tasks
    const tasksSnap = await getDocs(query(collection(db, 'tasks'), limit(100)));
    tasksSnap.forEach(doc => {
      const data = doc.data();
      if (!matchesTenant(data.tenantId)) return;

      const title = (data.title || '').toLowerCase();

      if (title.includes(lowerQuery)) {
        results.push({
          id: doc.id,
          title: data.title || 'Задача без названия',
          description: `Статус: ${data.status || 'NEW'}`,
          category: 'Задачи',
          path: `/workspace/${activeOrgId}/tasks/list`
        });
      }
    });

  } catch (error) {
    console.error('Error in globalSearchService:', error);
  }

  return results.slice(0, 15);
}
