from google import genai
import logging
import os
from dotenv import load_dotenv
from groq import Groq

logger = logging.getLogger("RetinaX")

# Load environment variables (API Keys, etc)
load_dotenv()

def generate_clinical_report(disease, severity, confidence, impact_percentage, age, gender, modality="OCT"):
    """
    Passes the strict OpenCV analytics and cascaded hybrid model outputs into an LLM
    to generate a 1-paragraph medical justification report including demographics.
    Primary: Proprietary Clinical Engine (Primary)
    Secondary: Auxiliary Clinical Engine (Secondary)

    Args:
        modality: "OCT" or "Fundus" — adjusts clinical language appropriately.
    """
    modality_desc = "OCT B-scan" if modality == "OCT" else "Fundus photograph"
    prompt = (
        f"Act as an experienced Ophthalmologist writing a patient chart summary. "
        f"Patient Context: {age}-year-old {gender}. "
        f"Imaging Modality: {modality_desc}. "
        f"The AI system has detected the following: "
        f"Base Disease: {disease}, Stage/Severity: {severity}, "
        f"Neural Confidence: {confidence:.2f}%, "
        f"Anatomical Anomaly Coverage (from Saliency extraction): {impact_percentage:.2f}% of the physical retina. "
        f"Write a single, highly professional 4-5 sentence medical summary. "
        f"Explain what these numbers mean structurally for this specific patient (considering their age and gender). "
        f"Recommend the standard next clinical step for this disease/severity. "
        f"Keep it strictly professional and clinical. No pleasantries."
    )

    # 1. ATTEMPT PRIMARY LLM ENGINE
    primary_key = os.environ.get("GEMINI_API_KEY")
    if primary_key:
        try:
            client = genai.Client(api_key=primary_key)
            response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
            return response.text.replace("*", "").strip()
        except Exception as e:
            logger.warning(f"LLM fallback     │ Primary → Secondary expert ({str(e)[:80]})")
    
    # 2. ATTEMPT SECONDARY LLM ENGINE (AUXILIARY)
    secondary_key = os.environ.get("GROQ_API_KEY")
    if secondary_key and "PASTE" not in secondary_key:
        try:
            client = Groq(api_key=secondary_key)
            chat_completion = client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.3-70b-versatile",
            )
            return chat_completion.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"LLM fallback     │ Secondary expert failed ({str(e)[:80]})")

    # 3. FINAL FALLBACK: MOCK REPORT
    modality_label = "OCT scan" if modality == "OCT" else "Fundus photograph"
    return (f"[MOCK AI REPORT]: The {modality_label} classification algorithm detects {severity} {disease} "
            f"with a confidence of {confidence:.2f}%. OpenCV geometric analysis reveals {impact_percentage:.2f}% "
            f"retinal anomaly coverage. Based on these metrics, the patient requires clinical observation. "
            f"(Note: To get the real full AI report, add valid Neural API credentials to your .env file.)")
