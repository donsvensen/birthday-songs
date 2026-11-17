import { authenticated, date, entity, text, uuid } from '@microsoft/rayfin-core';

@entity()
@authenticated('*', {
  policy: (claims, playlist) => claims.sub.eq(playlist.owner_id),
})
export class BirthdayPlaylist {
  @uuid() id!: string;
  @text({ min: 1, max: 100 }) title!: string;
  @date() createdAt!: Date;
  @text({ max: 200 }) owner_id!: string;
}
