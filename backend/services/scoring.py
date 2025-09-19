# services/scoring.py
def build_response(canned_obj: dict):
    """Return properly formatted response from canned claim object."""
    return {
        "verdict": canned_obj.get("verdict", "Uncertain"),
        "confidence": float(canned_obj.get("confidence", 0.5)),
        "evidence": canned_obj.get("evidence", []),
        "signals": canned_obj.get("signals", {}),
        "education_tip": canned_obj.get("education_tip", "Cross-check with multiple reliable sources.")
    }

def fallback_uncertain(claim: str):
    """Return uncertain verdict when no evidence is found."""
    return {
        "verdict": "Uncertain",
        "confidence": 0.35,
        "evidence": [],
        "signals": {"SR":0,"CC":0,"SM":0,"EQ":0,"TC":0},
        "education_tip": "No strong evidence found — verify with official sources."
    }
