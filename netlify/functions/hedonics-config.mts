import { jsonResponse } from "./_lib/http.mts";
import { requiredEnv } from "./_lib/supabase_rest.mts";

export default async function hedonicsConfig(req) {
  if (req.method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  return jsonResponse(200, {
    supabase_url: requiredEnv("SUPABASE_URL"),
    supabase_anon_key: requiredEnv("SUPABASE_ANON_KEY"),
  });
}

export const config = {
  path: "/api/hedonics/config",
};
