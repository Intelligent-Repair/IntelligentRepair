from typing import Any, Dict, List, Optional

from supabase import create_client, Client

from app.core.config import settings


_client: Optional[Client] = None


def get_client() -> Client:
    """Return a cached Supabase client instance."""
    global _client
    if _client is None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            raise RuntimeError("Supabase configuration is missing. Set SUPABASE_URL and SUPABASE_KEY.")
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    return _client


def select_all(table: str, columns: str = "*") -> List[Dict[str, Any]]:
    client = get_client()
    res = client.table(table).select(columns).execute()
    return res.data or []


def insert(table: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    client = get_client()
    res = client.table(table).insert(payload).execute()
    # Supabase returns a list of inserted rows
    return (res.data or [None])[0]


def update(table: str, id_field: str, id_value: Any, payload: Dict[str, Any]) -> Dict[str, Any]:
    client = get_client()
    res = client.table(table).update(payload).eq(id_field, id_value).execute()
    return (res.data or [None])[0]


def delete(table: str, id_field: str, id_value: Any) -> bool:
    client = get_client()
    res = client.table(table).delete().eq(id_field, id_value).execute()
    return (res.count or 0) > 0


def upload_file(bucket: str, path: str, upload_file) -> Optional[str]:
    """Upload a FastAPI UploadFile to Supabase Storage and return a public URL or None.

    `upload_file` is a FastAPI `UploadFile` object.
    """
    client = get_client()
    storage = getattr(client, "storage", None)
    if storage is None:
        return None

    # normalize bucket accessor (supabase-py uses from_)
    try:
        bucket_handle = storage.from_(bucket)
    except Exception:
        try:
            bucket_handle = storage.from_bucket(bucket)
        except Exception:
            return None

    # generate upload content
    try:
        upload_file.file.seek(0)
        # construct path - assume caller provides path; here we expect path arg
        res = bucket_handle.upload(path, upload_file.file)
    except Exception:
        try:
            upload_file.file.seek(0)
            data = upload_file.file.read()
            res = bucket_handle.upload(path, data)
        except Exception:
            return None

    # get public url
    try:
        public = bucket_handle.get_public_url(path)
        if isinstance(public, dict):
            return public.get("publicUrl") or public.get("public_url")
        return str(public)
    except Exception:
        # try alternative method name
        try:
            public = storage.get_public_url(bucket, path)
            if isinstance(public, dict):
                return public.get("publicUrl") or public.get("public_url")
            return str(public)
        except Exception:
            return None


__all__ = ["get_client", "select_all", "insert", "update", "delete"]
