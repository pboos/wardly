// --- Session cookie ---
export const SESSION_COOKIE_NAME = "wardly_session";

// --- JWT claim keys (namespaced under "wardly/") ---
export const CLAIM_NAMESPACE = "wardly";
export const CLAIM_USER_ID = `${CLAIM_NAMESPACE}/user_id`;
export const CLAIM_EMAIL = `${CLAIM_NAMESPACE}/email`;
export const CLAIM_NAME = `${CLAIM_NAMESPACE}/name`;
export const CLAIM_WARD_ID = `${CLAIM_NAMESPACE}/ward_id`;

// --- Login row (magic link / code) lifetime ---
export const LOGIN_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_LOGIN_ATTEMPTS = 3;

// --- JWT session lifetime + refresh window ---
export const JWT_LIFETIME = "4h"; // jose setExpirationTime string
export const JWT_REFRESH_THRESHOLD_MS = 1 * 60 * 60 * 1000; // refresh if <1h left
export const SESSION_COOKIE_MAX_AGE_S = 4 * 60 * 60; // 4h, matches JWT_LIFETIME
