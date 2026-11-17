//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const { execute, createSong, deleteSong, deletePlaylist, searchSpotifyTracks, exchangeSpotifyCode, createSpotifyPlaylist } = vi.hoisted(() => ({
  execute: vi.fn(),
  createSong: vi.fn(),
  deleteSong: vi.fn(),
  deletePlaylist: vi.fn(),
  searchSpotifyTracks: vi.fn(),
  exchangeSpotifyCode: vi.fn(),
  createSpotifyPlaylist: vi.fn(),
}));

vi.mock('@/lib/spotify', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/spotify')>(),
  searchSpotifyTracks,
  exchangeSpotifyCode,
  createSpotifyPlaylist,
}));

vi.mock('@/lib/rayfin-client', () => {
  const query = {
    select: () => query,
    orderBy: () => query,
    first: () => query,
    where: () => query,
    execute,
  };
  return {
    getRayfinClient: async () => ({
      auth: {
        getSession: () => ({
          isAuthenticated: true,
          user: { id: 'test-user' },
        }),
      },
      data: {
        BirthdayPlaylist: { ...query, delete: deletePlaylist },
        PlaylistSong: { ...query, create: createSong, delete: deleteSong },
        SpotifySettings: {
          select: () => ({
            first: () => ({
              execute: async () => [{ id: 'settings', clientId: '0123456789abcdef0123456789abcdef' }],
            }),
          }),
        },
      },
    }),
  };
});

import App from '@/App';

