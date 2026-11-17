export const SPOTIFY_CLIENT_ID = '5bd1fe97ba74476897bf9fe0c32b67d6';

const API_BASE = 'https://api.spotify.com/v1';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const REQUEST_TIMEOUT_MS = 10_000;

export interface SpotifyTrack {
  id: string;
  uri: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  previewUrl: string;
}

interface AuthorizationRequest {
  url: string;
  state: string;
  codeVerifier: string;
}

export class SpotifyApiError extends Error {
  constructor(
    message: string,
    override readonly name = 'SpotifyApiError',
    readonly playlistUrl = '',
  ) {
    super(message);
  }
}

export function getSpotifyRedirectUri(origin: string): string {
  const redirect = new URL(origin);
  if (redirect.protocol === 'http:' && redirect.hostname === 'localhost') {
    redirect.hostname = '[::1]';
  }
  return redirect.origin;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function randomString(length: number): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join(
    '',
  );
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/=/gu, '')
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_');
}

export async function createSpotifyAuthorization(
  redirectUri: string,
): Promise<AuthorizationRequest> {
  const state = randomString(64);
  const codeVerifier = randomString(64);
  const challenge = await codeChallenge(codeVerifier);
  const url = new URL('https://accounts.spotify.com/authorize');
  url.search = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'playlist-modify-private',
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  }).toString();
  return { url: url.toString(), state, codeVerifier };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new SpotifyApiError(
      'Spotify returned an unreadable response. Please try again.',
    );
  }
  if (!isRecord(payload)) {
    throw new SpotifyApiError(
      'Spotify returned an unexpected response. Please try again.',
    );
  }
  return payload;
}

function requestFailure(status: number): SpotifyApiError {
  if (status === 401) {
    return new SpotifyApiError(
      'Your Spotify connection expired. Connect Spotify again and retry.',
      'SpotifyAuthExpiredError',
    );
  }
  if (status === 403) {
    return new SpotifyApiError(
      'Spotify did not grant permission to create a private playlist. Connect again and allow the requested access.',
    );
  }
  if (status === 429) {
    return new SpotifyApiError(
      'Spotify is receiving too many requests. Please try again shortly.',
    );
  }
  return new SpotifyApiError(
    'Spotify could not complete that request. Please try again.',
  );
}

export async function exchangeSpotifyCode(
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw networkFailure(error);
  }
  if (!response.ok) {
    throw new SpotifyApiError(
      response.status === 400 || response.status === 401
        ? 'Spotify could not verify the sign-in. Please connect again.'
        : requestFailure(response.status).message,
    );
  }

  const payload = await readJson(response);
  if (typeof payload.access_token !== 'string' || !payload.access_token) {
    throw new SpotifyApiError(
      'Spotify did not return an access token. Please connect again.',
    );
  }
  return payload.access_token;
}

function networkFailure(error: unknown): SpotifyApiError {
  if (error instanceof Error && error.name === 'TimeoutError') {
    return new SpotifyApiError(
      'Spotify took too long to respond. Please try again.',
    );
  }
  return new SpotifyApiError(
    'Spotify could not be reached. Check your connection and try again.',
  );
}

export function spotifyErrorMessage(error: unknown, fallback?: string): string {
  return error instanceof SpotifyApiError
    ? error.message
    : fallback || 'Spotify could not complete that request. Please try again.';
}

