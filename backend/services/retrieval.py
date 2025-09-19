# services/retrieval.py
import os, json

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
CANNED_PATH = os.path.join(BASE_DIR, "canned_claims.json")

def load_canned():
    with open(CANNED_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

CANNED = load_canned()

def retrieve_claim(claim_text: str):
    """Try to match claim with canned dataset (substring match)."""
    key = claim_text.strip().lower()
    for canned_claim in CANNED:
        if canned_claim in key:
            return CANNED[canned_claim]
    return None
