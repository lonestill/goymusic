import { invoke } from '@tauri-apps/api/core';

// ===== Auth State =====

const LOGGED_IN_KEY = 'ytm_logged_in';

export function isLoggedIn(): boolean {
    return localStorage.getItem(LOGGED_IN_KEY) === 'true';
}

export function setLoggedIn(val: boolean) {
    localStorage.setItem(LOGGED_IN_KEY, val ? 'true' : 'false');
}

export function clearTokens() {
    localStorage.removeItem(LOGGED_IN_KEY);
}

export async function restoreSession(): Promise<boolean> {
    return isLoggedIn();
}

// ===== Types =====

export interface YTMTrack {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: string;
    thumbUrl: string;
}

export interface YTMPlaylist {
    id: string;
    title: string;
    thumbUrl: string;
    count: string;
}

// ===== Thread Lock for Bridge Server =====

let isBridging = false;
const bridgeQueue: (() => void)[] = [];

async function acquireBridgeLock(): Promise<void> {
    if (!isBridging) {
        isBridging = true;
        return;
    }
    return new Promise(resolve => {
        bridgeQueue.push(resolve);
    });
}

function releaseBridgeLock() {
    if (bridgeQueue.length > 0) {
        const next = bridgeQueue.shift();
        next?.();
    } else {
        isBridging = false;
    }
}

// ===== DOM Scraping (playlists) =====

const SCRAPER_PLAYLISTS = `
    const items = document.querySelectorAll('ytmusic-two-row-item-renderer');
    const playlists = [];
    items.forEach(el => {
        const titleEl = el.querySelector('.title a, .title yt-formatted-string');
        const title = titleEl?.textContent?.trim() || '';
        
        // Get browse endpoint for playlist ID
        const link = el.querySelector('a[href*="list="]');
        let id = '';
        if (link) {
            const match = link.getAttribute('href')?.match(/list=([^&]+)/);
            if (match) id = match[1];
        }
        // Fallback: try nav endpoint from the data
        if (!id) {
            const a = el.querySelector('.title a');
            const href = a?.getAttribute('href') || '';
            const m = href.match(/list=([^&]+)/) || href.match(/browse\\/VL(.+)/);
            if (m) id = m[1];
        }
        
        const subtitle = el.querySelector('.subtitle yt-formatted-string, .subtitle a')?.textContent?.trim() || '';
        const thumb = el.querySelector('img')?.src || '';
        
        if (title) {
            playlists.push({ id, title, thumbUrl: thumb, count: subtitle });
        }
    });
    return playlists;
`;

export async function getLibraryPlaylists(): Promise<YTMPlaylist[]> {
    await acquireBridgeLock();
    try {
        console.log('>>> getLibraryPlaylists via DOM scrape');
        const res: any = await invoke('ytm_scrape', {
            url: 'https://music.youtube.com/library/playlists',
            scraperJs: SCRAPER_PLAYLISTS
        });
        console.log('Scraped playlists:', res);
        return res || [];
    } catch (e) {
        console.error('getLibraryPlaylists error', e);
        return [];
    } finally {
        releaseBridgeLock();
    }
}

// ===== Innertube API via webview (tracks — avoids scroll issues) =====

const YTM_CONTEXT = {
    client: {
        clientName: 'WEB_REMIX',
        clientVersion: '1.20260218.03.00',
    }
};

function extractText(obj: any): string {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    if (obj.runs) return obj.runs.map((r: any) => r.text).join('');
    if (obj.simpleText) return obj.simpleText;
    return '';
}

function getBestThumb(thumbs: any[]): string {
    if (!thumbs?.length) return '';
    return thumbs[thumbs.length - 1]?.url || thumbs[0]?.url || '';
}

async function ytmFetch(endpoint: string, body: object): Promise<any> {
    await acquireBridgeLock();
    try {
        const bodyJson = JSON.stringify(body);
        return await invoke('ytm_webview_request', { endpoint, bodyJson });
    } finally {
        releaseBridgeLock();
    }
}

export async function getLikedSongs(): Promise<YTMTrack[]> {
    return getPlaylistTracks('LM');
}

