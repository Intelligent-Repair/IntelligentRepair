from app.services import ticket_service


def test_create_and_list_tickets(monkeypatch):
    created = {"id": "t1", "report_id": "r1", "garage_id": "g1", "notes": "ok"}
    monkeypatch.setattr("app.db.supabase.insert", lambda table, payload: created)
    t = ticket_service.create_ticket("r1", "g1", "ok")
    assert t["id"] == "t1"

    monkeypatch.setattr("app.db.supabase.select_all", lambda table: [created])
    for_g = ticket_service.list_tickets_for_garage("g1")
    assert len(for_g) == 1 and for_g[0]["id"] == "t1"

    for_r = ticket_service.list_tickets_for_report("r1")
    assert len(for_r) == 1 and for_r[0]["id"] == "t1"
