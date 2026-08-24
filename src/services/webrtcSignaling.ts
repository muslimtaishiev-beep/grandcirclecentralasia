import { db } from '../lib/firebase';
import { collection, doc, setDoc, addDoc, onSnapshot, query, where, orderBy, deleteDoc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { CallRoomSession, SignalingMessage, CallParticipant } from '../types/webrtc';

export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

class WebRtcSignalingService {
  async createOrJoinRoom(tenantId: string, roomId: string, participant: CallParticipant): Promise<void> {
    const roomRef = doc(db, 'tenants', tenantId, 'rooms', roomId);
    await setDoc(roomRef, {
      id: roomId,
      tenantId,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    const participantRef = doc(db, 'tenants', tenantId, 'rooms', roomId, 'participants', participant.id);
    const { stream, ...safeParticipant } = participant; // strip MediaStream for DB
    await setDoc(participantRef, {
      ...safeParticipant,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  async updateParticipantInfo(tenantId: string, roomId: string, userId: string, updates: Partial<CallParticipant>): Promise<void> {
    const participantRef = doc(db, 'tenants', tenantId, 'rooms', roomId, 'participants', userId);
    await setDoc(participantRef, { ...updates, updatedAt: serverTimestamp() }, { merge: true });
  }

  async sendSignal(tenantId: string, roomId: string, signal: Omit<SignalingMessage, 'timestamp'>): Promise<void> {
    const signalsRef = collection(db, 'tenants', tenantId, 'rooms', roomId, 'signals');
    await addDoc(signalsRef, {
      ...signal,
      timestamp: Date.now()
    });
  }

  subscribeToIncomingSignals(
    tenantId: string, 
    roomId: string, 
    currentUserId: string, 
    onSignal: (sig: SignalingMessage) => void
  ): () => void {
    const signalsRef = collection(db, 'tenants', tenantId, 'rooms', roomId, 'signals');
    const q = query(signalsRef, where('toUserId', 'in', [currentUserId, 'all']), orderBy('timestamp', 'asc'));
    
    let isInitial = true;
    
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          if (!isInitial) {
            const data = change.doc.data() as SignalingMessage;
            onSignal({ ...data, id: change.doc.id });
            deleteDoc(change.doc.ref).catch(console.error); // cleanup processed signals
          } else {
            // Delete old stale signals on join
            deleteDoc(change.doc.ref).catch(console.error);
          }
        }
      });
      isInitial = false;
    });
  }

  subscribeToParticipants(
    tenantId: string, 
    roomId: string, 
    onUpdate: (participants: CallParticipant[]) => void
  ): () => void {
    const pRef = collection(db, 'tenants', tenantId, 'rooms', roomId, 'participants');
    return onSnapshot(pRef, (snap) => {
      const list = snap.docs.map(d => d.data() as CallParticipant);
      onUpdate(list);
    });
  }

  async cleanupSignals(tenantId: string, roomId: string, currentUserId: string): Promise<void> {
    const signalsRef = collection(db, 'tenants', tenantId, 'rooms', roomId, 'signals');
    
    const qToMe = query(signalsRef, where('toUserId', '==', currentUserId));
    const snapToMe = await getDocs(qToMe);
    
    const qFromMe = query(signalsRef, where('fromUserId', '==', currentUserId));
    const snapFromMe = await getDocs(qFromMe);

    const batch = writeBatch(db);
    snapToMe.docs.forEach(d => batch.delete(d.ref));
    snapFromMe.docs.forEach(d => batch.delete(d.ref));
    
    const pRef = doc(db, 'tenants', tenantId, 'rooms', roomId, 'participants', currentUserId);
    batch.delete(pRef);

    await batch.commit().catch(console.error);
  }
}

export const webRtcSignalingService = new WebRtcSignalingService();
