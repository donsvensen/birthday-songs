import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DemoVideo } from './DemoVideo';

describe('demo video', () => {
  it('loads the video only when opened and removes it when closed', () => {
    render(<DemoVideo />);
    expect(screen.queryByLabelText('Birthday mix walkthrough')).toBeNull();
    const watch = screen.getByRole('button', { name: 'Watch demo' });
    expect(watch).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(watch);
    const video = screen.getByLabelText('Birthday mix walkthrough');
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveAttribute('preload', 'metadata');
    expect(video).not.toHaveAttribute('autoplay');
    expect(video.querySelector('source')).toHaveAttribute('src', '/birthday-demo.mp4');
    expect(screen.getByRole('link', { name: 'Open demo video in a new tab' }))
      .toHaveAttribute('href', '/birthday-demo.mp4');
    fireEvent.click(screen.getByRole('button', { name: 'Close demo' }));
    expect(screen.queryByLabelText('Birthday mix walkthrough')).toBeNull();
    expect(screen.getByRole('button', { name: 'Watch demo' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows an actionable error when playback fails', () => {
    render(<DemoVideo />);
    fireEvent.click(screen.getByRole('button', { name: 'Watch demo' }));
    fireEvent.error(screen.getByLabelText('Birthday mix walkthrough'));
    expect(screen.getByRole('alert')).toHaveTextContent('The demo could not be played here');
    expect(screen.getByRole('link', { name: 'Open demo video in a new tab' })).toBeVisible();
  });
});
