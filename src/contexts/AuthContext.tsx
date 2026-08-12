import React, { createContext, useContext, useState } from 'react';

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
  user: any | null;
  userData: UserData | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: false,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user] = useState<any | null>(null);
  const [userData] = useState<UserData | null>(null);
  const [loading] = useState(false);

  const logout = async () => {};

  return (
    <AuthContext.Provider value={{ user, userData, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
