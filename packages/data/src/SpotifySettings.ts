import { authenticated, entity, text, uuid } from '@microsoft/rayfin-core';

@entity()
@authenticated('*', {
  policy: (claims, settings) => claims.sub.eq(settings.owner_id),
})
export class SpotifySettings {
  @uuid() id!: string;
  @text({ min: 32, max: 32 }) clientId!: string;
  @text({ max: 200 }) owner_id!: string;
}
