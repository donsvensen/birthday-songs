import { authenticated, date, entity, text, uuid } from '@microsoft/rayfin-core';

@entity()
@authenticated('*', {
  policy: (claims, song) => claims.sub.eq(song.owner_id),
})
export class PlaylistSong {
  @uuid() id!: string;
  @text({ max: 36 }) playlist_id!: string;
  @text({ max: 100 }) spotifyUri!: string;
  @text({ max: 200 }) title!: string;
  @text({ max: 240 }) artist!: string;
  @text({ max: 200 }) album!: string;
  @text({ optional: true, max: 500 }) coverUrl?: string;
  @date() addedAt!: Date;
  @text({ max: 200 }) owner_id!: string;
}
