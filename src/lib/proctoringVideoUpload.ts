import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { app } from './firebase';

/**
 * Uploads a proctoring session recording to Firebase Storage.
 *
 * Storage rather than Firestore: a 90-minute webm runs to hundreds of
 * megabytes, far past Firestore's 1 MB document ceiling, and Storage is the
 * only place in this project sized for it. The file is never offered to the
 * student — it exists for the manager reviewing the session.
 *
 * Path: proctoring/{tenantId}/{shortId}/session.webm — mirrors how the rest of
 * the app scopes data by tenant, so a Storage rule can gate reads the same way
 * Firestore rules do.
 */
export async function uploadProctoringVideo(
  blob: Blob,
  tenantId: string,
  shortId: string,
  onProgress?: (percent: number) => void,
): Promise<{ success: boolean; url?: string; path?: string; error?: string }> {
  if (!blob || blob.size === 0) {
    return { success: false, error: 'Пустая запись' };
  }

  const path = `proctoring/${tenantId}/${shortId}/session.webm`;

  try {
    const storage = getStorage(app);
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, blob, {
      contentType: blob.type || 'video/webm',
      customMetadata: { tenantId, shortId },
    });

    await new Promise<void>((resolve, reject) => {
      task.on(
        'state_changed',
        (snap) => {
          if (onProgress && snap.totalBytes > 0) {
            onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
          }
        },
        reject,
        () => resolve(),
      );
    });

    const url = await getDownloadURL(task.snapshot.ref);
    return { success: true, url, path };
  } catch (e: any) {
    // Never rethrow: a failed upload must not cost the student their exam.
    console.warn('[ProctoringVideo] upload failed:', e?.message || e);
    return { success: false, error: e?.message || 'Upload failed' };
  }
}
