import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";

export type UserRole = "L0" | "L1" | "L2" | "L9";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  assignedAC?: number | null;
  aciName?: string | null;
}

interface LoginResult {
  success: boolean;
  message?: string;
}

interface AuthContextType {
  user: User | null;
  login: (identifier: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "kuralapp.auth.user";
// Use relative path in development (for Vite proxy) or absolute URL from env
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "/api" : "http://localhost:4000/api");

const normalizeUser = (rawUser: User | null): User | null => {
  if (!rawUser) {
    return null;
  }

  const assignedAC =
    typeof rawUser.assignedAC === "number"
      ? rawUser.assignedAC
      : rawUser.assignedAC !== undefined && rawUser.assignedAC !== null
        ? Number(rawUser.assignedAC)
        : null;

  const normalizedAssignedAC =
    assignedAC !== null && Number.isFinite(assignedAC) ? assignedAC : null;

  return {
    ...rawUser,
    assignedAC: normalizedAssignedAC,
    aciName: rawUser.aciName ?? null,
  };
};

const readStoredUser = (): User | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    return normalizeUser(JSON.parse(stored) as User);
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => readStoredUser());
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        // First, try to restore from localStorage if available
        if (typeof window !== "undefined") {
          const storedUser = window.localStorage.getItem(AUTH_STORAGE_KEY);
          if (storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              setUser(normalizeUser(parsedUser));
              // Still verify with server, but don't clear on failure immediately
              setIsCheckingSession(false);
            } catch (e) {
              console.error("Failed to parse stored user:", e);
            }
          }
        }

        // Verify session with server
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          method: "GET",
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setUser(normalizeUser(data.user));
        } else if (response.status === 401) {
          // Session expired or invalid - clear user
          setUser(null);
        }
        // If other error, keep existing user from localStorage if available
      } catch (error) {
        console.error("Session check failed:", error);
        // On network error, keep user from localStorage if available
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (user) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      return;
    }

    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_STORAGE_KEY) {
        return;
      }

      if (event.newValue) {
        try {
          setUser(JSON.parse(event.newValue) as User);
          return;
        } catch {
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }

      setUser(null);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const login = async (identifier: string, password: string): Promise<LoginResult> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier, password }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const message = errorBody?.message || "Invalid credentials. Please try again.";
        return { success: false, message };
      }

      const data = await response.json();
      const authenticatedUser = normalizeUser(data.user as User);
      setUser(authenticatedUser);
      return { success: true };
    } catch (error) {
      console.error("Login request failed", error);
      return {
        success: false,
        message: "Unable to reach the server. Please try again later.",
      };
    }
  };

  const logout = () => {
    // Call logout API to destroy session
    fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(console.error);
    
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      isAuthenticated: Boolean(user),
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
