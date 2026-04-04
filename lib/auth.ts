export const AUTH_COOKIE_NAME = "st_session";

export function authSecret() {
  return process.env.AUTH_SECRET?.trim() ?? "";
}

export function authUsername() {
  return process.env.AUTH_USERNAME?.trim() ?? "";
}

export function authPassword() {
  return process.env.AUTH_PASSWORD?.trim() ?? "";
}

export function authConfigured() {
  return Boolean(authSecret() && authUsername() && authPassword());
}

export function isValidLogin(username: string, password: string) {
  return username === authUsername() && password === authPassword();
}

export function sessionValue() {
  return authSecret();
}

export function isAuthenticatedCookie(value: string | undefined) {
  return Boolean(value && value === authSecret());
}
