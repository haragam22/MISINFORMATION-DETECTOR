# main.py
import os, json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# load .env
basedir = os.path.dirname(__file__)
dotenv_path = os.path.join(basedir, ".env")
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)

from services.retrieval import search_custom_search
from services.genai_service import classify_snippet, generate_verdict_and_tip
from services.scoring import aggregate

# canned fallback
CANNED_PATH = os.path.join(basedir, "canned_claims.json")
with open(CANNED_PATH, "r", encoding="utf-8") as f:
    CANNED = json.load(f)

app = FastAPI(title="TruthLens - GenAI backend (demo)")

# allow extension & local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # for local dev / hackathon; restrict in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ClaimIn(BaseModel):
    claim: str
    is_page: bool = False

@app.post("/verify")
def verify(input: ClaimIn):
    claim = (input.claim or "").strip()
    if not claim:
        raise HTTPException(status_code=400, detail="claim is empty")

    # 1) canned fallback (substring match)
    lower = claim.lower()
    for k in CANNED:
        if k in lower:
            obj = CANNED[k]
            return {
                "verdict": obj.get("verdict"),
                "confidence": float(obj.get("confidence", 0.5)),
                "evidence": obj.get("evidence", []),
                "signals": obj.get("signals", {}),
                "education_tip": obj.get("education_tip", "")
            }

    # 2) live retrieval via Custom Search
    results = search_custom_search(claim, num=5)
    if not results:
        # fallback uncertain
        return {"verdict":"Uncertain", "confidence":0.35, "evidence":[], "signals":{}, "education_tip":"No strong evidence found. Verify with primary sources."}

    # 3) classify each snippet using GenAI
    evidence_list = []
    summary_lines = []
    for r in results:
        snippet_text = (r.get("title") or "") + " — " + (r.get("snippet") or "")
        gen = classify_snippet(claim, snippet_text)
        ev = {
            "text": snippet_text,
            "link": r.get("link"),
            "domain": r.get("domain"),
            "stance": gen.get("stance","NEUTRAL"),
            "stance_confidence": float(gen.get("confidence",0.0)),
            "reason": gen.get("reason","")
        }
        evidence_list.append(ev)
        summary_lines.append(f"{ev['domain']}:{ev['stance']}({round(ev['stance_confidence'],2)})")

    # 4) aggregate signals & score
    signals, score = aggregate(evidence_list)

    # 5) ask GenAI for final verdict & short tip based on summary
    agg_summary = "; ".join(summary_lines[:6])
    verdict_text, gen_conf, tip = generate_verdict_and_tip(claim, agg_summary)
    try:
        gen_conf = float(gen_conf)
    except:
        gen_conf = 0.4
    combined_confidence = round((score + gen_conf) / 2.0, 3)

    return {
        "verdict": verdict_text,
        "confidence": combined_confidence,
        "evidence": evidence_list[:3],
        "signals": signals,
        "education_tip": tip
    }

@app.get("/")
def root():
    return {"msg":"TruthLens GenAI backend running"}
