import { db } from '../../lib/firebase';
import { collection, doc, query, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { WorkspaceDocument, DocBlock } from '../../types/collab';
import { generateShortId } from '../../lib/utils';

class DocumentService {
  subscribeToList(tenantId: string, onUpdate: (docs: WorkspaceDocument[]) => void) {
    const q = query(collection(db, 'tenants', tenantId, 'workspace_documents'));
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as WorkspaceDocument)));
    });
  }

  subscribeToDocument(tenantId: string, docId: string, onUpdate: (doc: WorkspaceDocument | null) => void) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_documents', docId);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        onUpdate({ ...snap.data(), id: snap.id } as WorkspaceDocument);
      } else {
        onUpdate(null);
      }
    });
  }

  async createDocument(tenantId: string, authorStaffId: string, title: string = 'Новый документ') {
    const ref = doc(collection(db, 'tenants', tenantId, 'workspace_documents'));
    const initialBlocks: DocBlock[] = [
      { id: generateShortId(), type: 'heading_1', content: title },
      { id: generateShortId(), type: 'paragraph', content: '' }
    ];

    const newDoc: WorkspaceDocument = {
      id: ref.id,
      tenantId,
      title,
      authorStaffId,
      lastEditedByStaffId: authorStaffId,
      blocks: initialBlocks,
      isLocked: false,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await setDoc(ref, newDoc);
    return ref.id;
  }

  async updateBlocks(tenantId: string, docId: string, blocks: DocBlock[], staffId: string) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_documents', docId);
    await updateDoc(ref, {
      blocks,
      lastEditedByStaffId: staffId,
      updatedAt: Date.now()
    });
  }

  async updateTitle(tenantId: string, docId: string, title: string, staffId: string) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_documents', docId);
    await updateDoc(ref, {
      title,
      lastEditedByStaffId: staffId,
      updatedAt: Date.now()
    });
  }

  async deleteDocument(tenantId: string, docId: string) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_documents', docId);
    await deleteDoc(ref);
  }
}

export const documentService = new DocumentService();
