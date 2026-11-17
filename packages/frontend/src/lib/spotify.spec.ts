import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createSpotifyPlaylist,
  getSpotifyRedirectUri,
  searchSpotifyTracks,
} from './spotify';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Spotify API helpers', () => {
  it('uses a Spotify-compatible loopback redirect for local preview', () => {
    expect(getSpotifyRedirectUri('http://localhost:5173')).toBe(
      'http://[::1]:5173',
    );
    expect(getSpotifyRedirectUri('https://birthday.example')).toBe(
      'https://birthday.example',
    );
  });

  it('returns a bounded track shape from Spotify search results', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        tracks: {
          items: [
            {
              id: 'track-id',
              uri: 'spotify:track:trackid',
              name: 'Birthday',
              artists: [{ name: 'The Artist' }],
              preview_url: 'https://p.scdn.co/mp3-preview/sample',
              album: {
                name: 'Party Songs',
                images: [{ url: 'https://i.scdn.co/image/cover' }],
              },
            },
            {
              id: 'track-without-preview',
              uri: 'spotify:track:anothertrack',
              name: 'No Preview',
              artists: [{ name: 'The Artist' }],
              preview_url: 'http://example.com/audio',
            },
            { id: 'invalid-track', name: 'No URI' },
          ],
        },
      }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await expect(searchSpotifyTracks('user-token', 'birthday song')).resolves.toEqual([
      {
        id: 'track-id',
        uri: 'spotify:track:trackid',
        title: 'Birthday',
        artist: 'The Artist',
        album: 'Party Songs',
        coverUrl: 'https://i.scdn.co/image/cover',
        previewUrl: 'https://p.scdn.co/mp3-preview/sample',
      },
      {
        id: 'track-without-preview',
        uri: 'spotify:track:anothertrack',
        title: 'No Preview',
        artist: 'The Artist',
        album: '',
        coverUrl: '',
        previewUrl: '',
      },
    ]);

    const url = new URL(String(vi.mocked(fetch).mock.calls[0]?.[0]));
    expect(url.searchParams.get('q')).toBe('birthday song');
    expect(url.searchParams.get('limit')).toBe('10');
  });

  it('creates a private playlist and adds tracks through the current endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'playlistid',
          external_urls: {
            spotify: 'https://open.spotify.com/playlist/playlistid',
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ snapshot_id: 'snapshot' }),
      } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createSpotifyPlaylist('user-token', 'Birthday mix', [
        'spotify:track:trackid',
      ]),
    ).resolves.toBe('https://open.spotify.com/playlist/playlistid');

    const createBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const addBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(createBody).toMatchObject({ name: 'Birthday mix', public: false });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      '/playlists/playlistid/items',
    );
    expect(addBody).toEqual({ uris: ['spotify:track:trackid'] });
  });
});
