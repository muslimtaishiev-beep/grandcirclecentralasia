import { writeBatch, Firestore, DocumentReference } from 'firebase/firestore';

export interface BatchItem<T> {
  ref: DocumentReference;
  data: T;
  type: 'set' | 'update' | 'delete';
}

/**
 * Utility to execute bulk Firestore writes safely in chunked batches of 500.
 */
export async function executeChunkedBatch<T>(
  db: Firestore,
  items: BatchItem<T>[],
  chunkSize: number = 450
): Promise<number> {
  if (!items || items.length === 0) return 0;

  let totalProcessed = 0;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    chunk.forEach(item => {
      if (item.type === 'set') {
        batch.set(item.ref, item.data as any);
      } else if (item.type === 'update') {
        batch.update(item.ref, item.data as any);
      } else if (item.type === 'delete') {
        batch.delete(item.ref);
      }
    });

    await batch.commit();
    totalProcessed += chunk.length;
  }

  return totalProcessed;
}
