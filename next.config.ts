import type { NextConfig } from "next";

const supabaseHost = getSupabaseImageHost(process.env.NEXT_PUBLIC_SUPABASE_URL);

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: supabaseHost },
    ],
  },
};

function getSupabaseImageHost(value: string | undefined) {
  if (!value?.trim()) return "*.supabase.co";
  try {
    return new URL(value.trim()).hostname;
  } catch {
    return "*.supabase.co";
  }
}

export default nextConfig;
