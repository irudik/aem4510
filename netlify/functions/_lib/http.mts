/**
 * HTTP helpers for Netlify Functions.
 */

/**
 * @param {number} status
 * @param {unknown} payload
 */
export function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * @param {Request} req
 */
export async function readJsonBody(req) {
  try {
    return await req.json();
  } catch {
    throw new Error("Request body must be valid JSON");
  }
}

/**
 * @param {Request} req
 */
export function getBearerToken(req) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token.trim();
}
