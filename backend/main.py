# main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .services.retrieval import retrieve_claim
from .services.scoring import build_response, fallback_uncertain
from .services.education import generate_tip

app = FastAPI(title="TruthLens Backend MVP")

# Allow extension/frontend to call API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # for demo; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ClaimIn(BaseModel):
    claim: str
    is_page: bool = False

@app.post("/verify")
def verify_claim(input: ClaimIn):
    claim = input.claim.strip()
    if not claim:
        raise HTTPException(status_code=400, detail="Claim is empty")

    # 1) Try to retrieve from canned
    canned = retrieve_claim(claim)
    if canned:
        resp = build_response(canned)
        if not resp.get("education_tip"):
            resp["education_tip"] = generate_tip(resp["signals"])
        return resp

    # 2) Fallback uncertain
    return fallback_uncertain(claim)

@app.get("/")
def root():
    return {"msg": "TruthLens backend running. Use POST /verify"}
