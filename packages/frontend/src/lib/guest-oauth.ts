import { isSpotifyClientId } from './spotify';

export const SPOTIFY_STATE_KEY = 'birthday-songs.spotify-oauth-state';

// Only resume guest setup during the short-lived Spotify callback, not on reload.
export function guestCallbackClientId(): string {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('code') && !params.has('error')) return '';
  let stored: string | null;
  try {
    stored = sessionStorage.getItem(SPOTIFY_STATE_KEY);
  } catch {
    return '';
  }
  if (!stored) return '';
  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    return '';
  }
  if (typeof value !== 'object' || value === null ||
    !('guest' in value) || value.guest !== true ||
    !('clientId' in value) || typeof value.clientId !== 'string' ||
    !isSpotifyClientId(value.clientId) ||
    !('state' in value) || value.state !== params.get('state') ||
    !('expiresAt' in value) || typeof value.expiresAt !== 'number' ||
    value.expiresAt < Date.now()) return '';
  return value.clientId;
}
