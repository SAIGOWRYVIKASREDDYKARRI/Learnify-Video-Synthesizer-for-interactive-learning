import os
from mysql.connector.pooling import MySQLConnectionPool
from dotenv import load_dotenv

load_dotenv()

# ── Connection Pool (max 20 concurrent DB connections) ──────────────────────
# Fix: Increased pool_size and added timeout to prevent login hangs during AI tasks.
_pool = MySQLConnectionPool(
    pool_name="learnify_pool",
    pool_size=20,                    # Increased for high-load AI tasks
    connection_timeout=10,           # Fail after 10s instead of hanging forever
    host=os.getenv("DB_HOST", "localhost"),
    user=os.getenv("DB_USER", "root"),
    password=os.getenv("DB_PASSWORD"),        # No fallback — fail loudly if missing
    database=os.getenv("DB_NAME", "learnifydb"),
    pool_reset_session=True,         # Ensure clean state for every request
)

def get_db():
    """Return a pooled connection. Caller must close it to return it to pool."""
    return _pool.get_connection()
