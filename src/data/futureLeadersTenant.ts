export const FUTURE_LEADERS_TENANT = {
  id: "org_future_leaders",
  name: "ОсОО «Академия Будущих Лидеров»",
  slug: "future-leaders",
  domain: "futureleaders.edu.kg",
  status: "active",
  branding: {
    logoUrl: null,
    primaryColor: "#4f46e5",
    loginMessage: "Добро пожаловать в Портал Оценки и Прокторинга ОсОО «Академия Будущих Лидеров»"
  },
  settings: {
    maxStudents: 500,
    allowedDomains: ["futureleaders.edu.kg"],
    proctoringEnabled: true,
    storageProvider: "firebase_storage"
  },
  contacts: {
    email: "info@futureleaders.edu.kg",
    phone: "+996 (555) 123-456"
  }
};
