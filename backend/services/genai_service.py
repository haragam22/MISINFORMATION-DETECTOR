# services/genai_service.py
import os, re, json, time
import google.generativeai as genai

# Configure API
GENAI_KEY = os.getenv("GENAI_API_KEY")
if GENAI_KEY:
    genai.configure(api_key=GENAI_KEY)
else:
    print("⚠️ Warning: GENAI_API_KEY not set; genai calls will fail.")

# Choose model
ENV_MODEL = os.getenv("GENAI_MODEL", "gemini-1.5-flash")

def _parse_json_from_text(text: str):
    """Extract JSON object from model output if present."""
    m = re.search(r'\{.*\}', text, re.S)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            return None
    return None

def _generate_with_model(prompt: str, model_name: str = ENV_MODEL, max_tokens: int = 250):
    """Generate content using Gemini."""
    try:
        model = genai.GenerativeModel(model_name)
        resp = model.generate_content(prompt)
        return resp.text
    except Exception as e:
        print(f"❌ GenAI error with {model_name}: {repr(e)}")
        return None

def classify_snippet(claim: str, snippet_text: str):
    """
    Classify snippet stance relative to a claim.
    Returns dict: stance, confidence, reason
    """
    prompt = f"""You are a concise fact-check assistant.
Claim: "{claim}"
Snippet: "{snippet_text}"

Task:
1. Does the snippet SUPPORT, REFUTE, or is it NEUTRAL/UNRELATED?
2. Give confidence 0–1.
3. One-sentence reason.

Return JSON:
{{"stance":"SUPPORT","confidence":0.85,"reason":"..."}}
"""
    text = _generate_with_model(prompt)
    if not text:
        return {"stance": "NEUTRAL", "confidence": 0.0, "reason": "GenAI unavailable"}

    parsed = _parse_json_from_text(text)
    if parsed:
        return {
            "stance": parsed.get("stance", "NEUTRAL").upper(),
            "confidence": float(parsed.get("confidence", 0.0)),
            "reason": parsed.get("reason", "")
        }

    # fallback heuristics
    low = text.lower()
    if "support" in low and "refute" not in low:
        return {"stance":"SUPPORT","confidence":0.6,"reason":text[:200]}
    if "refute" in low or "deny" in low or "no evidence" in low:
        return {"stance":"REFUTE","confidence":0.6,"reason":text[:200]}
    return {"stance":"NEUTRAL","confidence":0.4,"reason":text[:200]}

def generate_verdict_and_tip(claim: str, evidence_summary: str):
    """
    Generate final verdict + confidence + education tip.
    Returns (verdict, confidence, tip)
    """
    prompt = f"""
You are a neutral fact-check assistant.
Claim: "{claim}"
Evidence summary: {evidence_summary}

Task:
1. Short verdict: Likely True / Likely False / Disputed / Uncertain
2. Confidence 0–1
3. One-line education tip (≤20 words)

Return JSON:
{{"verdict":"Likely False","confidence":0.82,"tip":"..."}}
"""
    text = _generate_with_model(prompt)
    if not text:
        return "Uncertain", 0.35, "Verify with primary sources."

    parsed = _parse_json_from_text(text)
    if parsed:
        try:
            return (
                parsed.get("verdict", "Uncertain"),
                float(parsed.get("confidence", 0.4)),
                parsed.get("tip", "Verify with official sources.")
            )
        except Exception:
            pass

    # fallback heuristics
    low = text.lower()
    if "likely true" in low:
        return "Likely True", 0.65, "Check original sources and dates."
    if "likely false" in low:
        return "Likely False", 0.75, "Check authoritative sources."
    return "Uncertain", 0.4, "Verify with primary sources."