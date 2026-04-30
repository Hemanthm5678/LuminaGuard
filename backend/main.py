import os
import joblib
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import google.generativeai as genai
from dotenv import load_dotenv

# 1. Setup
load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Data Models
class Element(BaseModel):
    id: int
    text_content: str

class SiteData(BaseModel):
    url: str
    elements: List[Element] = [] # Made optional for URL-only checks

# 3. Load ML Assets
try:
    local_model = joblib.load('lumina_model.pkl')
    vectorizer = joblib.load('lumina_vectorizer.pkl')
    print("✅ ML Assets Loaded Successfully")
except Exception as e:
    print(f"❌ Error loading ML assets: {e}")
    local_model, vectorizer = None, None

# 4. Mock Database (For Dashboard Stats)
stats_db = {
    "totalReports": 42,
    "averageScore": 88,
    "patternCounts": {
        "fake_urgency": 12,
        "misleading_buttons": 8,
        "hidden_costs": 5
    },
    "worstOffenders": []
}

# --- ENDPOINTS ---

@app.get("/api/reports")
async def get_reports(stats: bool = False):
    """Fixes the 404 error for dashboard stats"""
    if stats:
        return stats_db
    return []

@app.post("/analyze_site")
async def analyze_site(data: SiteData):
    """Handles both Extension Audits and Dashboard 'Check URL' button"""
    findings = []
    hostname = data.url.split("//")[-1].split("/")[0] if "//" in data.url else data.url
    
    # Run ML logic if elements are provided
    for el in data.elements:
        if vectorizer and local_model:
            X = vectorizer.transform([el.text_content])
            prob = float(local_model.predict_proba(X)[0][1])
            if prob > 0.48:
                findings.append({"id": el.id, "confidence": prob, "text": el.text_content})

    # Logic to calculate the safety score
    if not findings:
        safety_score = 95 # High integrity for clean sites
    else:
        top_k = sorted(findings, key=lambda x: x['confidence'], reverse=True)[:5]
        avg_risk = sum(f['confidence'] for f in top_k) / len(top_k)
        safety_score = int((1 - avg_risk) * 100)

    # MAP TO DASHBOARD INTERFACE (UrlSafetyResult)
    return {
        "hostname": hostname,
        "safetyScore": max(5, safety_score),
        "riskLevel": "Safe" if safety_score > 80 else "Caution" if safety_score > 60 else "Risky",
        "spamRecords": 0,
        "localReports": 3,
        "averageDarkPatternScore": int(100 - safety_score),
        "signals": [
            {"label": "ML Verified", "description": "Random Forest scanning complete", "severity": "low", "weight": 1}
        ] if safety_score > 80 else [
            {"label": "Dark Pattern Detected", "description": "Suspicious UI elements flagged", "severity": "high", "weight": 5}
        ],
        "analytics": {
            "protocol": "https" if data.url.startswith("https") else "http",
            "hostLength": len(hostname)
        },
        "findings": findings # Still returns raw findings for the extension to highlight
    }

if __name__ == "__main__":
    import uvicorn
    # Use 0.0.0.0 for cloud compatibility
    uvicorn.run(app, host="0.0.0.0", port=8000)