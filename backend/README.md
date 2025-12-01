# IntelligentRepair — Backend (FastAPI)

This folder contains the FastAPI backend for the IntelligentRepair MVP.

Quick start (development)

1. Create a virtual environment (Windows PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install dependencies:

```powershell
pip install -r requirements.txt
```

3. Copy `.env.example` to `.env` and fill in your keys (Supabase, JWT secret, OpenAI key if used):

```powershell
copy app\core\.env.example .env
# then edit .env
```

4. Run the app locally:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

5. Run tests:

```powershell
pytest -q
```

Notes

- The app supports optional OpenAI usage: if `OPENAI_API_KEY` is set, diagnostics will call OpenAI; otherwise a safe fallback summary is returned.
- Image uploads use Supabase Storage — configure `REPORTS_BUCKET` in `.env` and ensure the bucket exists.
- Auth currently attempts Supabase sign-in when `SUPABASE_URL`/`SUPABASE_KEY` are configured; otherwise a development fallback is used.

If you want, I can add a GitHub Actions workflow to run tests and lint on pull requests.
