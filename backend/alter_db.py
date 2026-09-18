import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv("c:/Users/Ekaansh/OneDrive/Desktop/AB/projects/rexplain/.env")

db_url = os.environ.get("DATABASE_URL")
if not db_url:
    print("No DATABASE_URL found.")
    exit(1)

# Fix connection string for async driver compatibility if needed, but we'll just use psycopg2
db_url = db_url.replace("postgres://", "postgresql://")
engine = create_engine(db_url)

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE messages ADD COLUMN sources JSON DEFAULT '[]'::json;"))
        print("Added sources column.")
    except Exception as e:
        print("sources column might already exist:", e)
    
    try:
        conn.execute(text("ALTER TABLE messages ADD COLUMN confidence TEXT DEFAULT 'medium';"))
        print("Added confidence column.")
    except Exception as e:
        print("confidence column might already exist:", e)
        
    conn.commit()
    print("Done!")
