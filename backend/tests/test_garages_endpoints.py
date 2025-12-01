from fastapi.testclient import TestClient
from app.main import app


def test_garages_endpoints(monkeypatch):
    client = TestClient(app)

    # Mock garage_service
    created = {"id": "g1", "name": "Garage A", "address": "Addr", "phone": "123"}
    monkeypatch.setattr("app.services.garage_service.create_garage", lambda name, address, phone: created)
    monkeypatch.setattr("app.services.garage_service.list_garages", lambda: [created])

    # Login
    r = client.post("/api/v1/auth/login", json={"email": "user@example.com", "password": "pass"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post("/api/v1/garages/", json={"name": "Garage A"}, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"] == "g1"

    resp2 = client.get("/api/v1/garages/", headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["garages"][0]["id"] == "g1"
