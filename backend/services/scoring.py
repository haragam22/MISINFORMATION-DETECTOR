# services/scoring.py
TRUSTED_DOMAINS = [
    "who.int","cdc.gov","reuters.com","bbc.co.uk","bbc.com",
    "thehindu.com","nasa.gov","pubmed.ncbi.nlm.nih.gov","factcheck.org",
    "politifact.com","snopes.com"
]

def source_reliability(domain: str) -> float:
    if not domain:
        return 0.4
    d = domain.lower()
    for trusted in TRUSTED_DOMAINS:
        if trusted in d:
            return 0.9
    # heuristic: short domains / well-formed -> medium
    return 0.45

def aggregate(evidence_list):
    """
    evidence_list: list of dicts: {domain, stance, stance_confidence}
    Returns signals dict and overall score [0..1]
    """
    if not evidence_list:
        return {"SR":0.0,"CC":0.0,"SM":0.5,"EQ":0.0}, 0.35

    sr_vals = [source_reliability(e.get("domain")) for e in evidence_list]
    SR = sum(sr_vals)/len(sr_vals)

    # Corroboration: number of distinct domains that are relevant (support/refute)
    relevant_domains = set([e.get("domain") for e in evidence_list if e.get("stance","NEUTRAL").upper() in ("SUPPORT","REFUTE")])
    CC = min(1.0, len(relevant_domains)/3.0)

    # stance mapping: SUPPORT=+1, REFUTE=-1, NEUTRAL=0; weighted by confidence
    sm_vals = []
    for e in evidence_list:
        s = (e.get("stance") or "NEUTRAL").upper()
        conf = float(e.get("stance_confidence", 0.5))
        val = 0
        if s == "SUPPORT": val = 1 * conf
        elif s == "REFUTE": val = -1 * conf
        sm_vals.append(val)
    SM_raw = sum(sm_vals) / len(evidence_list)
    # map -1..1 to 0..1 where 0.5 neutral
    SM = 0.5 + (SM_raw / 2.0)

    EQ = sum(sr_vals)/len(sr_vals)

    # Weighted combination
    weights = {"SR":0.30, "SM":0.30, "CC":0.20, "EQ":0.20}
    score = SR*weights["SR"] + SM*weights["SM"] + CC*weights["CC"] + EQ*weights["EQ"]
    score = max(0.0, min(1.0, score))
    signals = {"SR":round(SR,2), "CC":round(CC,2), "SM":round(SM,2), "EQ":round(EQ,2)}
    return signals, score
