# services/retrieval.py
import os
import requests
from typing import List, Dict

CSE_API_KEY = os.getenv("CSE_API_KEY")
CSE_ID = os.getenv("CSE_ID")

def search_custom_search(query: str, num: int = 5) -> List[Dict]:
    """
    Uses Google Custom Search JSON API.
    Returns list of dicts: {title, snippet, link, domain}
    If no key/id provided, returns empty list (caller should fallback).
    """
    if not CSE_API_KEY or not CSE_ID:
        return []
    url = "https://www.googleapis.com/customsearch/v1"
    params = {"key": CSE_API_KEY, "cx": CSE_ID, "q": query, "num": num}
    try:
        r = requests.get(url, params=params, timeout=8)
        r.raise_for_status()
        data = r.json()
        items = data.get("items", [])
        results = []
        for it in items:
            results.append({
                "title": it.get("title"),
                "snippet": it.get("snippet"),
                "link": it.get("link"),
                "domain": (it.get("displayLink") or "").lower()
            })
        return results
    except Exception as e:
        # Log and return empty so caller falls back to canned
        print("Custom Search error:", e)
        return []
