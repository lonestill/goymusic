import json
import os
import sys
from ytmusicapi import YTMusic

# Let's see what exactly is happening with headers vs clean init
AUTH_FILE = 'browser.json'

def test_search_advanced():
    print("--- YTM Advanced Search Diagnostic ---")
    
    # Queries to test
    queries = ["декма", "флешгроб"]
    
    # 1. Clean Guest (no cookies, no hl/gl)
    print("\n--- TEST 1: CLEAN GUEST (No Cookies, No HL/GL) ---")
    ytm1 = YTMusic()
    for q in queries:
        res = ytm1.search(q, limit=3)
        print(f"Query [{q}]:")
        for i, r in enumerate(res):
            artist = r.get('artists', [{'name':'Unknown'}])[0]['name']
            print(f"  {i+1}. {r.get('title')} - {artist}")

    # 2. Authenticated (with browser.json)
    if os.path.exists(AUTH_FILE):
        print("\n--- TEST 2: AUTHENTICATED (With browser.json) ---")
        with open(AUTH_FILE, 'r') as f:
            auth_data = json.load(f)
        ytm2 = YTMusic(auth=auth_data)
        for q in queries:
            res = ytm2.search(q, limit=3)
            print(f"Query [{q}]:")
            for i, r in enumerate(res):
                artist = r.get('artists', [{'name':'Unknown'}])[0]['name']
                print(f"  {i+1}. {r.get('title')} - {artist}")

    # 3. Clean Guest with HL/GL
    print("\n--- TEST 3: GUEST + HL=ru, GL=BY ---")
    ytm3 = YTMusic(language='ru', location='BY')
    for q in queries:
        res = ytm3.search(q, limit=3)
        print(f"Query [{q}]:")
        for i, r in enumerate(res):
            artist = r.get('artists', [{'name':'Unknown'}])[0]['name']
            print(f"  {i+1}. {r.get('title')} - {artist}")

if __name__ == "__main__":
    test_search_advanced()
