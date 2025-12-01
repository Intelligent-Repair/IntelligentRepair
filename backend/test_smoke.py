from fastapi.testclient import TestClient
from app.main import app


def run():
    client = TestClient(app)
    h = client.get("/api/v1/health")
    print("health", h.status_code, h.json())

    login = client.post("/api/v1/auth/login", json={"email": "test@example.com", "password": "pass"})
    print("login", login.status_code, login.json())


if __name__ == "__main__":
    run()
