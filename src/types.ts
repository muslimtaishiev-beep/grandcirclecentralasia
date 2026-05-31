export interface Settings {
  eventDate: string;
  eventVenue: string;
  adminPassword?: string;
  contactEmail: string;
  contactPhone: string;
}

export interface Speaker {
  id: string;
  name_ru: string;
  name_en: string;
  name_kg?: string;
  university: string;
  major_ru: string;
  major_en: string;
  major_kg?: string;
  admissionYear: string;
  story_ru: string;
  story_en: string;
  story_kg?: string;
  lectureTopic_ru: string;
  lectureTopic_en: string;
  lectureTopic_kg?: string;
  lectureTime: string;
  colorTheme: string; // e.g. 'blue', 'purple', 'rose', 'cyan', 'indigo', 'teal', 'amber', 'orange', 'slate', 'emerald'
  isFeatured: boolean;
}

export interface ProgramSlot {
  id: string;
  time: string;
  title_ru: string;
  title_en: string;
  title_kg?: string;
  description_ru: string;
  description_en: string;
  description_kg?: string;
  speakerId: string; // matches Speaker.id
}

export interface Partner {
  id: string;
  name: string;
  logo?: string;
  role_ru: string;
  role_en: string;
  role_kg?: string;
  tier: string; // e.g. 'general', 'sponsor', 'partner'
}

export interface Ticket {
  id: string;
  name_ru: string;
  name_en: string;
  name_kg?: string;
  price: string;
  features_ru: string[];
  features_en: string[];
  features_kg?: string[];
  url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
}

export interface Subscriber {
  id: string;
  name: string;
  email: string;
  phone: string;
  timestamp: string;
}

export interface PublicData {
  settings: Settings;
  speakers: Speaker[];
  program: ProgramSlot[];
  partners: Partner[];
  tickets: Ticket[];
}
