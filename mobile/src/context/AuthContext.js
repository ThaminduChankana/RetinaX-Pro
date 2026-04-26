import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('retinax_user').then(raw => {
      if (raw) setUser(JSON.parse(raw));
      setLoading(false);
    });
  }, []);

  async function login(userData) {
    await AsyncStorage.setItem('retinax_user', JSON.stringify(userData));
    setUser(userData);
  }

  async function logout() {
    await AsyncStorage.removeItem('retinax_user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
