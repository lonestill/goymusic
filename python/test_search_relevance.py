import json
import os
import sys
from ytmusicapi import YTMusic

# We will test search with different language/location settings
AUTH_FILE = 'browser.json'

def test_search_relevance():
    print("--- YTM Search Relevance Test ---")
    try:
        if os.path.exists(AUTH_FILE):
            with open(AUTH_FILE, 'r') as f:
                auth_data = json.load(f)
            # Default init
            ytm_default = YTMusic(auth=auth_data)
            # Russian init
            ytm_ru = YTMusic(auth=auth_data, language='ru', location='BY') # Adjust location as needed
            print("Using browser.json for test.")
        else:
            ytm_default = YTMusic()
            ytm_ru = YTMusic(language='ru', location='BY')
            print("Using guest mode for test.")

        queries = ["декма", "флешгроб"]
        
        for q in queries:
            print(f"\nQUERY: {q}")
            
            print("  [DEFAULT SETTINGS]")
            res_def = ytm_default.search(q, limit=3)
            for i, r in enumerate(res_def):
                artist = r.get('artists', [{'name':'Unknown'}])[0]['name']
                print(f"    {i+1}. {r.get('title')} - {artist}")
            
            print("  [RU/BY SETTINGS]")
            res_ru = ytm_ru.search(q, limit=3)
            for i, r in enumerate(res_ru):
                artist = r.get('artists', [{'name':'Unknown'}])[0]['name']
                print(f"    {i+1}. {r.get('title')} - {artist}")

    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    test_search_relevance()
