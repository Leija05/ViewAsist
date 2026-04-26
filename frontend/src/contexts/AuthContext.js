import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';

const AuthContext = createContext(null);
const ACCESS_TOKEN_KEY = 'viewasist_access_token';

const getStoredToken = () => localStorage.getItem(ACCESS_TOKEN_KEY) || '';
const setStoredToken = (token) => {
  if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
  else localStorage.removeItem(ACCESS_TOKEN_KEY);
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // null = checking, false = not auth, object = auth
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const token = getStoredToken();
      const response = await axios.get(`${API_URL}/api/auth/me`, {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setUser(response.data);
    } catch (error) {
      if (error?.response?.status === 401) {
        setStoredToken('');
      }
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password, rememberMe = true) => {
    const response = await axios.post(
      `${API_URL}/api/auth/login`,
      { email, password, remember_me: rememberMe },
      { withCredentials: true }
    );
    const accessToken = response.data?.access_token || '';
    setStoredToken(accessToken);
    setUser({
      id: response.data.id,
      email: response.data.email,
      name: response.data.name,
      role: response.data.role
    });
    return response.data;
  };

  const logout = async () => {
    try {
      const token = getStoredToken();
      await axios.post(`${API_URL}/api/auth/logout`, {}, {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
    } catch (error) {
      // Ignore error
    }
    setStoredToken('');
    setUser(false);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user && user !== false,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
