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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
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
