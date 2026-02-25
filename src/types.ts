export type ViewType = 'liked' | 'playlist' | 'search' | 'settings' | 'auth' | 'artist' | 'album' | 'home';

export interface ActiveView {
  type: ViewType;
  playlistId?: string;
  playlistTitle?: string;
  searchQuery?: string;
  artistId?: string;
  albumId?: string;
}
