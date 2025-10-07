import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load .env from project root
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if not os.path.exists(dotenv_path):
    raise FileNotFoundError(f".env file not found at {dotenv_path}")
load_dotenv(dotenv_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Debug check
print("SUPABASE_URL:", SUPABASE_URL)
print("SUPABASE_KEY:", SUPABASE_KEY[:10], "...")  # print first 10 chars for safety

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL or SUPABASE_KEY is missing!")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    response = supabase.table("user").select("*").limit(1).execute()
    print("Connection successful! Sample data:", response.data)
except Exception as e:
    print("Connection failed!", e)
