import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import axios from "axios";

const AuthContext = createContext(null);

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = Boolean(user);

  // Restore login after page refresh
  useEffect(() => {
    const token = localStorage.getItem("safeops_token");
    const storedUser = localStorage.getItem("safeops_user");

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Invalid stored user", error);

        localStorage.removeItem("safeops_token");
        localStorage.removeItem("safeops_user");
      }
    } else if (import.meta.env.DEV) {
      // =========================================================
      // DEV-ONLY AUTH BYPASS (Will not execute in production builds)
      // =========================================================
      const devUser = {
        id: "dev-user-001",
        name: "SafeOps Demo User",
        email: "dev@safeops.internal",
        phone: "+919999999999",
        role: "USER",
      };

      setUser(devUser);
      localStorage.setItem("safeops_token", "dev_bypass_mock_token");
      localStorage.setItem("safeops_user", JSON.stringify(devUser));
    }

    setLoading(false);
  }, []);

  // =========================
  // LOGIN
  // =========================
  const login = async (email, password) => {
    const response = await axios.post(
      `${API_URL}/auth/login`,
      {
        email,
        password,
      },
      {
        withCredentials: true,
      }
    );

    const data = response.data;

    if (!data.success || !data.token) {
      throw new Error(
        data.message || "Login failed"
      );
    }

    localStorage.setItem(
      "safeops_token",
      data.token
    );

    localStorage.setItem(
      "safeops_user",
      JSON.stringify(data.user)
    );

    setUser(data.user);

    return data;
  };

  // =========================
  // REGISTER
  // =========================
  const register = async ({
    name,
    email,
    phone,
    password,
  }) => {
    const response = await axios.post(
      `${API_URL}/auth/register`,
      {
        name,
        email,
        phone,
        password,
      },
      {
        withCredentials: true,
      }
    );

    const data = response.data;

    if (!data.success || !data.token) {
      throw new Error(
        data.message || "Registration failed"
      );
    }

    localStorage.setItem(
      "safeops_token",
      data.token
    );

    localStorage.setItem(
      "safeops_user",
      JSON.stringify(data.user)
    );

    setUser(data.user);

    return data;
  };

  // =========================
  // LOGOUT
  // =========================
  const logout = () => {
    localStorage.removeItem("safeops_token");
    localStorage.removeItem("safeops_user");

    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}