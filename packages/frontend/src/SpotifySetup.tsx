import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Moon, Music2, Sun } from 'lucide-react';

import { useTheme } from './hooks/theme.context';
import { getRayfinClient } from './lib/rayfin-client';
import { isSpotifyClientId } from './lib/spotify';
import { SpotifySetupGuide } from './SpotifySetupGuide';

interface Settings {
  id: string;
  clientId: string;
}

export function SpotifySetup({
  children,
}: {
  children: (clientId: string, openSetup: () => void) => ReactNode;
}) {
  const { isDark, toggleTheme } = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [clientId, setClientId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const client = await getRayfinClient();
        const rows = await client.data.SpotifySettings.select(['id', 'clientId'])
          .first(1).execute();
        if (!active) return;
        const saved = rows[0] ?? null;
        setSettings(saved);
        setClientId(saved?.clientId ?? '');
      } catch (cause) {
        if (active) {
          setLoadFailed(true);
          setError(cause instanceof Error
            ? cause.message : 'Your Spotify setup could not be loaded. Please try again.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [attempt]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = clientId.trim();
    if (!isSpotifyClientId(value)) {
      setError('Enter the 32-character Client ID from your Spotify developer app, not the client secret.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const client = await getRayfinClient();
      const session = client.auth.getSession();
      if (!session.isAuthenticated || !session.user) {
        throw new Error('Sign in again to save your Spotify setup.');
      }
      const saved = settings
        ? await client.data.SpotifySettings.update({ id: settings.id }, { clientId: value })
        : await client.data.SpotifySettings.create({
          clientId: value,
          owner_id: session.user.id,
        });
      setSettings({ id: saved.id, clientId: saved.clientId });
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your Spotify setup could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const showSetup = !settings || editing;

  return (
    <>
      {showSetup ? (
        <main className="min-h-screen bg-background px-400 py-600 text-foreground">
          <div className="mx-auto max-w-xl">
            <header className="mb-500 flex items-center justify-between gap-300">
              <span className="flex items-center gap-200 font-heading text-500 font-bold">
                <Music2 className="icon-size-300 text-primary" aria-hidden="true" />
                Birthday mix
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
                className="flex size-11 items-center justify-center rounded-full border border-border bg-card hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {isDark ? <Sun className="icon-size-200" /> : <Moon className="icon-size-200" />}
              </button>
            </header>
            <section className="rounded-3xl border border-border bg-card p-500 shadow-2 sm:p-600">
              <p className="mb-200 text-200 font-semibold uppercase tracking-wider text-primary">Your party starts here</p>
              <h1 className="font-heading text-600 font-bold">Set up your Spotify app</h1>
              {loading ? (
                <p className="mt-400 text-300 text-muted-foreground" role="status">Loading your Spotify setup…</p>
              ) : !loadFailed ? (
                <>
                  <p className="mt-300 text-300 leading-500 text-muted-foreground">
                    Bring your own Spotify Client ID to search songs and create
                    playlists in your account. Your setting is saved privately
                    to your signed-in account. Never enter your client secret.
                  </p>
                  <SpotifySetupGuide />
                  <form onSubmit={save} className="mt-500 space-y-300">
                    <label htmlFor="spotify-client-id" className="block text-200 font-semibold">Spotify Client ID</label>
                    <input
                      id="spotify-client-id"
                      value={clientId}
                      onChange={(event) => setClientId(event.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      required
                      maxLength={32}
                      aria-describedby="spotify-client-id-help"
                      className="h-12 w-full rounded-xl border border-input bg-background px-300 text-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    />
                    <p id="spotify-client-id-help" className="text-200 text-muted-foreground">
                      The public 32-character ID, not a secret. Changing it
                      disconnects Spotify but keeps your saved playlist.
                    </p>
                    <div className="flex flex-wrap gap-200">
                      <button type="submit" disabled={saving || !clientId.trim()}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-400 py-200 text-300 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50">
                        {saving ? 'Saving…' : 'Save and continue'}
                      </button>
                      {settings ? (
                        <button type="button" disabled={saving} onClick={() => { setEditing(false); setError(''); }}
                          className="min-h-11 rounded-xl border border-border px-400 py-200 text-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50">
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </form>
                </>
              ) : null}
              {error ? (
                <div className="mt-300 text-200 text-destructive" role="alert">
                  <p>{error}</p>
                  {!settings ? (
                    <button type="button" onClick={() => {
                      setError(''); setLoadFailed(false); setLoading(true); setAttempt((value) => value + 1);
                    }} className="mt-200 font-semibold underline">Reload setup</button>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        </main>
      ) : null}
      {settings ? (
        <div hidden={showSetup}>
          {children(settings.clientId, () => {
            setClientId(settings.clientId);
            setError('');
            setEditing(true);
          })}
        </div>
      ) : null}
    </>
  );
}