function mapTrack(value: unknown): SpotifyTrack | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.uri !== 'string' ||
    !/^spotify:track:[A-Za-z0-9]{1,128}$/u.test(value.uri)
  ) {
    return null;
  }

  const artistNames = Array.isArray(value.artists)
    ? value.artists
        .flatMap((artist) =>
          isRecord(artist) && typeof artist.name === 'string'
            ? [artist.name]
            : [],
        )
        .join(', ')
        .slice(0, 240)
    : '';
  const album = isRecord(value.album) ? value.album : null;
  const albumName =
    album && typeof album.name === 'string' ? album.name.slice(0, 200) : '';
  const images = album && Array.isArray(album.images) ? album.images : [];
  const coverUrl =
    images.length > 0 &&
    isRecord(images[0]) &&
    typeof images[0].url === 'string' &&
    images[0].url.startsWith('https://')
      ? images[0].url.slice(0, 500)
      : '';
  const previewUrl =
    typeof value.preview_url === 'string' &&
    value.preview_url.startsWith('https://')
      ? value.preview_url.slice(0, 2000)
      : '';

  return {
    id: value.id.slice(0, 128),
    uri: value.uri,
    title: value.name.slice(0, 200),
    artist: artistNames || 'Unknown artist',
    album: albumName,
    coverUrl,
    previewUrl,
  };
}

export async function searchSpotifyTracks(
  accessToken: string,
  query: string,
): Promise<SpotifyTrack[]> {
  const term = query.trim();
  if (term.length < 2 || term.length > 100) {
    throw new SpotifyApiError('Enter between 2 and 100 characters to search.');
  }

  const url = new URL(`${API_BASE}/search`);
  url.search = new URLSearchParams({
    q: term,
    type: 'track',
    limit: '10',
  }).toString();
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw networkFailure(error);
  }
  if (!response.ok) throw requestFailure(response.status);

  const payload = await readJson(response);
  const tracks = isRecord(payload.tracks) ? payload.tracks : null;
  const items = tracks && Array.isArray(tracks.items) ? tracks.items : [];
  return items.flatMap((item) => {
    const track = mapTrack(item);
    return track ? [track] : [];
  });
}

export async function createSpotifyPlaylist(
  accessToken: string,
  title: string,
  trackUris: string[],
): Promise<string> {
  const playlistTitle = title.trim();
  if (
    playlistTitle.length < 1 ||
    playlistTitle.length > 100 ||
    trackUris.length < 1 ||
    trackUris.length > 100 ||
    trackUris.some(
      (uri) => !/^spotify:track:[A-Za-z0-9]{1,128}$/u.test(uri),
    )
  ) {
    throw new SpotifyApiError(
      'A playlist needs a name and between 1 and 100 valid Spotify songs.',
    );
  }

  let playlistResponse: Response;
  try {
    playlistResponse = await fetch(`${API_BASE}/me/playlists`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: playlistTitle,
        description: 'Made with Birthday Songs.',
        public: false,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw networkFailure(error);
  }
  if (!playlistResponse.ok) throw requestFailure(playlistResponse.status);

  const playlist = await readJson(playlistResponse);
  const id =
    typeof playlist.id === 'string' &&
    /^[A-Za-z0-9]{1,128}$/u.test(playlist.id)
      ? playlist.id
      : '';
  if (!id) {
    throw new SpotifyApiError(
      'Spotify returned an unexpected playlist response.',
    );
  }
  const externalUrls = isRecord(playlist.external_urls)
    ? playlist.external_urls
    : null;
  const playlistUrl =
    externalUrls &&
    typeof externalUrls.spotify === 'string' &&
    externalUrls.spotify.startsWith('https://open.spotify.com/')
      ? externalUrls.spotify.slice(0, 500)
      : `https://open.spotify.com/playlist/${id}`;

  let itemsResponse: Response;
  try {
    itemsResponse = await fetch(
      `${API_BASE}/playlists/${encodeURIComponent(id)}/items`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: trackUris }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
  } catch {
    throw new SpotifyApiError(
      'Spotify created your playlist, but could not add its songs. Open Spotify to review it.',
      'SpotifyItemsNotAddedError',
      playlistUrl,
    );
  }
  if (!itemsResponse.ok) {
    throw new SpotifyApiError(
      'Spotify created your playlist, but could not add its songs. Open Spotify to review it.',
      'SpotifyItemsNotAddedError',
      playlistUrl,
    );
  }
  return playlistUrl;
}
