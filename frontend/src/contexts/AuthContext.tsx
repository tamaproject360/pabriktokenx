import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { setAuthKey, getAuthKey, clearAuthKey } from '../lib/api';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (key: string) => void;
  logout: () => void;
  managementKey: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [managementKey, setManagementKey] = useState(getAuthKey());
  const isAuthenticated = Boolean(managementKey);

  const login = useCallback((key: string) => {
    setAuthKey(key);
    setManagementKey(key);
  }, []);

  const logout = useCallback(() => {
    clearAuthKey();
    setManagementKey('');
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, managementKey }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
