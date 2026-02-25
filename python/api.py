import sys
import json
import os
import threading
import time
import io
import traceback
import yt_dlp
from ytmusicapi import YTMusic, OAuthCredentials
from dotenv import load_dotenv

# Force UTF-8 for communication to handle Russian text on Windows
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Load .env file
load_dotenv()

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OAUTH_FILE = os.path.join(BASE_DIR, 'oauth.json')
BROWSER_FILE = os.path.join(BASE_DIR, 'browser.json')

# Credentials from .env
CLIENT_ID = os.getenv("ClientID")
CLIENT_SECRET = os.getenv("Client_Secret")

# Region Settings for Relevance
HL = 'ru'
GL = 'BY'

# Global state
ytm = None
ytm_lock = threading.Lock()
stdout_lock = threading.Lock()

def safe_print(data):
    with stdout_lock:
        print(json.dumps(data))
        sys.stdout.flush()

def track_to_dict(t, album_name=None, album_id=None, thumb_url=None):
    try:
        vid = t.get('videoId') or t.get('id')
        if not vid:
            return None
        
        artists_data = t.get('artists', [])
        artist_names = [a.get('name', 'Unknown') for a in artists_data]
        artist_ids = [a.get('id') or a.get('browseId') for a in artists_data]

        t_album = t.get('album')
        t_album_name = ''
        t_album_id = None
        
        if isinstance(t_album, dict):
            t_album_name = t_album.get('name', '')
            t_album_id = t_album.get('id') or t_album.get('browseId')
        elif isinstance(t_album, str):
            t_album_name = t_album

        res_album_name = album_name or t_album_name
        res_album_id = album_id or t_album_id
        
        res_thumb = ''
        thumbs = t.get('thumbnails') or t.get('thumbnail')
        if thumbs:
            res_thumb = thumbs[-1].get('url')
        elif thumb_url:
            res_thumb = thumb_url
        elif isinstance(t_album, dict) and t_album.get('thumbnails'):
            res_thumb = t_album['thumbnails'][-1].get('url')

        return {
            'id': vid,
            'title': t.get('title'),
            'artists': artist_names,
            'artistIds': artist_ids,
            'album': res_album_name,
            'albumId': res_album_id,
            'duration': t.get('duration') or t.get('length') or '0:00',
            'thumbUrl': res_thumb
        }
    except Exception as e:
        print(f"Error in track_to_dict: {e}", file=sys.stderr)
        return None

def artist_to_dict(a):
    try:
        return {
            'id': a.get('browseId') or a.get('id'),
            'name': a.get('artist') or a.get('name'),
            'thumbUrl': a.get('thumbnails')[-1].get('url') if a.get('thumbnails') else ''
        }
    except Exception:
        return None

def try_load_auth():
    global ytm
    with ytm_lock:
        if ytm: return True
        if os.path.exists(BROWSER_FILE):
            try:
                print(f"Loading {BROWSER_FILE}...", file=sys.stderr)
                with open(BROWSER_FILE, 'r') as f:
                    browser_data = json.load(f)
                ytm = YTMusic(auth=browser_data, language=HL, location=GL)
                print("YTMusic initialized with browser.json", file=sys.stderr)
                return True
            except Exception as e:
                print(f"Failed to initialize with browser.json: {e}", file=sys.stderr)
                ytm = None

        if os.path.exists(OAUTH_FILE):
            try:
                print(f"Loading {OAUTH_FILE}...", file=sys.stderr)
                with open(OAUTH_FILE, 'r') as f:
                    auth_data = json.load(f)
                token_dict = {k: v for k, v in auth_data.items() if k not in ['client_id', 'client_secret']}
                if CLIENT_ID:
                    creds = OAuthCredentials(client_id=CLIENT_ID, client_secret=CLIENT_SECRET)
                    ytm = YTMusic(auth=token_dict, oauth_credentials=creds, language=HL, location=GL)
                else:
                    ytm = YTMusic(auth=token_dict, language=HL, location=GL)
                print("YTMusic initialized with oauth.json", file=sys.stderr)
                return True
            except Exception as e:
                print(f"Failed to initialize with oauth.json: {e}", file=sys.stderr)
                ytm = None
        return False

