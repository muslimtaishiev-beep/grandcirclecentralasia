import { db } from '../../lib/firebase';
import { collection, doc, query, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { WorkspaceDocument, DocBlock, DocAccessLevel, UserDocRole } from '../../types/collab';
import { generateShortId } from '../../lib/utils';

class DocumentService {
  subscribeToList(
    tenantId: string, 
    staffId: string, 
    isFullAdmin: boolean, 
    onUpdate: (docs: WorkspaceDocument[]) => void
  ) {
    const q = query(collection(db, 'tenants', tenantId, 'workspace_documents'));
    return onSnapshot(q, (snap) => {
      const allDocs = snap.docs.map(d => ({ ...d.data(), id: d.id } as WorkspaceDocument));
      
      const filtered = allDocs.filter(d => {
        // Admins or Document Author always see the document
        if (isFullAdmin || d.authorStaffId === staffId) return true;

        const level = d.accessLevel || 'company_edit';

        if (level === 'private') return false; // Private docs hidden from everyone else
        if (level === 'company_view' || level === 'company_edit') return true; // Visible to company

        if (level === 'specific_users') {
          return d.permissionsMap && Boolean(d.permissionsMap[staffId]);
        }

        return true;
      });

      onUpdate(filtered);
    }, (err) => {
      console.warn("Docs list notice:", err);
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

  async createDocument(tenantId: string, authorStaffId: string, authorName: string = 'Сотрудник', title: string = 'Новый документ') {
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
      authorName,
      lastEditedByStaffId: authorStaffId,
      blocks: initialBlocks,
      isLocked: false,
      accessLevel: 'private', // New documents default to private for the author!
      permissionsMap: { [authorStaffId]: 'editor' },
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

  async updateAccessControl(
    tenantId: string, 
    docId: string, 
    accessLevel: DocAccessLevel, 
    permissionsMap: Record<string, UserDocRole>,
    staffId: string
  ) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_documents', docId);
    await updateDoc(ref, {
      accessLevel,
      permissionsMap,
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
