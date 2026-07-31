import axios from "axios";
import { createClient } from "@/lib/supabase/client";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api",
  timeout: 15_000,
});

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

  const { data: { session } } = await getSessionWithTimeout();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});