def handle_request(request):
    global ytm
    command = request.get('command')
    call_id = request.get('callId')
    
    try:
        if command == 'ping':
            safe_print({'status': 'ok', 'data': 'pong', 'callId': call_id})
        elif command == 'check_auth':
            safe_print({'status': 'ok', 'authenticated': ytm is not None, 'callId': call_id})
        
        elif command == 'get_playlists':
            if not ytm:
                safe_print({'status': 'error', 'message': 'Not authenticated', 'callId': call_id})
                return
            with ytm_lock:
                playlists = ytm.get_library_playlists(limit=100)
            formatted = []
            for p in playlists:
                formatted.append({
                    'id': p.get('playlistId'),
                    'title': p.get('title'),
                    'thumbUrl': p.get('thumbnails')[-1].get('url') if p.get('thumbnails') else '',
                    'count': p.get('count', '0')
                })
            safe_print({'status': 'ok', 'playlists': formatted, 'callId': call_id})

        elif command == 'get_liked_songs':
            if not ytm:
                safe_print({'status': 'ok', 'tracks': [], 'callId': call_id})
                return
            with ytm_lock:
                liked = ytm.get_liked_songs(limit=100)
            tracks = [track_to_dict(t) for t in liked.get('tracks', []) if track_to_dict(t)]
            safe_print({'status': 'ok', 'tracks': tracks, 'callId': call_id})

        elif command == 'get_playlist_tracks':
            playlist_id = request.get('playlistId')
            with ytm_lock:
                api = ytm if ytm else YTMusic(language=HL, location=GL)
                playlist = api.get_playlist(playlist_id, limit=100)
            tracks = [track_to_dict(t) for t in playlist.get('tracks', []) if track_to_dict(t)]
            safe_print({'status': 'ok', 'tracks': tracks, 'callId': call_id})

        elif command == 'get_search_suggestions':
            query = request.get('query')
            with ytm_lock:
                api = ytm if ytm else YTMusic(language=HL, location=GL)
                suggestions = api.get_search_suggestions(query)
            safe_print({'status': 'ok', 'suggestions': suggestions, 'callId': call_id})

        elif command == 'search':
            query = request.get('query')
            limit = request.get('limit', 20)
            with ytm_lock:
                api = ytm if ytm else YTMusic(language=HL, location=GL)
                artists = api.search(query, filter='artists', limit=5)
                songs = api.search(query, filter='songs', limit=limit)
            safe_print({
                'status': 'ok', 
                'artists': [artist_to_dict(a) for a in artists if artist_to_dict(a)],
                'tracks': [track_to_dict(s) for s in songs if track_to_dict(s)],
                'callId': call_id
            })

        elif command == 'search_more':
            query = request.get('query')
            offset = request.get('offset', 0)
            search_filter = request.get('filter', 'songs')
            limit = request.get('limit', 20)
            with ytm_lock:
                api = ytm if ytm else YTMusic(language=HL, location=GL)
                results = api.search(query, filter=search_filter, limit=offset + limit)
            more_results = results[offset:] if len(results) > offset else []
            
            if search_filter == 'artists':
                safe_print({
                    'status': 'ok', 
                    'artists': [artist_to_dict(a) for a in more_results if artist_to_dict(a)],
                    'callId': call_id
                })
            else:
                safe_print({
                    'status': 'ok', 
                    'tracks': [track_to_dict(s) for s in more_results if track_to_dict(s)],
                    'callId': call_id
                })

        elif command == 'get_artist':
            artist_id = request.get('artistId')
            with ytm_lock:
                api = ytm if ytm else YTMusic(language=HL, location=GL)
                info = api.get_artist(artist_id)
            
            top_songs = []
            songs_section = info.get('songs', {})
            if 'results' in songs_section:
                top_songs = [track_to_dict(s) for s in songs_section['results'] if track_to_dict(s)]
            
            discography = []
            def process_album_item(item, category):
                try:
                    year = item.get('year') or item.get('type') or ''
                    return {
                        'id': item.get('browseId'),
                        'title': item.get('title'),
                        'year': str(year),
                        'category': category,
                        'thumbUrl': item['thumbnails'][-1]['url'] if item.get('thumbnails') else ''
                    }
                except: return None

            def get_full_list(section_key, category):
                section = info.get(section_key, {})
                browse_id = section.get('browseId')
                params = section.get('params')
                if browse_id:
                    try:
                        with ytm_lock:
                            full_results = api.get_artist_albums(browse_id, params)
                        return [process_album_item(item, category) for item in full_results if process_album_item(item, category)]
                    except: pass
                return [process_album_item(item, category) for item in section.get('results', []) if process_album_item(item, category)]

            discography.extend(get_full_list('albums', 'Album'))
            discography.extend(get_full_list('singles', 'Single'))
            discography.sort(key=lambda x: int(''.join(filter(str.isdigit, x['year'] or '0')) or 0), reverse=True)

            related = [artist_to_dict(r) for r in info.get('related', {}).get('results', []) if artist_to_dict(r)]
            thumb = info['thumbnails'][-1]['url'] if info.get('thumbnails') else ''

            safe_print({
                'status': 'ok',
                'name': info.get('name'),
                'description': info.get('description'),
                'thumbUrl': thumb,
                'topSongs': top_songs,
                'discography': discography,
                'related': related,
                'seeAllSongsId': songs_section.get('browseId'),
                'seeAllSongsParams': songs_section.get('params'),
                'callId': call_id
            })

        elif command == 'get_user_info':
            if not ytm:
                safe_print({'status': 'error', 'message': 'Not authenticated', 'callId': call_id})
                return
            with ytm_lock:
                account = ytm.get_account_info()
            name = (account.get('accountName') or account.get('name') or account.get('userName') or "Account")
            thumb = account.get('accountPhotoUrl')
            if not thumb and account.get('thumbnails'):
                if isinstance(account['thumbnails'], list) and len(account['thumbnails']) > 0:
                    thumb = account['thumbnails'][-1].get('url')
                elif isinstance(account['thumbnails'], dict):
                    thumb = account['thumbnails'].get('url')
            safe_print({'status': 'ok', 'name': name, 'thumbUrl': thumb or '', 'callId': call_id})

        elif command == 'get_artist_songs':
            browse_id = request.get('browseId')
            params = request.get('params')
            with ytm_lock:
                api = ytm if ytm else YTMusic(language=HL, location=GL)
                if browse_id.startswith('VL') or browse_id.startswith('PL'):
                    playlist = api.get_playlist(browse_id, limit=100)
                    tracks = [track_to_dict(t) for t in playlist.get('tracks', []) if track_to_dict(t)]
                else:
                    songs = api.get_artist_albums(browse_id, params)
                    tracks = [track_to_dict(s) for s in songs if track_to_dict(s)]
            safe_print({'status': 'ok', 'tracks': tracks, 'callId': call_id})

        elif command == 'get_home':
            limit = request.get('limit', 10)
            with ytm_lock:
                api = ytm if ytm else YTMusic(language=HL, location=GL)
                home_data = api.get_home(limit=limit)
            formatted = []
            for section in home_data:
                items = []
                for item in section.get('contents', []):
                    b_id = item.get('browseId')
                    p_id = item.get('playlistId')
                    v_id = item.get('videoId')
                    res_type = item.get('type') or item.get('resultType')
                    display_type = res_type or ''
                    
                    if v_id: detected_type = 'song'
                    elif b_id:
                        if b_id.startswith('UC') or b_id.startswith('Fv'): detected_type = 'artist'
                        else: detected_type = 'album'
                    elif p_id: detected_type = 'playlist'
                    else: detected_type = res_type or 'unknown'
                    
                    nav_type = detected_type.lower() if detected_type else 'unknown'
                    if nav_type in ['ep', 'single', 'album']: nav_type = 'album'

                    if nav_type in ['song', 'video']:
                        tracks_data = track_to_dict(item)
                        if tracks_data:
                            tracks_data['type'] = nav_type
                            tracks_data['display_type'] = display_type or 'Song'
                            items.append(tracks_data)
                    elif nav_type == 'artist':
                        items.append({
                            'id': b_id,
                            'type': 'artist',
                            'display_type': 'Artist',
                            'title': item.get('title') or item.get('name'),
                            'thumbUrl': item['thumbnails'][-1]['url'] if item.get('thumbnails') else '',
                        })
                    elif nav_type == 'album':
                        items.append({
                            'id': b_id or p_id,
                            'type': 'album',
                            'display_type': display_type or 'Album',
                            'title': item.get('title'),
                            'artists': [a.get('name') for a in item.get('artists', [])] if item.get('artists') else [],
                            'thumbUrl': item['thumbnails'][-1]['url'] if item.get('thumbnails') else '',
                            'year': item.get('year')
                        })
                    elif nav_type == 'playlist':
                        items.append({
                            'id': p_id,
                            'type': 'playlist',
                            'display_type': 'Playlist',
                            'title': item.get('title'),
                            'artists': [a.get('name') for a in item.get('artists', [])] if item.get('artists') else [],
                            'thumbUrl': item['thumbnails'][-1]['url'] if item.get('thumbnails') else '',
                            'description': item.get('description')
                        })
                if items: formatted.append({'title': section.get('title'), 'contents': items})
            safe_print({'status': 'ok', 'data': formatted, 'callId': call_id})

        elif command == 'get_queue_recommendations':
            video_id = request.get('videoId')
            with ytm_lock:
                api = ytm if ytm else YTMusic(language=HL, location=GL)
                watch_data = api.get_watch_playlist(videoId=video_id, limit=20)
            tracks = [track_to_dict(t) for t in watch_data.get('tracks', []) if track_to_dict(t) and t.get('videoId') != video_id]
            safe_print({'status': 'ok', 'tracks': tracks, 'callId': call_id})

        elif command == 'logout':
            if os.path.exists(OAUTH_FILE): os.remove(OAUTH_FILE)
            if os.path.exists(BROWSER_FILE): os.remove(BROWSER_FILE)
            with ytm_lock:
                ytm = None
            safe_print({'status': 'ok', 'message': 'Logged out', 'callId': call_id})
        
        elif command == 'get_album':
            album_id = request.get('albumId')
            with ytm_lock:
                api = ytm if ytm else YTMusic(language=HL, location=GL)
                album = api.get_album(album_id)
            album_title = album.get('title')
            res_album_id = album.get('browseId') or album_id
            album_thumb = album['thumbnails'][-1]['url'] if album.get('thumbnails') else ''
            tracks = [track_to_dict(t, album_name=album_title, album_id=res_album_id, thumb_url=album_thumb) for t in album.get('tracks', []) if track_to_dict(t)]
            safe_print({
                'status': 'ok',
                'title': album_title,
                'thumbUrl': album_thumb,
                'tracks': tracks,
                'callId': call_id
            })

        elif command == 'get_stream_url':
            video_id = request.get('videoId')
            try:
                ydl_opts = {'format': 'bestaudio/best', 'quiet': True, 'no_warnings': True, 'extract_flat': False}
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                    safe_print({'status': 'ok', 'url': info['url'], 'callId': call_id})
            except Exception as e:
                traceback.print_exc()
                safe_print({'status': 'error', 'message': str(e), 'callId': call_id})

        else:
            safe_print({'status': 'error', 'message': f'Unknown command: {command}', 'callId': call_id})
            
    except Exception as e:
        traceback.print_exc()
        safe_print({'status': 'error', 'message': str(e), 'callId': call_id})

def main():
    try_load_auth()
    for line in sys.stdin:
        try:
            if not line.strip(): continue
            request = json.loads(line)
            threading.Thread(target=handle_request, args=(request,), daemon=True).start()
        except Exception as e:
            traceback.print_exc()

if __name__ == "__main__":
    main()
