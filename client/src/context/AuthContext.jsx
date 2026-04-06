import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("ds_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Verify token is still valid on mount
  useEffect(() => {
    const verify = async () => {
      const token = localStorage.getItem("ds_token");
      if (!token) { setLoading(false); return; }
      try {
        const { data } = await api.get("/auth/me");
        setUser(data.user);
        localStorage.setItem("ds_user", JSON.stringify(data.user));
      } catch {
        localStorage.removeItem("ds_token");
        localStorage.removeItem("ds_user");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("ds_token", data.token);
    localStorage.setItem("ds_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("ds_token");
    localStorage.removeItem("ds_user");
    setUser(null);
    toast.success("Logged out");
  }, []);

  const hasRole = useCallback((...roles) => {
    return roles.includes(user?.role);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
