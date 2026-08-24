import { TestData, Question } from "../types";

// Empty base structure per grade — all question text and content are dynamically fetched from Firestore
export const testsData: Record<number, TestData> = {
  1: { grade: 1, russian: [], math: [], logic: [], english: [] },
  2: { grade: 2, russian: [], math: [], logic: [], english: [] },
  3: { grade: 3, russian: [], math: [], logic: [], english: [] },
  4: { grade: 4, russian: [], math: [], logic: [], english: [] },
  5: { grade: 5, russian: [], math: [], logic: [], english: [] },
  6: { grade: 6, russian: [], math: [], logic: [], english: [] },
  7: { grade: 7, russian: [], math: [], logic: [], english: [] },
  8: { grade: 8, russian: [], math: [], logic: [], english: [] },
  9: { grade: 9, russian: [], math: [], logic: [], english: [] },
  10: { grade: 10, russian: [], math: [], logic: [], english: [] },
  11: { grade: 11, russian: [], math: [], logic: [], english: [] }
};