describe('App', () => {
  beforeEach(() => {
    execute.mockReset().mockResolvedValue([]);
    createSong.mockReset();
    deleteSong.mockReset().mockResolvedValue(undefined);
    deletePlaylist.mockReset().mockResolvedValue(undefined);
    searchSpotifyTracks.mockReset();
    exchangeSpotifyCode.mockReset();
    createSpotifyPlaylist.mockReset();
  });

  afterEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('renders without throwing', () => {
    expect(() => render(<App />)).not.toThrow();
  });

  it('mounts content into the document', () => {
    render(<App />);
    expect(document.body).not.toBeEmptyDOMElement();
  });

  it('shows the birthday playlist builder', async () => {
    const { findByText, getByLabelText } = render(<App />);
    expect(await findByText('Make a mix worth celebrating.')).toBeInTheDocument();
    expect(getByLabelText('Search songs or artists on Spotify')).toBeInTheDocument();
  });

  it('builds, exports, and resets a guest draft without accessing private data', async () => {
    sessionStorage.setItem('birthday-songs.spotify-oauth-state', JSON.stringify({
      guest: true, clientId: '0123456789abcdef0123456789abcdef',
      ownerId: 'guest', state: 'guest-state', codeVerifier: 'verifier',
      expiresAt: Date.now() + 60_000,
    }));
    window.history.replaceState({}, '', '/?code=guest-code&state=guest-state');
    exchangeSpotifyCode.mockResolvedValue('guest-token');
    searchSpotifyTracks.mockResolvedValue([{
      id: 'guesttrack', uri: 'spotify:track:guesttrack',
      title: 'Guest song', artist: 'Artist', album: '', coverUrl: '',
    }]);
    createSpotifyPlaylist.mockResolvedValue('https://open.spotify.com/playlist/exported');
    const view = render(<App guest />);
    await view.findByText('Spotify connected');
    fireEvent.change(view.getByLabelText('Playlist name'), { target: { value: 'Guest mix' } });
    fireEvent.click(view.getByRole('button', { name: 'Create my playlist' }));
    fireEvent.change(view.getByLabelText('Search songs or artists on Spotify'), {
      target: { value: 'Guest song' },
    });
    fireEvent.click(view.getByRole('button', { name: 'Search' }));
    fireEvent.click(await view.findByRole('button', { name: 'Add Guest song to your playlist' }));
    expect(view.getByText('1 / 100 songs')).toBeVisible();
    fireEvent.click(view.getByRole('button', { name: 'Create in Spotify' }));
    await view.findByText('Your private Spotify playlist is ready.');
    expect(createSpotifyPlaylist).toHaveBeenCalledWith(
      'guest-token', 'Guest mix', ['spotify:track:guesttrack'],
    );
    fireEvent.click(view.getByRole('button', { name: 'Remove Guest song' }));
    expect(view.getByText('0 / 100 songs')).toBeVisible();
    fireEvent.click(view.getByRole('button', { name: 'Start over' }));
    fireEvent.click(view.getByRole('button', { name: 'Yes, start over' }));
    await view.findByLabelText('Playlist name');
    expect(execute).not.toHaveBeenCalled();
    expect(createSong).not.toHaveBeenCalled();
    expect(deleteSong).not.toHaveBeenCalled();
    expect(deletePlaylist).not.toHaveBeenCalled();
    view.unmount();
    const reload = render(<App guest />);
    expect(await reload.findByLabelText('Spotify Client ID')).toBeVisible();
  });

  it.each([
    ['abcdef0123456789abcdef0123456789', 'test-user'],
    ['0123456789abcdef0123456789abcdef', 'different-user'],
  ])('does not exchange an OAuth callback for another client or user (%s, %s)', async (clientId, ownerId) => {
    sessionStorage.setItem('birthday-songs.spotify-oauth-state', JSON.stringify({
      state: 'test-state',
      codeVerifier: 'test-verifier',
      expiresAt: Date.now() + 60_000,
      clientId,
      ownerId,
    }));
    window.history.replaceState({}, '', '/?code=test-code&state=test-state');
    const view = render(<App />);
    await view.findByText(/Spotify sign-in expired|Spotify could not complete/);
    expect(exchangeSpotifyCode).not.toHaveBeenCalled();
  });

  it('requires confirmation and resets the saved playlist and name', async () => {
    execute
      .mockResolvedValueOnce([{ id: 'playlist', title: 'Birthday mix' }])
      .mockResolvedValueOnce([
        { id: 'song1', title: 'First song', spotifyUri: 'spotify:track:one' },
        { id: 'song2', title: 'Second song', spotifyUri: 'spotify:track:two' },
      ]);
    const view = render(<App />);
    fireEvent.click(await view.findByRole('button', { name: 'Start over' }));
    expect(deleteSong).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole('button', { name: 'Cancel' }));
    expect(deletePlaylist).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole('button', { name: 'Start over' }));
    fireEvent.click(view.getByRole('button', { name: 'Yes, start over' }));
    expect(await view.findByRole('button', { name: 'Create my playlist' })).toBeVisible();
    expect(view.getByLabelText('Playlist name')).toHaveValue('');
    expect(deleteSong.mock.calls).toEqual([[{ id: 'song1' }], [{ id: 'song2' }]]);
    expect(deletePlaylist).toHaveBeenCalledWith({ id: 'playlist' });
    expect(deletePlaylist.mock.invocationCallOrder[0]).toBeGreaterThan(
      deleteSong.mock.invocationCallOrder[1],
    );
    view.unmount();
    const reloaded = render(<App />);
    expect(await reloaded.findByRole('button', { name: 'Create my playlist' })).toBeVisible();
  });

  it('keeps remaining songs visible if reset fails and lets the user retry', async () => {
    execute
      .mockResolvedValueOnce([{ id: 'playlist', title: 'Birthday mix' }])
      .mockResolvedValueOnce([
        { id: 'song1', title: 'First song', spotifyUri: 'spotify:track:one' },
        { id: 'song2', title: 'Second song', spotifyUri: 'spotify:track:two' },
      ]);
    deleteSong.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Connection lost'));
    const view = render(<App />);
    fireEvent.click(await view.findByRole('button', { name: 'Start over' }));
    fireEvent.click(view.getByRole('button', { name: 'Yes, start over' }));
    expect(await view.findByText(/Connection lost/)).toBeVisible();
    expect(view.queryByText('First song')).toBeNull();
    expect(view.getByText('Second song')).toBeVisible();
    expect(deletePlaylist).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole('button', { name: 'Yes, start over' }));
    expect(await view.findByRole('button', { name: 'Create my playlist' })).toBeVisible();
    expect(deleteSong.mock.calls).toEqual([
      [{ id: 'song1' }], [{ id: 'song2' }], [{ id: 'song2' }],
    ]);
  });

  it('opens saved songs in a single Spotify embed without preview URLs', async () => {
    execute
      .mockResolvedValueOnce([{ id: 'playlist', title: 'Birthday mix' }])
      .mockResolvedValueOnce([
        {
          id: 'song1',
          spotifyUri: 'spotify:track:trackone',
          title: 'First song',
          artist: 'Artist',
        },
        {
          id: 'song2',
          spotifyUri: 'spotify:track:tracktwo',
          title: 'Second song',
          artist: 'Artist',
        },
      ]);
    const view = render(<App />);
    expect(view.container.querySelector('iframe')).toBeNull();

    fireEvent.click(await view.findByRole('button', {
      name: 'Listen to First song on Spotify',
    }));
    expect(view.getByTitle('Spotify player for First song')).toHaveAttribute(
      'src', 'https://open.spotify.com/embed/track/trackone',
    );
    expect(view.getByRole('link', { name: 'Open in Spotify' })).toHaveAttribute(
      'href', 'https://open.spotify.com/track/trackone',
    );
    expect(view.getByRole('button', { name: 'Already added' })).toBeDisabled();

    fireEvent.click(view.getByRole('button', {
      name: 'Listen to Second song on Spotify',
    }));
    expect(view.queryByTitle('Spotify player for First song')).toBeNull();
    expect(view.getByTitle('Spotify player for Second song')).toHaveAttribute(
      'src', 'https://open.spotify.com/embed/track/tracktwo',
    );
    expect(view.container.querySelectorAll('iframe')).toHaveLength(1);

    fireEvent.click(view.getByRole('button', { name: 'Close Spotify player' }));
    expect(view.container.querySelector('iframe')).toBeNull();
  });

  it('lets search results open the Spotify player when no preview is provided', async () => {
    execute
      .mockResolvedValueOnce([{ id: 'playlist', title: 'Birthday mix' }])
      .mockResolvedValueOnce([]);
    createSong.mockImplementation(async (song) => ({ id: 'saved-song', ...song }));
    sessionStorage.setItem('birthday-songs.spotify-oauth-state', JSON.stringify({
      state: 'test-state',
      codeVerifier: 'test-verifier',
      expiresAt: Date.now() + 60_000,
      clientId: '0123456789abcdef0123456789abcdef',
      ownerId: 'test-user',
    }));
    window.history.replaceState({}, '', '/?code=test-code&state=test-state');
    exchangeSpotifyCode.mockResolvedValue('test-token');
    searchSpotifyTracks.mockResolvedValue([{
      id: 'mariahtrack',
      uri: 'spotify:track:mariahtrack',
      title: 'Mariah song',
      artist: 'Mariah Carey',
      album: '',
      coverUrl: '',
    }]);
    const view = render(<App />);
    await view.findByText('Spotify connected');
    expect(exchangeSpotifyCode).toHaveBeenCalledWith(
      '0123456789abcdef0123456789abcdef',
      'test-code',
      expect.any(String),
      'test-verifier',
    );
    fireEvent.change(view.getByLabelText('Search songs or artists on Spotify'), {
      target: { value: 'Mariah Carey' },
    });
    fireEvent.click(view.getByRole('button', { name: 'Search' }));
    const listenButton = await view.findByRole('button', {
      name: 'Listen to Mariah song on Spotify',
    });
    expect(listenButton).toBeEnabled();
    fireEvent.click(listenButton);
    expect(view.getByTitle('Spotify player for Mariah song')).toHaveAttribute(
      'src', 'https://open.spotify.com/embed/track/mariahtrack',
    );
    expect(view.getByRole('region', { name: 'Spotify song player' })).toHaveFocus();
    const player = view.getByTitle('Spotify player for Mariah song');
    fireEvent.click(view.getByRole('button', { name: 'Add to playlist' }));
    expect(await view.findByRole('button', { name: 'Already added' })).toBeDisabled();
    expect(createSong).toHaveBeenCalledWith(expect.objectContaining({
      playlist_id: 'playlist',
      spotifyUri: 'spotify:track:mariahtrack',
      title: 'Mariah song',
      artist: 'Mariah Carey',
      owner_id: 'test-user',
    }));
    expect(view.getByTitle('Spotify player for Mariah song')).toBe(player);
  });
});
