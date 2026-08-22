import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from './firebase';

export interface CrmContact {
  id: string;
  tenantId: string;
  type: 'student' | 'teacher' | 'lead' | 'employee';
  name: string;
  email?: string;
  phone?: string;
  status: 'active' | 'archived' | 'new';
  createdAt: any;
}

export interface CrmDeal {
  id: string;
  tenantId: string;
  title: string;
  contactId: string;
  value: number;
  column: 'new' | 'contacted' | 'testing' | 'won' | 'lost';
  createdAt: any;
}

export function useCrmContacts(tenantId: string | undefined) {
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setContacts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'crm_contacts'),
      where('tenantId', '==', tenantId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: CrmContact[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as CrmContact));
      data.sort((a, b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0));
      setContacts(data);
      setLoading(false);
    }, (err) => {
      console.warn("CRM contacts notice:", err);
      setContacts([]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tenantId]);

  const addContact = async (contact: Omit<CrmContact, 'id' | 'createdAt' | 'tenantId'>) => {
    if (!tenantId) return;
    await addDoc(collection(db, 'crm_contacts'), {
      ...contact,
      tenantId,
      createdAt: serverTimestamp()
    });
  };

  const deleteContact = async (contactId: string) => {
    await deleteDoc(doc(db, 'crm_contacts', contactId));
  };

  return { contacts, loading, addContact, deleteContact };
}

export function useCrmDeals(tenantId: string | undefined) {
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setDeals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'crm_deals'),
      where('tenantId', '==', tenantId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: CrmDeal[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as CrmDeal));
      data.sort((a, b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0));
      setDeals(data);
      setLoading(false);
    }, (err) => {
      console.warn("CRM deals notice:", err);
      setDeals([]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tenantId]);

  const addDeal = async (deal: Omit<CrmDeal, 'id' | 'createdAt' | 'tenantId'>) => {
    if (!tenantId) return;
    await addDoc(collection(db, 'crm_deals'), {
      ...deal,
      tenantId,
      createdAt: serverTimestamp()
    });
  };

  const updateDealColumn = async (dealId: string, newColumn: CrmDeal['column']) => {
    const dealRef = doc(db, 'crm_deals', dealId);
    await updateDoc(dealRef, { column: newColumn });
  };

  const deleteDeal = async (dealId: string) => {
    await deleteDoc(doc(db, 'crm_deals', dealId));
  };

  return { deals, loading, addDeal, updateDealColumn, deleteDeal };
}
