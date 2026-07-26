const refreshTokenStorageKey = "client_lens_refresh_token";

export function readStoredRefreshToken() {
  const token = window.sessionStorage.getItem(refreshTokenStorageKey);

  return token && token.trim().length > 0 ? token : null;
}

export function storeRefreshToken(refreshToken: string) {
  window.sessionStorage.setItem(refreshTokenStorageKey, refreshToken);
}

export function clearStoredRefreshToken() {
  window.sessionStorage.removeItem(refreshTokenStorageKey);
}

export function getRefreshTokenStorageKey() {
  return refreshTokenStorageKey;
}
