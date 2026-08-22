import { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface DocumentMeta {
  id: string;
  tenantId: string;
  title: string;
  updatedAt: any;
  createdAt: any;
}

export function useDocumentList(tenantId: string | undefined) {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'documents'), where('tenantId', '==', tenantId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: DocumentMeta[] = [];
      snapshot.forEach(d => docs.push({ id: d.id, ...d.data() } as DocumentMeta));
      // sort client side
      docs.sort((a, b) => {
        const t1 = a.updatedAt?.toMillis() || 0;
        const t2 = b.updatedAt?.toMillis() || 0;
        return t2 - t1;
      });
      setDocuments(docs);
      setLoading(false);
    }, (err) => {
      setDocuments([]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tenantId]);

  return { documents, loading };
}

// Convert Uint8Array to Base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert Base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

export function useCollaboration(documentId: string, currentUser: { id: string, name: string, color: string }) {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebrtcProvider | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!documentId) return;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Load initial state from Firestore
    const docRef = doc(db, 'documents', documentId);
    
    getDoc(docRef).then(snapshot => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.ydocState) {
          const update = base64ToUint8Array(data.ydocState);
          Y.applyUpdate(ydoc, update);
        }
      }
      setReady(true);
      
      // Initialize WebRTC Provider for real-time p2p syncing and cursors
      // The room name must be unique per document
      providerRef.current = new WebrtcProvider(`grandcircle-doc-${documentId}`, ydoc, {
        signaling: ['wss://signaling.yjs.dev', 'wss://y-webrtc-signaling-eu.herokuapp.com'] // Public signaling servers for MVP
      });

      // Set user awareness for cursors
      providerRef.current.awareness.setLocalStateField('user', {
        name: currentUser.name,
        color: currentUser.color,
      });

      // Debounced save to Firestore
      let timeoutId: any = null;
      ydoc.on('update', () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          const state = Y.encodeStateAsUpdate(ydoc);
          const base64State = uint8ArrayToBase64(state);
          updateDoc(docRef, { 
            ydocState: base64State,
            updatedAt: serverTimestamp()
          }).catch(console.error);
        }, 2000); // Save 2 seconds after last edit
      });

    }).catch(console.error);

    return () => {
      if (providerRef.current) providerRef.current.destroy();
      if (ydocRef.current) ydocRef.current.destroy();
    };
  }, [documentId]);

  return { ydoc: ydocRef.current, provider: providerRef.current, ready };
}
