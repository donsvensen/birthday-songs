import { getSpotifyRedirectUri } from './lib/spotify';

export function SpotifySetupGuide() {
  return (
    <>
      <ol className="mt-400 list-decimal space-y-300 pl-500 text-200 leading-400">
        <li>
          Sign in to the{' '}
          <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer"
            className="font-semibold text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            Spotify Developer Dashboard
          </a>{' '}
          and select <strong>Create app</strong> (or open an existing app).
          Give it a name such as <strong>My Birthday Mix</strong> and a description
          such as <strong>Find songs and create my private birthday playlist</strong>.
          If a Website is requested, use{' '}
          <code className="break-all">https://bold-forge-c1c427dcac-westeurope.webapp.fabricapps.net</code>.
        </li>
        <li>
          Add this exact redirect address in that app&apos;s settings:
          <code className="mt-200 block break-all rounded-xl bg-secondary p-300 text-foreground">
            {getSpotifyRedirectUri(window.location.origin)}
          </code>
          Local preview uses an HTTP loopback address. For the published app,
          register the HTTPS address shown when you open this page there.
        </li>
        <li>
          Under the APIs/SDKs question, select <strong>Web API</strong>.
          No Android package, iOS bundle ID, or Web Playback SDK is needed.
          Review Spotify&apos;s terms, accept them if you agree, and save the app.
        </li>
        <li>
          Open the app&apos;s <strong>Settings</strong> and copy its{' '}
          <strong>Client ID</strong>, not the Client Secret.
          After signing in to Birthday mix with Microsoft, save that ID in setup,
          then select <strong>Connect Spotify</strong> to authorize your Spotify account.
        </li>
      </ol>
      <p className="mt-400 rounded-xl bg-secondary p-300 text-200 leading-400">
        Development Mode requires the app owner to have Spotify Premium and other
        users to be added under Users Management; using your own ID does not remove Spotify&apos;s limits.
      </p>
    </>
  );
}
