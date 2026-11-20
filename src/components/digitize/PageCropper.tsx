/** ЗАГЛУШКА: интерфейс зафиксирован, реализацию пишет отдельная задача. */

/** Обрезанная и выровненная страница. */
export interface CroppedPage {
  /** Для распознавания: до DIGITIZE_LIMITS.recognizeMaxSide px, JPEG, длина ≤ DIGITIZE_LIMITS.maxRecognizeImage. */
  recognize: string;
  /** Для хранения и превью: до DIGITIZE_LIMITS.storeMaxSide px, ≤ DIGITIZE_LIMITS.storeMaxBytes. */
  store: string;
}

export interface PageCropperProps {
  file: File;
  onDone: (page: CroppedPage) => void;
  onCancel: () => void;
}

export default function PageCropper(_props: PageCropperProps) {
  return null;
}
