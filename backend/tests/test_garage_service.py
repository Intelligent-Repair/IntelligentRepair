from app.services import garage_service


def test_create_and_list_garages(monkeypatch):
    created = {"id": "g1", "name": "Garage A", "address": "Street 1", "phone": "123"}
    monkeypatch.setattr("app.db.supabase.insert", lambda table, payload: created)
    res = garage_service.create_garage("Garage A", "Street 1", "123")
    assert res["id"] == "g1"

    monkeypatch.setattr("app.db.supabase.select_all", lambda table: [created])
    all_g = garage_service.list_garages()
    assert isinstance(all_g, list)
    assert all_g[0]["name"] == "Garage A"

    got = garage_service.get_garage("g1")
    assert got["id"] == "g1"
