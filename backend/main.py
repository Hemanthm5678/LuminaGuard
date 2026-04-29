import os
import json
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import google.generativeai as genai
from dotenv import load_dotenv

# 1. Initialize Environment and App
load_dotenv()
app = FastAPI()

# 2. THE CORS FIX (CRITICAL)
# This allows the extension to talk to the backend from any website.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. DATA MODELS
class Element(BaseModel):
    id: int
    text_content: str

class SiteData(BaseModel):
    url: str
    elements: List[Element]

# 4. LOAD ML ASSETS
try:
    # These must be in the same folder as main.py on your E: drive
    local_model = joblib.load('lumina_model.pkl')
    vectorizer = joblib.load('lumina_vectorizer.pkl')
    print("✅ ML Assets Loaded Successfully")
except Exception as e:
    print(f"❌ Error loading ML assets: {e}")
    local_model, vectorizer = None, None

# 5. GEMINI CONFIG (For later use)
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
gemini_model = genai.GenerativeModel('gemini-pro')

# --- THE PERMANENT SCORING LOGIC ---
@app.post("/analyze_site")
async def analyze_site(data: SiteData):
    findings = []
    
    # ML Prediction Loop
    for el in data.elements:
        X = vectorizer.transform([el.text_content])
        prob = float(local_model.predict_proba(X)[0][1])
        if prob > 0.48: # Threshold
            findings.append({"id": el.id, "confidence": prob})

    # FIX: If no findings, the site is 100% INTEGRITY (Safe)
    if not findings:
        return {
            "integrity_score": 100, 
            "verdict": "SECURE", 
            "findings": []
        }

    # Top-K Calculation (Prevents dilution)
    top_k = sorted(findings, key=lambda x: x['confidence'], reverse=True)[:5]
    avg_risk = sum(f['confidence'] for f in top_k) / len(top_k)
    
    # Final Integrity Score
    integrity_score = int((1 - avg_risk) * 100)

    return {
        "integrity_score": max(5, integrity_score), # Never show 0 unless it's a total scam
        "verdict": "SUSPICIOUS" if integrity_score < 80 else "SECURE",
        "findings": findings
    }
# 7. START SERVER
if __name__ == "__main__":
    import uvicorn
    # This runs the backend on Port 8000
    uvicorn.run(app, host="127.0.0.1", port=8000)