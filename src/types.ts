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
  lat?: string | number;
  lng?: string | number;
  avatarBase64?: string;
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

export interface Metric {
  id: string;
  value: string;
  label_ru: string;
  label_en: string;
  label_kg?: string;
  sublabel_ru?: string;
  sublabel_en?: string;
  sublabel_kg?: string;
  order: number;
}

export interface Subscriber {
  id: string;
  name: string;
  email: string;
  phone: string;
  timestamp: string;
}

export interface University {
  id: string;
  name: string;
  domain: string;
  logoBase64: string;
  logoScale?: number;
}

export interface PublicData {
  settings: Settings;
  speakers: Speaker[];
  program: ProgramSlot[];
  partners: Partner[];
  tickets: Ticket[];
  metrics: Metric[];
  universities: University[];
}

export type Subject = "russian" | "math" | "logic";

export interface Question {
  id: string;
  text: string;
  type: "multiple_choice" | "free_text" | "two_step";
  options?: string[]; // Only for multiple_choice
  points: number;
}

export interface TestData {
  grade: number;
  russian: Question[];
  math: Question[];
  logic: Question[];
}
