import { staticDb } from "./staticDb";

export type AppStudent = {
  id: string;
  name: string;
  university: string;
  city: string;
  location: [number, number]; // [lat, lng]
  message: string;
  tip: string;
  avatarUrl: string;
};

// Bishkek coordinates
export const BISHKEK = { lat: 42.8746, lon: 74.5698 };

export function studentLatLon(student: AppStudent): { lat: number; lon: number } {
  return { lat: student.location[0], lon: student.location[1] };
}

export function distanceFromBishkek(student: AppStudent): number {
  const { lat: lat2, lon: lon2 } = studentLatLon(student);
  const lat1 = BISHKEK.lat;
  const lon1 = BISHKEK.lon;

  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

const PORTRAITS = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=256&h=256&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&h=256&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=256&h=256&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=256&h=256&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=256&h=256&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=256&h=256&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=256&h=256&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=256&h=256&fit=crop&crop=faces",
];

// Mapping university to city and coordinates
const LOCATION_MAP: Record<string, { city: string; location: [number, number] }> = {
  "Harvard University": { city: "Бостон", location: [42.3736, -71.1097] },
  "Stanford University": { city: "Пало-Альто", location: [37.4275, -122.1697] },
  "MIT": { city: "Бостон", location: [42.3601, -71.0942] },
  "Columbia University": { city: "Нью-Йорк", location: [40.8075, -73.9626] },
  "University of Oxford": { city: "Оксфорд", location: [51.7548, -1.2544] },
  "Nazarbayev University": { city: "Астана", location: [51.1694, 71.4491] },
  "Yale University": { city: "Нью-Хейвен", location: [41.3163, -72.9223] },
  "Princeton University": { city: "Принстон", location: [40.3431, -74.6551] },
  "University of Cambridge": { city: "Кембридж", location: [52.2053, 0.1192] },
  "UCLA": { city: "Лос-Анджелес", location: [34.0689, -118.4452] },
  "University of Chicago": { city: "Чикаго", location: [41.7886, -87.5987] },
  "UPenn Wharton": { city: "Филадельфия", location: [39.9522, -75.1932] },
  "California Institute of Technology": { city: "Пасадина", location: [34.1377, -118.1253] },
  "Cornell University": { city: "Итака", location: [42.4534, -76.4735] },
  "Duke University": { city: "Дарем", location: [36.0014, -78.9382] },
  "AUCA": { city: "Бишкек", location: [42.8746, 74.5698] },
};

export function mapServerSpeakersToAppStudents(serverSpeakers: any[]): AppStudent[] {
  return serverSpeakers.map((speaker, idx) => {
    const loc = LOCATION_MAP[speaker.university] || { city: "Unknown", location: [42.8746, 74.5698] };
    
    // Check if the speaker has explicit coordinates set in CMS
    let finalLocation = loc.location;
    if (speaker.lat != null && speaker.lng != null && speaker.lat !== "" && speaker.lng !== "") {
      const parsedLat = parseFloat(String(speaker.lat));
      const parsedLng = parseFloat(String(speaker.lng));
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        finalLocation = [parsedLat, parsedLng];
      }
    }

    return {
      id: String(speaker.id),
      name: speaker.name_ru || speaker.name_en,
      university: speaker.university,
      city: loc.city, // We keep the mapped city, or we can just use the university name
      location: finalLocation as [number, number],
      message: speaker.story_ru || speaker.story_en,
      tip: speaker.lectureTopic_ru || speaker.lectureTopic_en,
      avatarUrl: speaker.avatarBase64 || PORTRAITS[idx % PORTRAITS.length],
    };
  });
}

const mappedSpeakers = mapServerSpeakersToAppStudents(staticDb.speakers);

export const APP_STUDENTS: AppStudent[] = [
  {
    id: "kg-1",
    name: "Азамат Касымов",
    university: "AUCA",
    city: "Бишкек",
    location: [42.8746, 74.5698],
    message: "Начните свой путь с качественного образования в Бишкеке и открывайте двери по всему миру.",
    tip: "Как использовать местные возможности для старта",
    avatarUrl: PORTRAITS[7],
  },
  ...mappedSpeakers
];
