import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/me`, {
        withCredentials: true
      });
      setUser(response.data);
    } catch (error) {
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
    setUser(response.data);
    return response.data;
  };

  const register = async ({ name, email, phone, password, confirmPassword }) => {
    const response = await axios.post(
      `${API_URL}/api/auth/register`,
      {
        name,
        email,
        phone,
        password,
        confirm_password: confirmPassword
      },
      { withCredentials: true }
    );
    return response.data;
  };

  const verifyRegistrationOtp = async ({ phone, otp }) => {
    const response = await axios.post(
      `${API_URL}/api/auth/verify-registration-otp`,
      { phone, otp },
      { withCredentials: true }
    );
    setUser(response.data.user);
    return response.data;
  };

  const logout = async () => {
    try {
      await axios.post(`${API_URL}/api/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      // Ignore logout errors on UI
    }
    setUser(false);
  };

  const value = {
    user,
    loading,
    login,
    register,
    verifyRegistrationOtp,
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
