import json
import os
import sys
from ytmusicapi import YTMusic

# We will use the browser.json if it exists, otherwise guest
AUTH_FILE = 'browser.json'

def test_search():
    print("--- YTM ArtistId Extraction Test ---")
    try:
        if os.path.exists(AUTH_FILE):
            with open(AUTH_FILE, 'r') as f:
                auth_data = json.load(f)
            ytm = YTMusic(auth=auth_data)
            print("Using browser.json for test.")
        else:
            ytm = YTMusic()
            print("Using guest mode for test.")

        query = "Oasis Wonderwall"
        print(f"Searching for: {query}")
        results = ytm.search(query, filter='songs', limit=5)
        
        for i, t in enumerate(results):
            title = t.get('title')
            artists = t.get('artists', [])
            artist_name = artists[0].get('name') if artists else 'Unknown'
            artist_id = artists[0].get('browseId') if artists else None
            
            print(f"[{i+1}] {title} - {artist_name} (ID: {artist_id})")
            
            if not artist_id:
                print(f"  WARNING: Missing browseId for {title}!")
                # Debug the full artist dict
                if artists:
                    print(f"  Artist Dict: {artists[0]}")

    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    test_search()
