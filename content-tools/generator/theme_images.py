"""Fetch one representative theme photo from Unsplash at content-generation
time - not the client. The web app never calls Unsplash or holds an access
key; it just ships whatever image and attribution this wrote into the round
JSON, matching the "pre-generated static content" design of the rest of the
pipeline.
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

UNSPLASH_API_BASE = "https://api.unsplash.com"
APP_NAME = "wordwheel"


def _search_photo(query: str, access_key: str) -> dict | None:
    search_url = f"{UNSPLASH_API_BASE}/search/photos?query={urllib.parse.quote(query)}&per_page=1"
    search_req = urllib.request.Request(search_url, headers={"Authorization": f"Client-ID {access_key}"})
    with urllib.request.urlopen(search_req, timeout=15) as res:
        data = json.load(res)
    results = data.get("results") or []
    return results[0] if results else None


def _fetch_theme_photo(query: str, access_key: str) -> dict:
    """Search Unsplash for `query`, return the top result's image bytes +
    attribution. Unsplash's search can return zero results for an
    over-specific multi-term query (e.g. "italy tuscany venice canal" finds
    nothing despite each term individually having thousands of matches) -
    fall back to shorter prefixes of the query before giving up. Raises if
    every attempt (including just the first term) comes up empty."""
    terms = query.split()
    attempts = [query] + [" ".join(terms[:n]) for n in range(len(terms) - 1, 0, -1)]

    photo = None
    used_query = None
    for attempt in dict.fromkeys(attempts):  # dedupe, preserve order
        photo = _search_photo(attempt, access_key)
        if photo:
            used_query = attempt
            break
    if not photo:
        raise RuntimeError(f"No Unsplash results for query {query!r} (tried: {attempts})")
    if used_query != query:
        print(f"  (Unsplash query {query!r} had no results, used {used_query!r} instead)")

    with urllib.request.urlopen(photo["urls"]["regular"], timeout=30) as res:
        image_bytes = res.read()

    # Unsplash API guideline: ping download_location once when a photo is
    # actually used by the application. We bundle the image statically at
    # build time rather than fetching it per end-user, so "used" here means
    # "selected for this theme," pinged once at fetch time.
    try:
        dl_url = f"{photo['links']['download_location']}?client_id={access_key}"
        urllib.request.urlopen(urllib.request.Request(dl_url), timeout=5)
    except Exception:
        pass  # best-effort tracking ping; shouldn't block content generation

    attribution = {
        "name": photo["user"]["name"],
        "profileUrl": f"{photo['user']['links']['html']}?utm_source={APP_NAME}&utm_medium=referral",
    }
    return {"image_bytes": image_bytes, "attribution": attribution}


def ensure_theme_image(theme_id: str, query: str, access_key: str, images_dir: Path) -> dict:
    """Return {"path": "<relative path under images_dir>", "attribution": {...}}.

    Skips the network call if the image + attribution are already on disk
    (e.g. from a previous run) - the theme photo only needs fetching once
    per theme, not once per generator invocation.
    """
    images_dir.mkdir(parents=True, exist_ok=True)
    image_path = images_dir / f"{theme_id}.jpg"
    attribution_path = images_dir / f"{theme_id}.attribution.json"

    if image_path.exists() and attribution_path.exists():
        attribution = json.loads(attribution_path.read_text(encoding="utf-8"))
    else:
        result = _fetch_theme_photo(query, access_key)
        image_path.write_bytes(result["image_bytes"])
        attribution = result["attribution"]
        attribution_path.write_text(json.dumps(attribution, indent=2), encoding="utf-8")

    return {"path": f"images/{theme_id}.jpg", "attribution": attribution}
