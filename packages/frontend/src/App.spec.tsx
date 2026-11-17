//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/rayfin-client', () => {
  const query = {
    select: () => query,
    orderBy: () => query,
    first: () => query,
    where: () => query,
    execute: async () => [],
  };
  return {
    getRayfinClient: async () => ({
      data: {
        BirthdayPlaylist: query,
        PlaylistSong: query,
      },
    }),
  };
});

import App from '@/App';

describe('App', () => {
  it('renders without throwing', () => {
    expect(() => render(<App />)).not.toThrow();
  });

  it('mounts content into the document', () => {
    render(<App />);
    expect(document.body).not.toBeEmptyDOMElement();
  });

  it('shows the birthday playlist builder', () => {
    const { getByText, getByLabelText } = render(<App />);
    expect(getByText('Make a mix worth celebrating.')).toBeInTheDocument();
    expect(getByLabelText('Search songs or artists on Spotify')).toBeInTheDocument();
  });
});
