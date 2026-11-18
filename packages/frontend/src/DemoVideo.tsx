import { useState } from 'react';
import { Play, X } from 'lucide-react';

const demoUrl = `${import.meta.env.BASE_URL}birthday-demo.mp4`;

export function DemoVideo() {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <aside aria-label="App demo" className="border-b border-border bg-card px-400 py-300 text-foreground">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-200">
          <p className="text-200 text-muted-foreground">New to Birthday mix? See it in action.</p>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="birthday-demo"
            onClick={() => { setOpen(!open); setFailed(false); }}
            className="inline-flex min-h-11 items-center gap-200 rounded-xl px-300 py-200 text-300 font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {open ? <X className="icon-size-200" aria-hidden="true" /> : <Play className="icon-size-200" aria-hidden="true" />}
            {open ? 'Close demo' : 'Watch demo'}
          </button>
        </div>
        <div id="birthday-demo" hidden={!open}>
          {open && (
            <section aria-label="Birthday mix demo video" className="mt-300 space-y-300 pb-300">
              <video
                controls
                playsInline
                preload="metadata"
                aria-label="Birthday mix walkthrough"
                className="aspect-video w-full rounded-xl bg-background"
                onError={() => setFailed(true)}
              >
                <source src={demoUrl} type="video/mp4" />
                Your browser does not support embedded video. Use the link below to watch.
              </video>
              {failed && (
                <p role="alert" className="text-200 text-destructive">
                  The demo could not be played here. Try opening the video directly below.
                </p>
              )}
              <a href={demoUrl} target="_blank" rel="noopener noreferrer"
                className="inline-block rounded text-200 font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                Open demo video in a new tab
              </a>
            </section>
          )}
        </div>
      </div>
    </aside>
  );
}
