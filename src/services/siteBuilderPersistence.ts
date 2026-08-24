import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TenantLandingPage } from '../types/siteBuilder';

export function calculateStateHash(page: TenantLandingPage): string {
  // Deterministic serialization: 
  // We exclude dynamic metadata like version and updatedAt for the content hash 
  // to avoid circular hash modifications.
  const hashPayload = {
    blocks: page.blocks,
    seo: page.seo,
    theme: page.theme,
    status: page.status,
  };
  const stringified = JSON.stringify(hashPayload);
  
  // Simple FNV-1a hash function for strings
  let hash = 2166136261;
  for (let i = 0; i < stringified.length; i++) {
    hash ^= stringified.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

class SitePersistenceService {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceDelay = 1500;

  public debouncedSave(
    tenantId: string,
    pageData: TenantLandingPage,
    lastSavedHash: string,
    onSuccess: (newVersion: number, newHash: string) => void,
    onError: (err: Error) => void
  ) {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    const currentHash = calculateStateHash(pageData);

    // If state hasn't fundamentally changed, skip network call
    if (currentHash === lastSavedHash) {
      return;
    }

    this.timeoutId = setTimeout(async () => {
      try {
        const pageRef = doc(db, 'landing_pages', `${tenantId}_${pageData.slug}`);
        
        // We use increment to safely bump version counter to avoid race conditions.
        // We also pass the whole document explicitly. 
        // Note: in a real world, we might use updateDoc, but since we overwrite the whole array of blocks, 
        // setDoc with merge is safer for the entire document payload.
        
        const payloadToSave = {
          ...pageData,
          version: increment(1),
          updatedAt: serverTimestamp(),
        };

        await setDoc(pageRef, payloadToSave, { merge: true });
        
        // Return simulated new version assuming it incremented successfully by 1 locally
        onSuccess(pageData.version + 1, currentHash);
      } catch (err: any) {
        onError(err);
      }
    }, this.debounceDelay);
  }
}

export const sitePersistenceService = new SitePersistenceService();
