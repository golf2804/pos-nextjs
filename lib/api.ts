import axios from "axios";
import { createClient } from "@/lib/supabase/client";

const MANAGED_ACCESS_TOKEN_KEY = "pos.access_token";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api",
  timeout: 15_000,
});

function getStoredAccessToken() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(MANAGED_ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setManagedAccessToken(token: string) {
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MANAGED_ACCESS_TOKEN_KEY, token);
  } catch {
    // Storage can be unavailable in hardened browser modes; the in-memory header still covers this page load.
  }
}

export function clearManagedAccessToken() {
  delete api.defaults.headers.common.Authorization;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(MANAGED_ACCESS_TOKEN_KEY);
  } catch {
    // Ignore storage cleanup failures and rely on Supabase sign-out/cookie cleanup.
  }
}

async function getSessionWithTimeout() {
  return Promise.race([
    createClient().auth.getSession(),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error("Supabase session lookup timed out."));
      }, 5_000);
    }),
  ]);
}

api.interceptors.request.use(async (config) => {
  if (config.headers.Authorization) {
    return config;
  }

  const storedToken = getStoredAccessToken();
  if (storedToken) {
    config.headers.Authorization = `Bearer ${storedToken}`;
    return config;
  }

  const { data: { session } } = await getSessionWithTimeout();
  if (session?.access_token) {
    setManagedAccessToken(session.access_token);
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
      clearManagedAccessToken();
    }
    return Promise.reject(error);
  },
);
