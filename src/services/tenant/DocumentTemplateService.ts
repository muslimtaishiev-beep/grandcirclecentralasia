import { collection, doc, getDocs, setDoc, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { DocumentTemplate } from '../../types/engine';

export class DocumentTemplateService {
  private static COLLECTION = 'document_templates';

  public static async getTemplates(tenantId: string): Promise<DocumentTemplate[]> {
    try {
      // Fetch GLOBAL templates
      const globalQuery = query(collection(db, this.COLLECTION), where('tenantId', '==', 'GLOBAL'));
      const globalSnap = await getDocs(globalQuery);
      const globals = globalSnap.docs.map(d => d.data() as DocumentTemplate);

      // Fetch TENANT templates
      const tenantQuery = query(collection(db, this.COLLECTION), where('tenantId', '==', tenantId));
      const tenantSnap = await getDocs(tenantQuery);
      const locals = tenantSnap.docs.map(d => d.data() as DocumentTemplate);

      return [...globals, ...locals];
    } catch (e) {
      console.error('Error fetching document templates:', e);
      return [];
    }
  }

  public static async saveTemplate(template: DocumentTemplate): Promise<void> {
    try {
      if (!template.id) {
        template.id = doc(collection(db, this.COLLECTION)).id;
        template.createdAt = Date.now();
      }
      template.updatedAt = Date.now();
      await setDoc(doc(db, this.COLLECTION, template.id), template);
    } catch (e) {
      console.error('Error saving document template:', e);
      throw e;
    }
  }

  public static async deleteTemplate(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.COLLECTION, id));
    } catch (e) {
      console.error('Error deleting document template:', e);
      throw e;
    }
  }
}
