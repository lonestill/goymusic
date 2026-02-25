export interface YTMTrack {
    id: string;
    title: string;
    artists?: string[];
    artistIds?: string[];
    album: string;
    albumId?: string;
    duration: string;
    thumbUrl: string;
}

export interface YTMArtist {
    id: string;
    name: string;
    thumbUrl: string;
}

export interface YTMPlaylist {
    id: string;
    title: string;
    thumbUrl: string;
    count: string;
}

export interface YTMAlbum {
    title: string;
    thumbUrl: string;
    tracks: YTMTrack[];
}

export interface YTMUser {
    name: string;
    thumbUrl: string;
}

export interface YTMSearchResult {
    artists: YTMArtist[];
    tracks: YTMTrack[];
}

export interface YTMArtistDetail {
    name: string;
    description: string;
    thumbUrl: string;
    topSongs: YTMTrack[];
    discography: {
        id: string;
        title: string;
        year: string;
        category: string;
        thumbUrl: string;
    }[];
    related: YTMArtist[];
    seeAllSongsId?: string;
    seeAllSongsParams?: string;
    seeAllAlbumsId?: string;
    seeAllSinglesId?: string;
}

// ===== Bridge Access =====

async function pyCall(command: string, args: any = {}) {
    const callId = Math.random().toString(36).substring(7);
    const label = `[Bridge] ${command} (${callId})`;
    console.groupCollapsed(`%c${label}`, 'color: #89b4fa; font-weight: bold; font-size: 11px;');
    console.log('Arguments:', { ...args, callId });
    
    try {
        const res = await (window as any).bridge.pyCall(command, { ...args, callId });
        
        if (!res) {
            console.error('%cBRIDGE ERROR:', 'font-weight: bold; color: #f38ba8;', 'No response from bridge');
            console.groupEnd();
            return { status: 'error', message: 'No response from bridge' };
        }

        if (res.status === 'error') {
            console.error('%cPYTHON ERROR:', 'font-weight: bold; color: #f38ba8;', res.message);
            console.groupEnd();
            return res;
        }
        
        console.log('Response:', res);
        console.groupEnd();
        return res;
    } catch (e) {
        console.error('%cBRIDGE EXCEPTION:', 'font-weight: bold; color: #f38ba8;', e);
        console.groupEnd();
        return { status: 'error', message: String(e) };
    }
}

export async function isLoggedIn(): Promise<boolean> {
    try {
        const res = await pyCall('check_auth');
        return res.authenticated;
    } catch (e) {
        return false;
    }
}

export async function clearTokens() {
    await pyCall('logout');
}

export async function getLibraryPlaylists(): Promise<YTMPlaylist[]> {
    const res = await pyCall('get_playlists');
    if (res.status === 'ok') {
        return res.playlists;
    }
    return [];
}

export async function getUserInfo(): Promise<YTMUser | null> {
    console.log('[API] Requesting user info...');
    const res = await pyCall('get_user_info');
    if (res.status === 'ok') {
        console.log('[API] User info received:', res);
        return {
            name: res.name,
            thumbUrl: res.thumbUrl
        };
    }
    console.warn('[API] User info failed or empty:', res);
    return null;
}

export async function getLikedSongs(): Promise<YTMTrack[]> {
    const res = await pyCall('get_liked_songs');
    if (res.status === 'ok') {
        return res.tracks || [];
    }
    return [];
}

export async function getPlaylistTracks(playlistId: string): Promise<YTMTrack[]> {
    const res = await pyCall('get_playlist_tracks', { playlistId });
    if (res.status === 'ok') {
        return res.tracks || [];
    }
    return [];
}

export async function getAlbum(albumId: string): Promise<YTMAlbum | null> {
    const res = await pyCall('get_album', { albumId });
    if (res.status === 'ok') {
        return {
            title: res.title,
            thumbUrl: res.thumbUrl,
            tracks: res.tracks || []
        };
    }
    return null;
}

export async function searchMusic(query: string): Promise<YTMSearchResult> {
    const res = await pyCall('search', { query });
    if (res.status === 'ok') {
        return {
            artists: res.artists || [],
            tracks: res.tracks || []
        };
    }
    return { artists: [], tracks: [] };
}

export async function getSearchSuggestions(query: string): Promise<string[]> {
    const res = await pyCall('get_search_suggestions', { query });
    if (res.status === 'ok') {
        return res.suggestions || [];
    }
    return [];
}

export async function searchMore(query: string, offset: number, filter: 'songs' | 'artists' = 'songs'): Promise<any[]> {
    const res = await pyCall('search_more', { query, offset, filter });
    if (res.status === 'ok') {
        return filter === 'artists' ? (res.artists || []) : (res.tracks || []);
    }
    return [];
}

export async function getArtistDetail(artistId: string): Promise<YTMArtistDetail | null> {
    const res = await pyCall('get_artist', { artistId });
    if (res.status === 'ok') {
        return res;
    }
    return null;
}

export async function getArtistSongs(browseId: string, params?: string): Promise<YTMTrack[]> {
    const res = await pyCall('get_artist_songs', { browseId, params });
    if (res.status === 'ok') {
        return res.tracks;
    }
    return [];
}


export interface YTMHomeSection {
    title: string;
    contents: any[];
}

// ... existing interfaces ...

export async function getHome(limit: number = 10): Promise<YTMHomeSection[]> {
    const res = await pyCall('get_home', { limit });
    if (res.status === 'ok') {
        return res.data;
    }
    return [];
}

export async function getQueueRecommendations(videoId: string): Promise<YTMTrack[]> {
    const res = await pyCall('get_queue_recommendations', { videoId });
    if (res.status === 'ok') {
        return res.tracks;
    }
    return [];
}
