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
      setUser(currentUser);
      setLoading(false);

      // Sync tenantIds custom claims from `memberships` so Firestore rules
      // (hasTenantAccess) can enforce real tenant isolation. /api/auth/me sets
      // the claims server-side; if they changed, force a token refresh so the
      // NEW claims take effect on this session without requiring re-login.
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          if (data?.claimsRefreshed) {
            await currentUser.getIdToken(true);
          }
        } catch (e) {
          console.warn('[AuthContext] Failed to sync tenant claims:', e);
        }
      }
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
