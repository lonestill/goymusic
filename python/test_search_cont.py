import json
import os
import sys
from ytmusicapi import YTMusic

# Settings match our api.py
HL = 'ru'
GL = 'BY'
AUTH_FILE = 'browser.json'

def run_diagnostic_search():
    print(f"--- Search Relevance Diagnostic (Region: {HL}/{GL}) ---")
    
    try:
        # Load auth if available
        if os.path.exists(AUTH_FILE):
            with open(AUTH_FILE, 'r') as f:
                auth_data = json.load(f)
            api = YTMusic(auth=auth_data, language=HL, location=GL)
            print("Using authenticated session.")
        else:
            api = YTMusic(language=HL, location=GL)
            print("Using guest session.")

        queries = ["декма", "флешгроб"]
        log_data = []

        for q in queries:
            print(f"Searching for: {q}...")
            # We fetch exactly what MainView does: separate artists and songs
            artists = api.search(q, filter='artists', limit=5)
            songs = api.search(q, filter='songs', limit=20)
            
            query_log = {
                "query": q,
                "artists_returned": [
                    {"name": a.get('artist') or a.get('name'), "id": a.get('browseId')} 
                    for a in artists
                ],
                "songs_returned": [
                    {
                        "title": s.get('title'), 
                        "artist": s.get('artists')[0].get('name') if s.get('artists') else 'Unknown',
                        "id": s.get('videoId')
                    } 
                    for s in songs
                ]
            }
            log_data.append(query_log)
            
            print(f"  Found {len(artists)} artists and {len(songs)} songs.")
            if songs:
                artist_name = songs[0].get('artists', [{'name':'Unknown'}])[0]['name']
                print(f"  Top result: {songs[0].get('title')} by {artist_name}")

        # Write to file
        with open('search_results_log.json', 'w', encoding='utf-8') as f:
            json.dump(log_data, f, indent=4, ensure_ascii=False)
        
        print("\nSUCCESS! Results logged to search_results_log.json")

    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    run_diagnostic_search()
