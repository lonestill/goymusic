import json
import os
import sys
from ytmusicapi import YTMusic

# Load auth if available
AUTH_FILE = 'browser.json'
HL = 'ru'
GL = 'BY'

def test_artist_details():
    print(f"--- YTM Artist Details Diagnostic ({HL}/{GL}) ---")
    try:
        if os.path.exists(AUTH_FILE):
            with open(AUTH_FILE, 'r') as f:
                auth_data = json.load(f)
            api = YTMusic(auth=auth_data, language=HL, location=GL)
        else:
            api = YTMusic(language=HL, location=GL)

        # Pharaoh or Oasis
        artist_id = "UCu7yYcX_wIZgG9azR3PqrxA" # Noel Gallagher (Oasis related usually has lots of data)
        print(f"Fetching details for ID: {artist_id}...")
        
        info = api.get_artist(artist_id)
        
        # Log keys
        print(f"Available keys: {list(info.keys())}")
        
        if 'songs' in info:
            print(f"Songs keys: {list(info['songs'].keys())}")
            if 'browseId' in info['songs']:
                print(f"Songs BrowseId (See all): {info['songs']['browseId']}")
        
        if 'albums' in info:
            print(f"Albums found: {len(info['albums'].get('results', []))}")
            if 'browseId' in info['albums']:
                print(f"Albums BrowseId (See all): {info['albums']['browseId']}")

        if 'singles' in info:
            print(f"Singles found: {len(info['singles'].get('results', []))}")
            if 'browseId' in info['singles']:
                print(f"Singles BrowseId (See all): {info['singles']['browseId']}")

        if 'related' in info:
            print(f"Related artists found: {len(info['related'].get('results', []))}")

        # Save sample to file for inspection
        with open('artist_sample.json', 'w', encoding='utf-8') as f:
            json.dump(info, f, indent=4, ensure_ascii=False)
        
        print("Done. Sample saved to artist_sample.json")

    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    test_artist_details()
