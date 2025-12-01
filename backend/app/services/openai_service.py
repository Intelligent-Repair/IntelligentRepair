from typing import Optional

from app.core.config import settings

try:
    import openai
except Exception:
    openai = None


def generate_diagnosis(manual_text: Optional[str], description: str, image_url: Optional[str] = None) -> str:
    # If OpenAI key is configured and openai package is available, call the API.
    if settings.OPENAI_API_KEY and openai:
        openai.api_key = settings.OPENAI_API_KEY
        prompt = """
You are an auto mechanic assistant. Use the vehicle manual and the user description to provide a concise diagnosis and recommended next steps.

Vehicle manual:
"""
        prompt += (manual_text or "No manual available") + "\n\n"
        prompt += "User description:\n" + description + "\n\n"
        if image_url:
            prompt += f"Image URL: {image_url}\n\n"
        prompt += "Provide a short diagnosis and recommendation."
        try:
            resp = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=300,
            )
            text = resp.choices[0].message.content.strip()
            return text
        except Exception:
            pass

    # Fallback deterministic/simple diagnosis when OpenAI not available
    summary = "Diagnosis: Unable to call OpenAI. "
    if manual_text:
        summary += "Found relevant manual; recommend checking the sections related to the described issue."
    else:
        summary += "No manual available. Recommend visual inspection and basic checks (battery, fluids, belts)."
    return summary
