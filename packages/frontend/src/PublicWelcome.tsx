import type { ReactNode } from 'react';
import { Moon, Music2, Sparkles, Sun } from 'lucide-react';

import { useTheme } from './hooks/theme.context';
import { SpotifySetupGuide } from './SpotifySetupGuide';

export function PublicWelcome({ children }: { children: ReactNode }) {
  const { isDark, toggleTheme } = useTheme();
  return (
    <main className="min-h-screen bg-background px-400 py-600 text-foreground sm:px-700">
      <div className="mx-auto max-w-6xl">
        <header className="mb-500 flex items-center justify-between gap-300">
          <span className="flex items-center gap-200 font-heading text-500 font-bold">
            <Music2 className="icon-size-300 text-primary" aria-hidden="true" />
            Birthday mix
          </span>
          <button type="button" onClick={toggleTheme}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
            className="flex size-11 items-center justify-center rounded-full border border-border bg-card hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            {isDark ? <Sun className="icon-size-200" aria-hidden="true" /> : <Moon className="icon-size-200" aria-hidden="true" />}
          </button>
        </header>
        <section className="mb-500 rounded-4xl bg-primary p-600 text-primary-foreground sm:p-800">
          <Sparkles className="mb-300 icon-size-500 text-accent" aria-hidden="true" />
          <h1 className="font-heading text-700 font-bold">Your next birthday deserves a great soundtrack.</h1>
          <p className="mt-300 max-w-2xl text-300 leading-500">
            Find your favorite songs, listen with Spotify, and build a private
            birthday playlist to send to your Spotify account.
          </p>
          <p className="mt-300 text-200">
            Explore the setup guide without signing in. Microsoft sign-in protects
            your saved Client ID and playlists; Spotify sign-in authorizes music search and export.
          </p>
        </section>
        <div className="grid items-start gap-500 lg:grid-cols-2">
          <section aria-labelledby="public-setup-heading" className="rounded-3xl border border-border bg-card p-500 sm:p-600">
            <h2 id="public-setup-heading" className="font-heading text-500 font-bold">Prepare your Spotify app</h2>
            <p className="mt-200 text-200 text-muted-foreground">
              You can follow these steps now. No Client ID is read or saved until you sign in.
            </p>
            <SpotifySetupGuide />
          </section>
          <section aria-label="Sign in to your private playlist">
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
