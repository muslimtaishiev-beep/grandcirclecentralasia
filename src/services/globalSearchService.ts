import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
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
  if (!searchQuery || searchQuery.length < 2) return results;
  const lowerQuery = searchQuery.toLowerCase();

  try {
    // 1. Search CRM Deals
    const dealsRef = collection(db, 'crm_deals');
    const dealsQ = query(dealsRef, where('tenantId', '==', tenantId), limit(50));
    const dealsSnap = await getDocs(dealsQ);
    dealsSnap.forEach(doc => {
      const data = doc.data();
      if (data.title?.toLowerCase().includes(lowerQuery) || data.contactName?.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: doc.id,
          title: data.title || 'Сделка без названия',
          description: data.contactName || '',
          category: 'Сделки',
          path: `/workspace/${tenantId}/crm/deals`
        });
      }
    });

    // 2. Search Contacts
    const contactsRef = collection(db, 'crm_contacts');
    const contactsQ = query(contactsRef, where('tenantId', '==', tenantId), limit(50));
    const contactsSnap = await getDocs(contactsQ);
    contactsSnap.forEach(doc => {
      const data = doc.data();
      if (data.fullName?.toLowerCase().includes(lowerQuery) || data.phone?.includes(lowerQuery) || data.email?.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: doc.id,
          title: data.fullName || 'Без имени',
          description: data.phone || data.email || '',
          category: 'Контакты',
          path: `/workspace/${tenantId}/crm/contacts`
        });
      }
    });

    // 3. Search Tasks
    const tasksRef = collection(db, 'tasks');
    const tasksQ = query(tasksRef, where('tenantId', '==', tenantId), limit(50));
    const tasksSnap = await getDocs(tasksQ);
    tasksSnap.forEach(doc => {
      const data = doc.data();
      if (data.title?.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: doc.id,
          title: data.title,
          category: 'Задачи',
          path: `/workspace/${tenantId}/tasks/list`
        });
      }
    });

    // 4. Search Documents
    const docsRef = collection(db, 'documents');
    const docsQ = query(docsRef, where('tenantId', '==', tenantId), limit(50));
    const docsSnap = await getDocs(docsQ);
    docsSnap.forEach(doc => {
      const data = doc.data();
      if (data.title?.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: doc.id,
          title: data.title,
          category: 'Документы',
          path: `/workspace/${tenantId}/docs/${doc.id}`
        });
      }
    });

    // 5. Search Spreadsheets
    const sheetsRef = collection(db, 'spreadsheets');
    const sheetsQ = query(sheetsRef, where('tenantId', '==', tenantId), limit(50));
    const sheetsSnap = await getDocs(sheetsQ);
    sheetsSnap.forEach(doc => {
      const data = doc.data();
      if (data.title?.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: doc.id,
          title: data.title,
          category: 'Таблицы',
          path: `/workspace/${tenantId}/sheets/${doc.id}`
        });
      }
    });

  } catch (error) {
    console.error('Error in global search:', error);
  }

  return results.slice(0, 10); // Limit to top 10 results overall
}
