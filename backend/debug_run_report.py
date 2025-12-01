from fastapi.testclient import TestClient
from app.main import app
import app.db.supabase as supabase_module
import app.services.report_service as report_service_module

# monkeypatch replacements
supabase_module.upload_file = lambda bucket, path, upload_file: "https://cdn.example/reports/test.jpg"

def fake_create_report(user_id, vehicle_id, description, image_url):
    return {
        "id": "report-1",
        "user_id": user_id,
        "vehicle_id": vehicle_id,
        "description": description,
        "image_url": image_url,
        "status": "open",
        "created_at": "2025-12-01T00:00:00Z",
    }

report_service_module.create_report = fake_create_report

client = TestClient(app)
# login
r = client.post('/api/v1/auth/login', json={'email':'user@example.com','password':'pass'})
print('login', r.status_code, r.json())
token = r.json()['access_token']

files = {'image':('test.jpg', b'image-bytes', 'image/jpeg')}
data = {'vehicle_id':'v1','description':'Test issue'}
headers = {'Authorization': f'Bearer {token}'}
resp = client.post('/api/v1/reports', headers=headers, data=data, files=files)
print('report post', resp.status_code)
try:
    print(resp.json())
except Exception:
    print(resp.text)
