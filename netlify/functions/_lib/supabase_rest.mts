/**
 * Supabase REST helpers for Netlify Functions.
 */

/**
 * @param {string} keyName
 */
export function requiredEnv(keyName) {
  const envValue = Netlify.env.get(keyName);
  if (!envValue) {
    throw new Error(`Missing environment variable: ${keyName}`);
  }
  return envValue;
}

/**
 * @param {Record<string, string | number | boolean | null | undefined>} queryParams
 */
function toQueryString(queryParams) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(queryParams)) {
    if (value === null || value === undefined) {
      continue;
    }
    params.set(key, String(value));
  }

  const raw = params.toString();
  return raw ? `?${raw}` : "";
}

/**
 * @param {string} path
 * @param {{
 * method?: string,
 * queryParams?: Record<string, string | number | boolean | null | undefined>,
 * body?: unknown,
 * prefer?: string,
 * useServiceRole?: boolean,
 * authToken?: string | null
 * }} options
 */
export async function supabaseRequest(path, options = {}) {
  const {
    method = "GET",
    queryParams = {},
    body,
    prefer,
    useServiceRole = true,
    authToken = null,
  } = options;

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const apiKey = useServiceRole
    ? requiredEnv("SUPABASE_SERVICE_ROLE_KEY")
    : requiredEnv("SUPABASE_ANON_KEY");

  const requestUrl = `${supabaseUrl}${path}${toQueryString(queryParams)}`;

  const headers = {
    apikey: apiKey,
    Authorization: authToken ? `Bearer ${authToken}` : `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (prefer) {
    headers.Prefer = prefer;
  }

  const response = await fetch(requestUrl, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase request failed (${response.status}) ${path}: ${errorText}`);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  return JSON.parse(text);
}

/**
 * Validate a Supabase access token and return the auth user object.
 * @param {string} accessToken
 */
export async function fetchSupabaseAuthUser(accessToken) {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}
