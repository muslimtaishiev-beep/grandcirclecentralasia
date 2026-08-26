import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  decisionStatus: 'pending' | 'accepted' | 'rejected';
  feedback?: string;
  createdAt: any;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Sync tenantIds/tenantAdminIds custom claims from `memberships` so
      // firestore.rules (hasTenantAccess/isTenantAdmin) can enforce real tenant
      // isolation. /api/auth/me sets the claims server-side; if they changed, force
      // a token refresh so the NEW claims are active BEFORE we let the rest of the
      // app start querying Firestore — otherwise workspace pages (Dashboard,
      // ManagerDashboard, etc.) fire their onSnapshot/getDocs calls immediately on
      // mount using the still-stale cached token and get permission-denied on a
      // freshly granted membership, even though the claims exist moments later.
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          // Bounded wait: if /api/auth/me hangs (cold start, slow Firestore scan),
          // we must still unblock the app below with whatever claims the cached
          // token already has, rather than leaving the whole workspace stuck on
          // "Loading Workspace..." forever — that would be worse than the stale-
          // claims race this sync is fixing.
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(8000),
          });
          const data = await res.json();
          if (data?.claimsRefreshed) {
            await currentUser.getIdToken(true);
          }
        } catch (e) {
          console.warn('[AuthContext] Failed to sync tenant claims (continuing with cached token):', e);
        }
      }

      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {}
    setUser(null);
    setUserData(null);
    localStorage.clear();
    sessionStorage.clear();
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
