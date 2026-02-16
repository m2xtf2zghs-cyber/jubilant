from supabase import create_client

from .config import settings


sb = create_client(settings.supabase_url, settings.supabase_service_key)
