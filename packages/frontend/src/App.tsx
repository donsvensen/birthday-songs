import {
  CircleAlert,
  CircleCheck,
  Disc3,
  ExternalLink,
  ListMusic,
  LoaderCircle,
  Moon,
  Music2,
  Play,
  Plus,
  Search,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { useTheme } from './hooks/theme.context';
import { SpotifySetup } from './SpotifySetup';
import { SPOTIFY_STATE_KEY } from './lib/guest-oauth';
import { getRayfinClient, type AppClient } from './lib/rayfin-client';
import {
  createSpotifyAuthorization,
  createSpotifyPlaylist,
  exchangeSpotifyCode,
  getSpotifyRedirectUri,
  spotifyErrorMessage,
  searchSpotifyTracks,
  type SpotifyTrack,
} from './lib/spotify';

interface Playlist {
  id: string;
  title: string;
}

interface PlaylistSong {
  id: string;
  playlist_id: string;
  spotifyUri: string;
  title: string;
  artist: string;
  album: string;
  coverUrl?: string | null;
  addedAt: Date | string;
}

interface SpotifyOAuthState {
  state: string;
  codeVerifier: string;
  expiresAt: number;
  clientId: string;
  ownerId: string;
  guest?: boolean;
}

const STATE_KEY = SPOTIFY_STATE_KEY;

function ownerId(client: AppClient): string {
  const session = client.auth.getSession();
  if (!session.isAuthenticated || !session.user) {
    throw new Error('Sign in again to manage your birthday playlist.');
  }
  return session.user.id;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function PlaylistBuilder({ clientId, openSetup, guest = false }: {
  clientId: string;
  openSetup: () => void;
  guest?: boolean;
}) {
  const { isDark, toggleTheme } = useTheme();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<PlaylistSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [searchMessage, setSearchMessage] = useState('');
  const [searchFailed, setSearchFailed] = useState(false);
  const [pageError, setPageError] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [exportUrl, setExportUrl] = useState('');
  const [exporting, setExporting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [listeningTrack, setListeningTrack] = useState<SpotifyTrack | null>(null);
  const playerPanel = useRef<HTMLElement>(null);
  const callbackHandled = useRef(false);

  useEffect(() => {
    if (listeningTrack) playerPanel.current?.focus();
  }, [listeningTrack]);

  const readPlaylist = useCallback(async () => {
    if (guest) return { playlist: null, songs: [] as PlaylistSong[] };
    const client = await getRayfinClient();
    const playlists = await client.data.BirthdayPlaylist.select([
        'id',
        'title',
      ])
        .orderBy({ createdAt: 'desc' })
        .first(1)
        .execute();
    const saved = playlists[0];
    if (!saved) return { playlist: null, songs: [] as PlaylistSong[] };

    const savedSongs = await client.data.PlaylistSong.select([
        'id',
        'playlist_id',
        'spotifyUri',
        'title',
        'artist',
        'album',
        'coverUrl',
        'addedAt',
      ])
        .where({ playlist_id: { eq: saved.id } })
        .orderBy({ addedAt: 'asc' })
        .execute();
    return {
      playlist: { id: saved.id, title: saved.title },
      songs: savedSongs,
    };
  }, [guest]);

  async function loadPlaylist() {
    setLoading(true);
    setPageError('');
    try {
      const saved = await readPlaylist();
      setPlaylist(saved.playlist);
      setSongs(saved.songs);
    } catch (error) {
      setPageError(
        errorMessage(
          error,
          'Your playlist could not be loaded. Check your connection and try again.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void readPlaylist()
      .then((saved) => {
        if (!active) return;
        setPlaylist(saved.playlist);
        setSongs(saved.songs);
      })
      .catch((error: unknown) => {
        if (active) {
          setPageError(
            errorMessage(
              error,
              'Your playlist could not be loaded. Check your connection and try again.',
            ),
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [readPlaylist]);

  useEffect(() => {
    if (loading || callbackHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const spotifyError = params.get('error');
    if (!code && !spotifyError) return;

    callbackHandled.current = true;
    void (async () => {
      await Promise.resolve();
      const returnedState = params.get('state');
      let expectedState: SpotifyOAuthState | null = null;
      try {
        const stored = sessionStorage.getItem(STATE_KEY);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'state' in parsed &&
            typeof parsed.state === 'string' &&
            'codeVerifier' in parsed &&
            typeof parsed.codeVerifier === 'string' &&
            'expiresAt' in parsed &&
            typeof parsed.expiresAt === 'number' &&
            'clientId' in parsed &&
            typeof parsed.clientId === 'string' &&
            'ownerId' in parsed &&
            typeof parsed.ownerId === 'string'
          ) {
            expectedState = {
              state: parsed.state,
              codeVerifier: parsed.codeVerifier,
              expiresAt: parsed.expiresAt,
              clientId: parsed.clientId,
              ownerId: parsed.ownerId,
              guest: 'guest' in parsed && parsed.guest === true,
            };
          }
        }
        sessionStorage.removeItem(STATE_KEY);
      } catch {
        setExportMessage(
          'Spotify could not confirm this sign-in. Please start the connection again.',
        );
        return;
      }
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${window.location.hash}`,
      );

      if (
        !expectedState ||
        !returnedState ||
        returnedState !== expectedState.state ||
        expectedState.clientId !== clientId ||
        Boolean(expectedState.guest) !== guest ||
        expectedState.expiresAt < Date.now()
      ) {
        setExportMessage(
          'Spotify sign-in expired or could not be verified. Please connect again.',
        );
        return;
      }
      if (spotifyError || !code) {
        setExportMessage(
          spotifyError === 'access_denied'
            ? 'Spotify access was cancelled. Your in-app playlist is unchanged.'
            : 'Spotify could not authorize this request. Please try again.',
        );
        return;
      }

      setConnecting(true);
      setExportMessage('');
      try {
        if (!guest && ownerId(await getRayfinClient()) !== expectedState.ownerId) {
          throw new Error('The signed-in account changed. Connect Spotify again.');
        }
        const token = await exchangeSpotifyCode(
          clientId,
          code,
          getSpotifyRedirectUri(window.location.origin),
          expectedState.codeVerifier,
        );
        setAccessToken(token);
        setExportMessage(
          'Spotify is connected for this tab. You can now search and export your mix.',
        );
      } catch (error) {
        setExportMessage(spotifyErrorMessage(error));
      } finally {
        setConnecting(false);
      }
    })();
  }, [loading, clientId, guest]);

  async function createPlaylist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = playlistTitle.trim();
    if (!title || title.length > 100) return;
    if (guest) {
      setPlaylist({ id: crypto.randomUUID(), title });
      setSongs([]);
      setPlaylistTitle('');
      return;
    }

    setSaving(true);
    setPageError('');
    try {
      const client = await getRayfinClient();
      const saved = await client.data.BirthdayPlaylist.create({
        title,
        createdAt: new Date(),
        owner_id: ownerId(client),
      });
      setPlaylist({ id: saved.id, title: saved.title });
      setSongs([]);
      setPlaylistTitle('');
    } catch (error) {
      setPageError(
        errorMessage(
          error,
          'Your playlist could not be saved. Please try again.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function searchTracks(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (!accessToken) {
      setSearchFailed(true);
      setSearchMessage('Connect Spotify first to search for songs.');
      return;
    }
    if (term.length < 2 || term.length > 100) return;

    setSearching(true);
    setSearchMessage('');
    setSearchFailed(false);
    setSearchResults([]);
    try {
      const tracks = await searchSpotifyTracks(accessToken, term);
      setSearchResults(tracks);
      setSearchMessage(tracks.length ? '' : 'No matching tracks found.');
    } catch (error) {
      setSearchFailed(true);
      setSearchMessage(spotifyErrorMessage(error));
      if (error instanceof Error && error.name === 'SpotifyAuthExpiredError') {
        setAccessToken('');
      }
    } finally {
      setSearching(false);
    }
  }

  async function addTrack(track: SpotifyTrack) {
    if (!playlist || songs.length >= 100) return;
    if (songs.some((song) => song.spotifyUri === track.uri)) return;
    if (guest) {
      setSongs((current) => [...current, {
        id: crypto.randomUUID(), playlist_id: playlist.id,
        spotifyUri: track.uri, title: track.title, artist: track.artist,
        album: track.album, coverUrl: track.coverUrl, addedAt: new Date(),
      }]);
      return;
    }

    setSaving(true);
    setPageError('');
    try {
      const client = await getRayfinClient();
      const saved = await client.data.PlaylistSong.create({
        playlist_id: playlist.id,
        spotifyUri: track.uri,
        title: track.title,
        artist: track.artist,
        album: track.album,
        ...(track.coverUrl ? { coverUrl: track.coverUrl } : {}),
        addedAt: new Date(),
        owner_id: ownerId(client),
      });
      setSongs((current) => [...current, saved]);
    } catch (error) {
      setPageError(
        errorMessage(error, 'That song could not be saved. Please try again.'),
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeTrack(song: PlaylistSong) {
    if (guest) {
      setSongs((current) => current.filter((item) => item.id !== song.id));
      return;
    }
    setSaving(true);
    setPageError('');
    try {
      const client = await getRayfinClient();
      await client.data.PlaylistSong.delete({ id: song.id });
      setSongs((current) => current.filter((item) => item.id !== song.id));
    } catch (error) {
      setPageError(
        errorMessage(error, 'That song could not be removed. Please try again.'),
      );
    } finally {
      setSaving(false);
    }
  }

  async function resetPlaylist() {
    if (!playlist || saving || exporting || connecting) return;
    setSaving(true);
    setPageError('');
    try {
      if (!guest) {
        const client = await getRayfinClient();
        for (const song of songs) {
          await client.data.PlaylistSong.delete({ id: song.id });
          setSongs((current) => current.filter((item) => item.id !== song.id));
        }
        await client.data.BirthdayPlaylist.delete({ id: playlist.id });
      }
      setSongs([]);
      setPlaylist(null);
      setPlaylistTitle('');
      setListeningTrack(null);
      setExportMessage('');
      setExportUrl('');
      setConfirmReset(false);
    } catch (error) {
      setPageError(
        errorMessage(error, 'Could not finish starting over. Please try again.') +
          ' Any songs already removed stay removed. Your remaining playlist is still saved.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function connectToSpotify() {
    setConnecting(true);
    setExportMessage('');
    try {
      if (guest && songs.length > 0 && !window.confirm(
        'Reconnecting Spotify reloads this page and clears your guest draft. Continue?',
      )) {
        setConnecting(false);
        return;
      }
      const currentOwner = guest ? 'guest' : ownerId(await getRayfinClient());
      const authorization = await createSpotifyAuthorization(
        clientId,
        getSpotifyRedirectUri(window.location.origin),
      );
      sessionStorage.setItem(
        STATE_KEY,
        JSON.stringify({
          state: authorization.state,
          codeVerifier: authorization.codeVerifier,
          expiresAt: Date.now() + 10 * 60_000,
          clientId,
          ownerId: currentOwner,
          guest,
        } satisfies SpotifyOAuthState),
      );
      window.location.assign(authorization.url);
    } catch (error) {
      setExportMessage(
        spotifyErrorMessage(error, 'Spotify could not be opened. Please try again.'),
      );
      setConnecting(false);
    }
  }

  function listenToTrack(track: SpotifyTrack) {
    const match = /^spotify:track:([A-Za-z0-9]{1,128})$/u.exec(track.uri);
    if (!match) {
      setPageError('This song has an invalid Spotify link and cannot be played.');
      return;
    }
    setListeningTrack({ ...track, id: match[1] });
  }

  async function exportToSpotify() {
    if (!playlist || songs.length === 0) return;
    if (!accessToken) {
      await connectToSpotify();
      return;
    }

    setExporting(true);
    setExportMessage('');
    setExportUrl('');
    try {
      const url = await createSpotifyPlaylist(
        accessToken,
        playlist.title,
        songs.map((song) => song.spotifyUri),
      );
      setExportUrl(url);
      setExportMessage('Your private Spotify playlist is ready.');
    } catch (error) {
      setExportMessage(spotifyErrorMessage(error));
      if (error instanceof Error && error.name === 'SpotifyAuthExpiredError') {
        setAccessToken('');
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'playlistUrl' in error &&
        typeof error.playlistUrl === 'string'
      ) {
        setExportUrl(error.playlistUrl);
      }
    } finally {
      setExporting(false);
    }
  }

  const addedUris = new Set(songs.map((song) => song.spotifyUri));

  return (
    <div className="min-h-full bg-background px-400 py-500 text-foreground sm:px-700 sm:py-700">
      <div className="mx-auto max-w-6xl">
        <header className="mb-600 flex flex-wrap items-center justify-between gap-300">
          <div className="flex items-center gap-200">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-4">
              <Music2 className="icon-size-300" aria-hidden="true" />
            </span>
            <div>
              <p className="font-heading text-500 font-bold leading-500">
                Birthday mix
              </p>
              <p className="text-200 text-muted-foreground">
                Your party, your soundtrack
              </p>
            </div>
          </div>
          <div className="flex items-center gap-200">
            <button
              type="button"
              onClick={openSetup}
              disabled={saving || exporting || connecting}
              className="min-h-11 rounded-xl border border-border bg-card px-300 py-200 text-200 font-semibold hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
            >
              Spotify setup
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
            >
              {isDark ? (
                <Sun className="icon-size-200" aria-hidden="true" />
              ) : (
                <Moon className="icon-size-200" aria-hidden="true" />
              )}
            </button>
          </div>
        </header>

        <main>
          {guest ? (
            <p role="status" className="mb-400 rounded-xl border border-border bg-secondary p-300 text-200">
              Guest mode: your Client ID and draft are temporary. Refreshing,
              closing, changing Client ID, or reconnecting Spotify clears them.
              Playlists created in Spotify remain there.
            </p>
          ) : null}
          <section className="relative mb-700 overflow-hidden rounded-4xl bg-primary px-500 py-700 text-primary-foreground shadow-8 sm:px-800 sm:py-800">
            <div
              className="pointer-events-none absolute -right-300 -top-500 size-56 rounded-full border-4 border-primary-foreground/10"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute bottom-300 right-1/4 size-8 rotate-12 rounded-lg bg-accent"
              aria-hidden="true"
            />
            <div className="relative max-w-2xl">
              <p className="mb-300 flex items-center gap-200 text-200 font-semibold uppercase tracking-widest">
                <Sparkles className="icon-size-200" aria-hidden="true" />
                A little party planning
              </p>
              <h1 className="mb-300 max-w-xl font-heading text-hero-900 font-bold leading-hero-900 sm:text-hero-1000 sm:leading-hero-1000">
                Make a mix worth celebrating.
              </h1>
              <p className="max-w-xl text-400 leading-600 text-primary-foreground/90">
                Find the songs, add your favorites, then send your finished
                birthday playlist to your own Spotify.
              </p>
              <div className="mt-500 inline-flex items-center gap-200 rounded-full bg-primary-foreground/15 px-300 py-200 text-200 font-medium">
                <CircleCheck className="icon-size-200" aria-hidden="true" />
                {guest ? 'Temporary guest draft — not saved in this app' : 'Your in-app playlist is private to you'}
              </div>
            </div>
            <Sparkles
              className="pointer-events-none absolute bottom-600 right-700 icon-size-700 text-accent"
              aria-hidden="true"
            />
          </section>

          {pageError ? (
            <div
              className="mb-500 flex items-start gap-200 rounded-xl border border-destructive/30 bg-destructive/5 p-300 text-300 text-destructive"
              role="alert"
            >
              <CircleAlert
                className="mt-100 icon-size-200 shrink-0"
                aria-hidden="true"
              />
              <span className="flex-1">{pageError}</span>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  void loadPlaylist();
                }}
                className="font-semibold underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          ) : null}

          <div className="grid items-start gap-500 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
            <section className="rounded-3xl border border-border bg-card p-500 shadow-2 sm:p-600">
              <div className="mb-500 flex items-start justify-between gap-300">
                <div>
                  <p className="mb-100 text-200 font-semibold uppercase tracking-wider text-primary">
                    The song search
                  </p>
                  <h2 className="font-heading text-600 font-bold leading-600">
                    Find your feel-good track
                  </h2>
                </div>
                {accessToken ? (
                  <span className="inline-flex items-center gap-100 rounded-full bg-secondary px-300 py-200 text-200 font-semibold text-secondary-foreground">
                    <CircleCheck
                      className="icon-size-100"
                      aria-hidden="true"
                    />
                    Spotify connected
                  </span>
                ) : (
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                    <Disc3 className="icon-size-300" aria-hidden="true" />
                  </span>
                )}
              </div>

              {!accessToken ? (
                <div className="mb-400 flex flex-col gap-300 rounded-xl bg-secondary/70 p-300 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-200 leading-300 text-secondary-foreground">
                    Connect Spotify to search songs and create a private
                    playlist.
                  </p>
                  <button
                    type="button"
                    onClick={() => void connectToSpotify()}
                    disabled={connecting}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-200 rounded-lg bg-primary px-400 text-200 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
                  >
                    {connecting ? (
                      <LoaderCircle
                        className="icon-size-200 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <ExternalLink
                        className="icon-size-200"
                        aria-hidden="true"
                      />
                    )}
                    Connect Spotify
                  </button>
                </div>
              ) : null}
              {!playlist && exportMessage ? (
                <p
                  className="mb-400 rounded-xl bg-destructive/5 px-300 py-200 text-200 text-destructive"
                  role="alert"
                >
                  {exportMessage}
                </p>
              ) : null}

              {listeningTrack ? (
                <section
                  ref={playerPanel}
                  tabIndex={-1}
                  aria-label="Spotify song player"
                  className="mb-400 rounded-2xl border border-border bg-secondary/60 p-300"
                >
                  <div className="mb-200 flex items-center justify-between gap-200">
                    <p className="text-200 font-semibold">Listen on Spotify</p>
                    <button
                      type="button"
                      onClick={() => setListeningTrack(null)}
                      aria-label="Close Spotify player"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <X className="icon-size-200" aria-hidden="true" />
                    </button>
                  </div>
                  <iframe
                    key={listeningTrack.id}
                    title={`Spotify player for ${listeningTrack.title}`}
                    src={`https://open.spotify.com/embed/track/${listeningTrack.id}`}
                    width="100%"
                    height="152"
                    className="block rounded-2xl border-0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                  <button
                    type="button"
                    onClick={() => void addTrack(listeningTrack)}
                    disabled={
                      !playlist ||
                      saving ||
                      addedUris.has(listeningTrack.uri) ||
                      songs.length >= 100
                    }
                    className="mt-300 inline-flex min-h-11 items-center justify-center gap-200 rounded-xl bg-primary px-400 py-200 text-200 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {addedUris.has(listeningTrack.uri) ? (
                      <CircleCheck className="icon-size-200" aria-hidden="true" />
                    ) : (
                      <Plus className="icon-size-200" aria-hidden="true" />
                    )}
                    {addedUris.has(listeningTrack.uri)
                      ? 'Already added'
                      : !playlist
                        ? 'Create your playlist first'
                        : saving
                          ? 'Saving…'
                          : songs.length >= 100
                            ? 'Playlist is full'
                            : 'Add to playlist'}
                  </button>
                  <p className="mt-200 text-200 text-muted-foreground">
                    Press Play in the Spotify player. Playback and sign-in
                    requirements are controlled by Spotify.{' '}
                    <a
                      href={`https://open.spotify.com/track/${listeningTrack.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      Open in Spotify
                    </a>
                  </p>
                </section>
              ) : null}

              <form
                onSubmit={searchTracks}
                className="flex flex-col gap-200 sm:flex-row"
              >
                <label className="sr-only" htmlFor="song-search">
                  Search songs or artists on Spotify
                </label>
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="absolute left-300 top-1/2 icon-size-200 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    id="song-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    maxLength={100}
                    placeholder="Try a song, artist, or mood"
                    className="h-12 w-full rounded-xl border border-input bg-background pl-700 pr-300 text-300 text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  />
                </div>
                <button
                  type="submit"
                  disabled={
                    searching || !accessToken || query.trim().length < 2
                  }
                  className="inline-flex h-12 items-center justify-center gap-200 rounded-xl bg-primary px-500 text-300 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {searching ? (
                    <LoaderCircle
                      className="icon-size-200 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Search className="icon-size-200" aria-hidden="true" />
                  )}
                  Search
                </button>
              </form>

              <div className="mt-500" aria-live="polite">
                {searching ? (
                  <p className="rounded-xl bg-muted px-400 py-500 text-300 text-muted-foreground">
                    Looking for songs on Spotify…
                  </p>
                ) : searchMessage ? (
                  <p
                    className={`rounded-xl px-400 py-500 text-300 ${
                      searchFailed
                        ? 'bg-destructive/5 text-destructive'
                        : 'bg-muted text-muted-foreground'
                    }`}
                    role={searchFailed ? 'alert' : 'status'}
                  >
                    {searchMessage}
                  </p>
                ) : searchResults.length ? (
                  <>
                    <ul className="divide-y divide-border">
                      {searchResults.map((track) => {
                        const alreadyAdded = addedUris.has(track.uri);
                        return (
                          <li
                            key={track.id}
                            className="flex items-center gap-300 py-300"
                          >
                            {track.coverUrl ? (
                              <img
                                src={track.coverUrl}
                                alt=""
                                className="size-12 shrink-0 rounded-lg object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                                <Music2
                                  className="icon-size-200"
                                  aria-hidden="true"
                                />
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-300 font-semibold">
                                {track.title}
                              </p>
                              <p className="truncate text-200 text-muted-foreground">
                                {track.artist}
                                {track.album ? ` · ${track.album}` : ''}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => listenToTrack(track)}
                              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-45"
                              aria-label={`Listen to ${track.title} on Spotify`}
                              aria-pressed={listeningTrack?.id === track.id}
                              title="Open song in the Spotify player"
                            >
                              <Play
                                className="icon-size-200"
                                aria-hidden="true"
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => void addTrack(track)}
                              disabled={
                                !playlist ||
                                saving ||
                                alreadyAdded ||
                                songs.length >= 100
                              }
                              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-45"
                              aria-label={
                                alreadyAdded
                                  ? `${track.title} is already in your playlist`
                                  : `Add ${track.title} to your playlist`
                              }
                              title={
                                !playlist
                                  ? 'Create your playlist first'
                                  : alreadyAdded
                                    ? 'Already added'
                                    : 'Add to playlist'
                              }
                            >
                              <Plus
                                className="icon-size-200"
                                aria-hidden="true"
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-secondary/60 px-400 py-600 text-center">
                    <Sparkles
                      className="mx-auto mb-200 icon-size-300 text-primary"
                      aria-hidden="true"
                    />
                    <p className="text-300 font-semibold">
                      The perfect party song is out there
                    </p>
                    <p className="mt-100 text-200 text-muted-foreground">
                      Search Spotify and add your favorites to the list.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <aside className="rounded-3xl border border-border bg-card p-500 shadow-2 sm:p-600">
              <div className="mb-500 flex items-start justify-between gap-300">
                <div>
                  <p className="mb-100 text-200 font-semibold uppercase tracking-wider text-primary">
                    Your playlist
                  </p>
                  <h2 className="font-heading text-600 font-bold leading-600">
                    {playlist?.title || 'Start your birthday mix'}
                  </h2>
                </div>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                  <ListMusic className="icon-size-300" aria-hidden="true" />
                </span>
              </div>

              {loading ? (
                <div className="space-y-300" aria-label="Loading playlist">
                  <div className="h-14 animate-pulse rounded-xl bg-muted" />
                  <div className="h-14 animate-pulse rounded-xl bg-muted" />
                </div>
              ) : playlist ? (
                <>
                  <div className="mb-300 flex items-center justify-between text-200 text-muted-foreground">
                    <span>{songs.length} / 100 songs</span>
                    <span>{guest ? 'Temporary draft' : 'Only you can see this list'}</span>
                  </div>
                  {songs.length ? (
                    <ul className="max-h-96 divide-y divide-border overflow-y-auto">
                      {songs.map((song, index) => (
                        <li
                          key={song.id}
                          className="flex items-center gap-300 py-300"
                        >
                          <span className="w-5 shrink-0 text-right text-200 tabular-nums text-muted-foreground">
                            {index + 1}
                          </span>
                          {song.coverUrl ? (
                            <img
                              src={song.coverUrl}
                              alt=""
                              className="size-11 shrink-0 rounded-lg object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                              <Music2
                                className="icon-size-200"
                                aria-hidden="true"
                              />
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-300 font-semibold">
                              {song.title}
                            </p>
                            <p className="truncate text-200 text-muted-foreground">
                              {song.artist}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => listenToTrack({
                              id: song.id,
                              uri: song.spotifyUri,
                              title: song.title,
                              artist: song.artist,
                              album: song.album,
                              coverUrl: song.coverUrl || '',
                            })}
                            aria-label={`Listen to ${song.title} on Spotify`}
                            aria-pressed={
                              `spotify:track:${listeningTrack?.id}` === song.spotifyUri
                            }
                            title="Open song in the Spotify player"
                            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            <Play className="icon-size-200" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeTrack(song)}
                            disabled={saving}
                            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-45"
                            aria-label={`Remove ${song.title}`}
                          >
                            <Trash2
                              className="icon-size-200"
                              aria-hidden="true"
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border px-400 py-500 text-center">
                      <Music2
                        className="mx-auto mb-200 icon-size-300 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <p className="text-300 font-semibold">
                        Your mix is ready for its first song
                      </p>
                      <p className="mt-100 text-200 text-muted-foreground">
                        Search above, then tap + to add a track.
                      </p>
                    </div>
                  )}
                  {songs.length >= 100 ? (
                    <p className="mt-300 text-200 text-muted-foreground">
                      Spotify allows up to 100 songs per export.
                    </p>
                  ) : null}
                </>
              ) : (
                <form onSubmit={createPlaylist} className="space-y-300">
                  <p className="text-300 leading-500 text-muted-foreground">
                    {guest
                      ? 'Give your temporary playlist a name. Export it to Spotify before leaving this page.'
                      : 'Give your playlist a name. Your saved songs stay private to your signed-in account.'}
                  </p>
                  <label
                    htmlFor="playlist-title"
                    className="block text-200 font-medium"
                  >
                    Playlist name
                  </label>
                  <input
                    id="playlist-title"
                    value={playlistTitle}
                    onChange={(event) => setPlaylistTitle(event.target.value)}
                    maxLength={100}
                    placeholder="e.g. Maya's birthday bash"
                    className="h-12 w-full rounded-xl border border-input bg-background px-300 text-300 text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  />
                  <button
                    type="submit"
                    disabled={saving || !playlistTitle.trim() || (guest && !accessToken)}
                    className="inline-flex h-11 w-full items-center justify-center gap-200 rounded-xl bg-primary px-400 text-300 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? (
                      <LoaderCircle
                        className="icon-size-200 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Plus className="icon-size-200" aria-hidden="true" />
                    )}
                    {guest && !accessToken ? 'Connect Spotify first' : 'Create my playlist'}
                  </button>
                </form>
              )}

              {playlist ? (
                <div className="mt-500 border-t border-border pt-500">
                  <button
                    type="button"
                    onClick={() => void exportToSpotify()}
                    disabled={saving || exporting || connecting || songs.length === 0}
                    className="inline-flex h-12 w-full items-center justify-center gap-200 rounded-xl bg-accent px-400 text-300 font-bold text-accent-foreground transition-colors hover:bg-accent/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {exporting || connecting ? (
                      <LoaderCircle
                        className="icon-size-200 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <ExternalLink
                        className="icon-size-200"
                        aria-hidden="true"
                      />
                    )}
                    {exporting
                      ? 'Creating your playlist…'
                      : connecting
                        ? 'Connecting to Spotify…'
                        : accessToken
                          ? 'Create in Spotify'
                          : 'Connect & create in Spotify'}
                  </button>
                  {exportMessage ? (
                    <p
                      className="mt-300 flex items-start gap-200 text-200 text-muted-foreground"
                      role={exportUrl ? 'status' : 'alert'}
                    >
                      {exportUrl ? (
                        <CircleCheck
                          className="mt-100 icon-size-200 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                      ) : (
                        <CircleAlert
                          className="mt-100 icon-size-200 shrink-0 text-destructive"
                          aria-hidden="true"
                        />
                      )}
                      <span className="flex-1">{exportMessage}</span>
                      {exportUrl ? (
                        <a
                          href={exportUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex shrink-0 items-center gap-100 font-semibold text-primary underline underline-offset-2"
                        >
                          Open
                          <ExternalLink
                            className="icon-size-100"
                            aria-hidden="true"
                          />
                        </a>
                      ) : null}
                    </p>
                  ) : null}
                  <p className="mt-300 text-200 leading-300 text-muted-foreground">
                    Spotify will ask for permission to create a private
                    playlist in your account.
                  </p>
                  {confirmReset ? (
                    <div
                      role="group"
                      aria-label="Confirm starting over"
                      className="mt-400 rounded-xl border border-border bg-secondary p-300"
                    >
                      <p className="text-200 leading-300">
                        Remove this playlist name and all its saved songs?
                        This cannot be undone. Playlists already created in
                        Spotify will not be changed.
                      </p>
                      <div className="mt-300 flex flex-wrap gap-200">
                        <button
                          type="button"
                          onClick={() => void resetPlaylist()}
                          disabled={saving || exporting || connecting}
                          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-destructive px-300 py-200 text-200 font-semibold text-destructive-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
                        >
                          {saving ? 'Starting over…' : 'Yes, start over'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmReset(false)}
                          disabled={saving}
                          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-300 py-200 text-200 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      disabled={loading || saving || exporting || connecting}
                      className="mt-400 inline-flex min-h-11 items-center justify-center gap-200 rounded-xl border border-border px-300 py-200 text-200 font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
                    >
                      <Trash2 className="icon-size-200" aria-hidden="true" />
                      Start over
                    </button>
                  )}
                </div>
              ) : null}
            </aside>
          </div>

        </main>
      </div>
    </div>
  );
}

export default function App({ guest = false }: { guest?: boolean }) {
  return (
    <SpotifySetup guest={guest}>
      {(clientId, openSetup) => (
        <PlaylistBuilder key={clientId} clientId={clientId} openSetup={openSetup} guest={guest} />
      )}
    </SpotifySetup>
  );
}
