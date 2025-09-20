# 📰 TruthLens — Misinformation Detector & Educator (MVP)

**TruthLens** is a hackathon prototype that empowers users to fight misinformation online.  
With a simple Chrome extension and a FastAPI backend, users can **highlight text or scan a full page** to instantly receive:

- ✅ A **verdict** (Likely True / False / Disputed / Uncertain)  
- 📊 A **confidence score**  
- 🔗 **Top 3 evidence snippets** with clickable sources  
- 🧾 A **transparency panel** showing signal scores  
- 🎓 A short **education tip** on spotting misinformation  

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔍 **Right-Click Fact-Check** | Highlight text → right-click → “Check Claim with TruthLens” |
| 🖼️ **Popup UI Fact-Check** | Paste text or click **Check Full Page** to analyze entire articles |
| 📊 **Explainable Verdicts** | Verdict + confidence score + evidence list |
| 📚 **Transparency Panel** | Displays reliability, corroboration, and other signals |
| 🎓 **Educational Nudges** | One-line tips teaching users how to spot misinformation |
| 🛡️ **Canned Claims Fallback** | 3 preloaded claims ensure a smooth demo even offline |

---

## 📂 Project Structure

```bash
truthlens/
├── backend/ # FastAPI backend
│ ├── main.py
│ ├── services/
│ │ ├── retrieval.py # retrieval logic (canned + extendable to APIs)
│ │ ├── scoring.py # verdict aggregation & fallback
│ │ └── education.py # education tip generator
│ ├── canned_claims.json # sample claims for hackathon demo
│ ├── requirements.txt
│ └── run_local.sh
└── extension/ # Chrome extension
├── manifest.json
├── background.js
├── content_script.js
├── popup.html
├── popup.css
├── popup.js
└── icons/
├── icon16.png
├── icon48.png
└── icon128.png


```

## 🚀 Getting Started

### 1. Backend Setup (FastAPI)

```bash
    cd backend
    python -m venv .venv
    source .venv/bin/activate        # Windows: .venv\Scripts\activate
    pip install -r requirements.txt
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Server will run at:

API → http://localhost:8000/verify

Docs → http://localhost:8000/docs

### 2. Extension Setup (Chrome)

Open Chrome → go to chrome://extensions/.

Enable Developer mode (top-right toggle).

Click Load unpacked and select the extension/ folder.

You will now see the TruthLens icon in your extensions toolbar.



### 🔎 Usage
- Right-Click Flow

- Highlight any text on a webpage.

- Right-click → Check Claim with TruthLens.

- Popup opens with verdict + evidence.

- Popup Flow

- Click the TruthLens icon in toolbar.

- Paste text OR click Check Full Page.

- See verdict, confidence, evidence, and education tip.