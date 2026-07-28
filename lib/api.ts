import axios from "axios";
import { createClient } from "@/lib/supabase/client";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api",
  timeout: 15_000,
});

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await createClient().auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});
