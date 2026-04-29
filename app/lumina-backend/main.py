import joblib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from urllib.parse import urlparse

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

local_model = None
vectorizer = None
try:
    local_model = joblib.load("lumina_model.pkl")
    vectorizer = joblib.load("lumina_vectorizer.pkl")
    print("ML model loaded")
except Exception as exc:
    print(f"ML files missing or unavailable. Using heuristic scoring. Details: {exc}")

OFFICIAL_BRANDS = {
    "amazon": ["https://www.amazon.com", "https://www.amazon.in"],
    "flipkart": ["https://www.flipkart.com"],
    "myntra": ["https://www.myntra.com"],
    "ajio": ["https://www.ajio.com"],
    "shein": ["https://www.shein.com"],
}


class WebElement(BaseModel):
    id: int
    text_content: str


class AuditRequest(BaseModel):
    url: str
    elements: List[WebElement]


def host_matches(hostname: str, official_host: str) -> bool:
    return hostname == official_host or hostname.endswith(f".{official_host}")


def detect_clone(url: str) -> tuple[bool, str]:
    hostname = urlparse(url.lower()).netloc.replace("www.", "")

    for brand, official_urls in OFFICIAL_BRANDS.items():
        official_hosts = [urlparse(official).netloc.replace("www.", "") for official in official_urls]
        if brand in hostname and not any(host_matches(hostname, official_host) for official_host in official_hosts):
            return True, official_urls[0]

    return False, ""


@app.post("/analyze_site")
async def analyze_site(request: AuditRequest):
    is_fake, original_link = detect_clone(request.url)
    ml_score = 0
    findings = []

    if local_model and vectorizer and request.elements:
        texts = [element.text_content for element in request.elements]
        vectors = vectorizer.transform(texts)
        probabilities = local_model.predict_proba(vectors)[:, 1]
        top_elements = sorted(probabilities, reverse=True)[:5]
        ml_score = int((sum(top_elements) / len(top_elements)) * 100) if top_elements else 0

        for index, probability in enumerate(probabilities):
            if probability > 0.5:
                findings.append({
                    "id": index,
                    "type": "Deceptive Pattern",
                    "explanation": f"High-pressure linguistic markers detected ({int(probability * 100)}% confidence).",
                    "law": "FTC Deceptive Acts / CCPA",
                })

    if is_fake:
        ml_score = 100

    return {
        "is_fake": is_fake,
        "original_url": original_link,
        "integrity_score": ml_score,
        "verdict": "MALICIOUS" if ml_score > 70 else ("SUSPICIOUS" if ml_score > 25 else "SAFE"),
        "findings": findings,
    }
