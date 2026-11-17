export interface BirthdayPlaylistRecord {
  id: string;
  title: string;
  createdAt: Date;
  owner_id: string;
}

export interface PlaylistSongRecord {
  id: string;
  playlist_id: string;
  spotifyUri: string;
  title: string;
  artist: string;
  album: string;
  coverUrl?: string | null;
  addedAt: Date;
  owner_id: string;
}

export type UniversalAppSchema = {
  BirthdayPlaylist: BirthdayPlaylistRecord;
  PlaylistSong: PlaylistSongRecord;
};
