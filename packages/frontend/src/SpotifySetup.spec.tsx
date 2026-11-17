import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SpotifySetup } from './SpotifySetup';
import { getSpotifyRedirectUri } from './lib/spotify';

const { read, create, update } = vi.hoisted(() => ({
  read: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock('./lib/rayfin-client', () => ({
  getRayfinClient: async () => ({
    auth: { getSession: () => ({ isAuthenticated: true, user: { id: 'owner' } }) },
    data: {
      SpotifySettings: {
        select: () => ({ first: () => ({ execute: read }) }),
        create,
        update,
      },
    },
  }),
}));

const firstId = '0123456789abcdef0123456789abcdef';
const secondId = 'abcdef0123456789abcdef0123456789';

function renderSetup() {
  return render(
    <SpotifySetup>
      {(clientId, openSetup) => (
        <div>
          <p>Active ID: {clientId}</p>
          <button onClick={openSetup}>Edit setup</button>
        </div>
      )}
    </SpotifySetup>,
  );
}

describe('Spotify setup', () => {
  beforeEach(() => {
    read.mockReset().mockResolvedValue([]);
    create.mockReset();
    update.mockReset();
  });

  it('explains app creation and saves the public ID privately before continuing', async () => {
    create.mockResolvedValue({ id: 'settings', clientId: firstId });
    const view = renderSetup();
    const input = await screen.findByLabelText('Spotify Client ID');
    expect(screen.getByRole('link', { name: 'Spotify Developer Dashboard' })).toHaveAttribute(
      'href', 'https://developer.spotify.com/dashboard',
    );
    expect(screen.getByText('Web API')).toBeVisible();
    expect(screen.getByText(getSpotifyRedirectUri(window.location.origin))).toBeVisible();
    fireEvent.change(input, { target: { value: firstId } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByText(`Active ID: ${firstId}`)).toBeVisible();
    expect(create).toHaveBeenCalledWith({ clientId: firstId, owner_id: 'owner' });
    view.unmount();
    read.mockResolvedValue([{ id: 'settings', clientId: firstId }]);
    renderSetup();
    expect(await screen.findByText(`Active ID: ${firstId}`)).toBeVisible();
    expect(screen.queryByLabelText('Spotify Client ID')).toBeNull();
  });

  it('rejects invalid IDs without writing them', async () => {
    renderSetup();
    fireEvent.change(await screen.findByLabelText('Spotify Client ID'), {
      target: { value: 'not-a-client-id' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('32-character Client ID');
    expect(create).not.toHaveBeenCalled();
  });

  it('can change or cancel settings without creating another record', async () => {
    read.mockResolvedValue([{ id: 'settings', clientId: firstId }]);
    update.mockResolvedValue({ id: 'settings', clientId: secondId });
    renderSetup();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit setup' }));
    fireEvent.change(screen.getByLabelText('Spotify Client ID'), {
      target: { value: secondId },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText(`Active ID: ${firstId}`)).toBeVisible();
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit setup' }));
    fireEvent.change(screen.getByLabelText('Spotify Client ID'), {
      target: { value: secondId },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(
      { id: 'settings' }, { clientId: secondId },
    ));
    expect(await screen.findByText(`Active ID: ${secondId}`)).toBeVisible();
    expect(create).not.toHaveBeenCalled();
  });

  it('blocks setup writes after a load error and allows retry', async () => {
    read.mockRejectedValueOnce(new Error('Setup unavailable'));
    renderSetup();
    expect(await screen.findByRole('alert')).toHaveTextContent('Setup unavailable');
    expect(screen.queryByLabelText('Spotify Client ID')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reload setup' }));
    expect(await screen.findByLabelText('Spotify Client ID')).toBeVisible();
  });

  it('shows save failures without continuing', async () => {
    create.mockRejectedValue(new Error('Save refused'));
    renderSetup();
    fireEvent.change(await screen.findByLabelText('Spotify Client ID'), {
      target: { value: firstId },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Save refused');
    expect(screen.queryByRole('button', { name: 'Edit setup' })).toBeNull();
  });
});
