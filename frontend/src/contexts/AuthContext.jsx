import { createContext, useContext, useMemo, useState } from 'react';
import {
  api,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from '../services/api.js';

const USER_KEY = 'lead_capture_user';

const AuthContext = createContext(null);

function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [user, setUser] = useState(() => getStoredUser());

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });

    setStoredToken(data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);

    return data;
  }

  function logout() {
    clearStoredToken();
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      token,
      user,
      login,
      logout,
      isAuthenticated: Boolean(token),
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
