from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load the API key from your .env file
load_dotenv()

# 1. Initialize the FastAPI App
app = FastAPI(title="Dark Pattern API (Golden Arrows)")

# 2. Configure CORS (Crucial for Chrome Extension communication)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Configure Gemini AI (The Heavy Lifter)
API_KEY = os.getenv("GEMINI_API_KEY")
if API_KEY:
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash') 
else:
    print("WARNING: GEMINI_API_KEY not found. Check your .env file.")

# 4. Define our Data Structures
class ElementData(BaseModel):
    url: str
    text_content: str
    css_color: str
    css_font_size: str

class DetectionResult(BaseModel):
    is_dark_pattern: bool
    pattern_type: str
    explanation: str
    ccpa_violation_rule: str

# 5. The Core Endpoint
@app.post("/analyze", response_model=DetectionResult)
async def analyze_element(data: ElementData):
    try:
        # --- PHASE 1: The Custom ML CSS Check (Placeholder for later) ---
        is_suspicious_css = False 
        if "10px" in data.css_font_size and "grey" in data.css_color:
             is_suspicious_css = True

        # --- PHASE 2: Gemini API for NLP and Context ---
        prompt = f"""
        You are an expert in India's Consumer Protection Act (CCPA).
        Analyze the following text extracted from an e-commerce website: "{data.text_content}"
        
        Determine if this is a dark pattern (e.g., False Urgency, Confirm-shaming, Forced Action).
        Respond strictly with a comma-separated string in this exact format:
        IS_DARK_PATTERN (True/False) | PATTERN_TYPE | EXPLANATION | CCPA_RULE
        
        Example: True | False Urgency | The text creates fake time pressure. | Annexure 1, Section 3
        """
        
        response = model.generate_content(prompt)
        result_text = response.text.strip().split(" | ")
        
        if len(result_text) >= 4:
            return DetectionResult(
                is_dark_pattern=result_text[0].strip().lower() == 'true',
                pattern_type=result_text[1].strip(),
                explanation=result_text[2].strip(),
                ccpa_violation_rule=result_text[3].strip()
            )
        else:
             return DetectionResult(
                 is_dark_pattern=False, 
                 pattern_type="None", 
                 explanation="Analysis safe.", 
                 ccpa_violation_rule="N/A"
             )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Simple health check endpoint
@app.get("/")
def read_root():
    return {"status": "Backend is running flawlessly. Golden Arrows API is live."}