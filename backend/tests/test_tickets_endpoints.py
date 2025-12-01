from fastapi.testclient import TestClient
from app.main import app


def test_tickets_endpoints(monkeypatch):
    client = TestClient(app)

    created = {"id": "t1", "report_id": "r1", "garage_id": "g1", "notes": "ok"}
    monkeypatch.setattr("app.services.ticket_service.create_ticket", lambda report_id, garage_id, notes: created)
    monkeypatch.setattr("app.services.ticket_service.list_tickets_for_garage", lambda gid: [created])
    monkeypatch.setattr("app.services.ticket_service.list_tickets_for_report", lambda rid: [created])

    r = client.post("/api/v1/auth/login", json={"email": "user@example.com", "password": "pass"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post("/api/v1/tickets/", json={"report_id": "r1", "garage_id": "g1"}, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["id"] == "t1"

    resp2 = client.get("/api/v1/tickets/garage/g1", headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["tickets"][0]["id"] == "t1"

    resp3 = client.get("/api/v1/tickets/report/r1", headers=headers)
    assert resp3.status_code == 200
    assert resp3.json()["tickets"][0]["id"] == "t1"
