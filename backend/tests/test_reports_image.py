from fastapi.testclient import TestClient
from app.main import app


def test_report_image_upload(monkeypatch):
    client = TestClient(app)

    # Mock upload_file used by the reports endpoint to return a public URL
    monkeypatch.setattr("app.api.v1.endpoints.reports.upload_file", lambda bucket, path, upload_file: "https://cdn.example/reports/test.jpg")

    # Mock report_service.create_report to return a created record
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

    monkeypatch.setattr("app.services.report_service.create_report", fake_create_report)

    # Login to obtain token
    r = client.post("/api/v1/auth/login", json={"email": "user@example.com", "password": "pass"})
    assert r.status_code == 200
    token = r.json()["access_token"]

    files = {"image": ("test.jpg", b"image-bytes", "image/jpeg")}
    data = {"vehicle_id": "v1", "description": "Test issue"}
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post("/api/v1/reports", headers=headers, data=data, files=files)
    assert resp.status_code == 201
    body = resp.json()
    assert body["image_url"].startswith("https://")
    assert body["vehicle_id"] == "v1"
