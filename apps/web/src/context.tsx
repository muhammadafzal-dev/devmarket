import { createContext, useContext } from "react";
import { User } from "./api";
export const Auth = createContext<{
  user: User | null;
  refresh: () => Promise<void>;
  mode: string;
}>({ user: null, refresh: async () => {}, mode: "unknown" });
export const useAuth = () => useContext(Auth);
