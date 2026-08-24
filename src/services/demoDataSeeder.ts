import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { generateShortId } from '../lib/utils';

export async function seedRealisticTenantData(tenantId: string) {
  const batch = writeBatch(db);
  const now = serverTimestamp();

  // 1. CRM Contacts (12 profiles)
  const contactIds: string[] = [];
  const contacts = [
    { fullName: "Алиса Смирнова", phone: "+996555111222", email: "alisa@example.com", status: "active" },
    { fullName: "Нурбек Азаматов", phone: "+996777333444", email: "nurbek@example.com", status: "active" },
    { fullName: "Сабина Ким", phone: "+996500555666", email: "sabina@example.com", status: "active" },
    { fullName: "Арсен Тимуров", phone: "+996700888999", email: "arsen@example.com", status: "active" },
    { fullName: "Елена Попова", phone: "+996555000111", email: "elena@example.com", status: "lead" },
    { fullName: "Тимур Бекмаматов", phone: "+996777222333", email: "timur@example.com", status: "active" },
    { fullName: "Мадина Исакова", phone: "+996500444555", email: "madina@example.com", status: "active" },
    { fullName: "Ислам Расулов", phone: "+996700666777", email: "islam@example.com", status: "active" },
    { fullName: "Камила Осмонова", phone: "+996555888999", email: "kamila@example.com", status: "lead" },
    { fullName: "Даниэль Ли", phone: "+996777111000", email: "daniel@example.com", status: "active" },
    { fullName: "Айдана Усупова", phone: "+996500222333", email: "aidana@example.com", status: "active" },
    { fullName: "Эмир Торобеков", phone: "+996700444555", email: "emir@example.com", status: "active" }
  ];

  contacts.forEach((c) => {
    const contactRef = doc(collection(db, 'crm_contacts'));
    contactIds.push(contactRef.id);
    batch.set(contactRef, {
      id: contactRef.id,
      tenantId,
      fullName: c.fullName,
      phone: c.phone,
      email: c.email,
      status: c.status,
      source: "organic",
      createdAt: now,
      updatedAt: now
    });
  });

  // 2. CRM Deals (2 funnels, 8 active deals)
  const pipelines = ["Прием на обучение 2026", "Корпоративные тренинги"];
  const stages = ["Новый", "Взят в работу", "Назначен пробный", "Оплачен"];
  
  for (let i = 0; i < 8; i++) {
    const dealRef = doc(collection(db, 'crm_deals'));
    const contactIdx = i % contactIds.length;
    batch.set(dealRef, {
      id: dealRef.id,
      tenantId,
      title: `Сделка: ${contacts[contactIdx].fullName}`,
      contactId: contactIds[contactIdx],
      contactName: contacts[contactIdx].fullName,
      pipeline: pipelines[i % 2],
      stage: stages[i % 4],
      amount: (i + 1) * 10000,
      currency: "KGS",
      probability: 50 + (i * 5),
      createdAt: now,
      updatedAt: now
    });
  }

  // 3. Edu Groups (5 groups)
  const groups = ["IELTS Intensive", "SAT Math", "Python AI Junior", "General English B2", "Scratch Kids"];
  groups.forEach((g) => {
    const groupRef = doc(collection(db, 'edu_groups'));
    batch.set(groupRef, {
      id: groupRef.id,
      tenantId,
      name: g,
      capacity: 15,
      studentIds: contactIds.slice(0, 5),
      teacherId: "demo-teacher",
      createdAt: now
    });
  });

  // 4. Tasks (6 tasks)
  const tasks = [
    { title: "Подготовить материалы к IELTS", stage: "todo" },
    { title: "Обзвонить лидов за вчера", stage: "in_progress" },
    { title: "Проверить тесты 9 класса", stage: "done" },
    { title: "Настроить зум-аккаунты", stage: "todo" },
    { title: "Оплата аренды", stage: "in_progress" },
    { title: "Собрать отзывы", stage: "todo" }
  ];

  tasks.forEach((t) => {
    const taskRef = doc(collection(db, 'tasks'));
    batch.set(taskRef, {
      id: taskRef.id,
      tenantId,
      title: t.title,
      description: "Авто-сгенерированная задача",
      stage: t.stage,
      assigneeId: "demo-user",
      createdAt: now,
      updatedAt: now
    });
  });

  // 5. Documents (2 docs)
  const doc1Ref = doc(collection(db, 'documents'));
  batch.set(doc1Ref, {
    id: doc1Ref.id,
    tenantId,
    title: "Политика школы",
    content: "[]", // simplified
    createdAt: now,
    updatedAt: now,
    authorId: "demo-user"
  });

  const doc2Ref = doc(collection(db, 'documents'));
  batch.set(doc2Ref, {
    id: doc2Ref.id,
    tenantId,
    title: "Шаблон договора",
    content: "[]",
    createdAt: now,
    updatedAt: now,
    authorId: "demo-user"
  });

  // 6. Spreadsheets (1 sheet)
  const sheetRef = doc(collection(db, 'spreadsheets'));
  batch.set(sheetRef, {
    id: sheetRef.id,
    tenantId,
    title: "Бюджет расходов",
    cells: {
      "A1": { displayValue: "Статья", rawValue: "Статья", type: "string" },
      "B1": { displayValue: "Сумма", rawValue: "Сумма", type: "string" },
      "A2": { displayValue: "Аренда", rawValue: "Аренда", type: "string" },
      "B2": { displayValue: "50000", rawValue: "50000", type: "number", numValue: 50000 },
      "A3": { displayValue: "Интернет", rawValue: "Интернет", type: "string" },
      "B3": { displayValue: "3000", rawValue: "3000", type: "number", numValue: 3000 },
      "A4": { displayValue: "Итого", rawValue: "Итого", type: "string" },
      "B4": { displayValue: "53000", rawValue: "=SUM(B2:B3)", type: "formula", numValue: 53000 }
    },
    rowCount: 50,
    colCount: 20,
    createdAt: now,
    updatedAt: now,
    authorId: "demo-user"
  });

  // 7. Automations (2 functions)
  const func1 = doc(collection(db, 'automations'));
  batch.set(func1, {
    id: func1.id,
    tenantId,
    name: "Выписка академической справки",
    trigger: "http",
    code: "console.log('Done');",
    active: true,
    createdAt: now
  });

  const func2 = doc(collection(db, 'automations'));
  batch.set(func2, {
    id: func2.id,
    tenantId,
    name: "Запись на пробный урок",
    trigger: "firestore_create",
    code: "console.log('Done');",
    active: true,
    createdAt: now
  });

  await batch.commit();
}