export async function getPlaylistTracks(playlistId: string): Promise<YTMTrack[]> {
    try {
        console.log('>>> getPlaylistTracks via webview fetch:', playlistId);
        const bid = playlistId.startsWith('VL') ? playlistId : `VL${playlistId}`;
        const res = await ytmFetch('browse', {
            context: YTM_CONTEXT,
            browseId: bid
        });

        const tracks: YTMTrack[] = [];

        // Find the playlist shelf
        const shelf =
            res?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
                ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
                ?.musicPlaylistShelfRenderer ||
            res?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents
                ?.sectionListRenderer?.contents?.[0]
                ?.musicPlaylistShelfRenderer;

        if (shelf?.contents) {
            parseTracks(shelf.contents, tracks);
        }

        // Handle continuation (pagination)
        let continuation = shelf?.continuations?.[0]?.nextContinuationData?.continuation;
        if (!continuation && shelf?.contents) {
            const lastItem = shelf.contents[shelf.contents.length - 1];
            if (lastItem?.continuationItemRenderer) {
                continuation = lastItem.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token
                    || lastItem.continuationItemRenderer?.nextContinuationData?.continuation;
            }
        }
        let page = 1;

        while (continuation) {
            console.log(`Loading page ${++page}... (${tracks.length} tracks so far), token: ${continuation.substring(0, 10)}...`);
            const contRes = await ytmFetch('browse', {
                context: YTM_CONTEXT,
                continuation
            });

            let contContents: any[] = [];
            let nextContinuation: string | undefined = undefined;

            if (contRes?.continuationContents) {
                const cc = contRes.continuationContents;
                const shelfCont = cc.musicPlaylistShelfContinuation || cc.musicShelfContinuation || cc.sectionListContinuation;
                if (shelfCont) {
                    contContents = shelfCont.contents || [];
                    nextContinuation = shelfCont.continuations?.[0]?.nextContinuationData?.continuation;
                }
            } else if (contRes?.onResponseReceivedActions) {
                for (const action of contRes.onResponseReceivedActions) {
                    if (action.appendContinuationItemsAction?.continuationItems) {
                        const items = action.appendContinuationItemsAction.continuationItems;
                        // The continuation token is usually an item of type continuationItemRenderer
                        const contRenderer = items.find((i: any) => i.continuationItemRenderer);
                        if (contRenderer) {
                            nextContinuation = contRenderer.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token
                                || contRenderer.continuationItemRenderer?.nextContinuationData?.continuation;
                        }
                        contContents = items.filter((i: any) => !i.continuationItemRenderer);
                    }
                }
            } else if (contRes?.onResponseReceivedEndpoints) {
                // some edge cases load it here
                const endpoint = contRes.onResponseReceivedEndpoints[0];
                const items = endpoint?.appendContinuationItemsAction?.continuationItems || [];
                const contRenderer = items.find((i: any) => i.continuationItemRenderer);
                if (contRenderer) {
                    nextContinuation = contRenderer.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token
                        || contRenderer.continuationItemRenderer?.nextContinuationData?.continuation;
                }
                contContents = items.filter((i: any) => !i.continuationItemRenderer);
            }

            if (contContents.length > 0) {
                parseTracks(contContents, tracks);
            }

            if (!nextContinuation || nextContinuation === continuation) break;
            continuation = nextContinuation;
        }

        console.log(`Loaded ${tracks.length} tracks total`);
        return tracks;
    } catch (e) {
        console.error('getPlaylistTracks error', e);
        return [];
    }
}

function parseTracks(contents: any[], tracks: YTMTrack[]) {
    for (const item of contents) {
        const renderer = item?.musicResponsiveListItemRenderer;
        if (!renderer) continue;

        const flexCols = renderer.flexColumns || [];
        const title = extractText(flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text);
        if (!title || title === 'Song deleted') continue;

        let videoId = '';
        const playNav = renderer.overlay?.musicItemThumbnailOverlayRenderer?.content
            ?.musicPlayButtonRenderer?.playNavigationEndpoint;
        if (playNav?.watchEndpoint?.videoId) {
            videoId = playNav.watchEndpoint.videoId;
        }
        if (!videoId) continue;

        const artistText = extractText(flexCols[1]?.musicResponsiveListItemFlexColumnRenderer?.text);
        const parts = artistText.split(' \u2022 ');
        const artist = parts[0] || '';
        const album = parts.length > 1 ? parts[parts.length - 1] : '';

        const fixedCols = renderer.fixedColumns || [];
        const duration = extractText(fixedCols[0]?.musicResponsiveListItemFixedColumnRenderer?.text);
        const thumbs = renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];

        tracks.push({ id: videoId, title, artist, album, duration, thumbUrl: getBestThumb(thumbs) });
    }
}

export async function searchMusic(query: string): Promise<YTMTrack[]> {
    try {
        const res = await ytmFetch('search', {
            context: YTM_CONTEXT,
            query,
            params: 'EgWKAQIIAWoMEAMQBBAJEA4QChAF'
        });

        const tracks: YTMTrack[] = [];
        const sections = res?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]
            ?.tabRenderer?.content?.sectionListRenderer?.contents || [];

        for (const section of sections) {
            const items = section?.musicShelfRenderer?.contents || [];
            for (const item of items) {
                const renderer = item?.musicResponsiveListItemRenderer;
                if (!renderer) continue;

                const flexCols = renderer.flexColumns || [];
                const title = extractText(flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text);

                let videoId = '';
                const playNav = renderer.overlay?.musicItemThumbnailOverlayRenderer?.content
                    ?.musicPlayButtonRenderer?.playNavigationEndpoint;
                if (playNav?.watchEndpoint?.videoId) {
                    videoId = playNav.watchEndpoint.videoId;
                }
                if (!videoId) continue;

                const artistText = extractText(flexCols[1]?.musicResponsiveListItemFlexColumnRenderer?.text);
                const parts = artistText.split(' \u2022 ');
                const artist = parts[0] || '';
                const album = parts.length > 2 ? parts[2] : '';
                const duration = parts.length > 1 ? parts[parts.length - 1] : '';

                const thumbs = renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];

                tracks.push({ id: videoId, title, artist, album, duration, thumbUrl: getBestThumb(thumbs) });
            }
        }
        return tracks;
    } catch (e) {
        console.error('searchMusic error', e);
        return [];
    }
}
