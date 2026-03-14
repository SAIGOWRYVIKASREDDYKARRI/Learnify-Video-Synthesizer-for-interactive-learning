import MySQLdb
import os

def update_schema():
    try:
        # Based on database.py:
        # host='localhost', user='root', password='Vikas@2005', db='learnifydb'
        db = MySQLdb.connect(
            host="localhost",
            user="root",
            passwd="Vikas@2005",
            db="learnifydb"
        )
        cur = db.cursor()
        
        # Check if column 'summary' exists
        cur.execute("SHOW COLUMNS FROM search_history LIKE 'summary'")
        if not cur.fetchone():
            print("Adding 'summary' column to 'search_history'...")
            cur.execute("ALTER TABLE search_history ADD COLUMN summary TEXT")
            db.commit()

        # Check if column 'quiz_json' exists
        cur.execute("SHOW COLUMNS FROM search_history LIKE 'quiz_json'")
        if not cur.fetchone():
            print("Adding 'quiz_json' column to 'search_history'...")
            cur.execute("ALTER TABLE search_history ADD COLUMN quiz_json TEXT")
            db.commit()
            print("Column 'quiz_json' added successfully.")
        else:
            print("Column 'quiz_json' already exists.")
        
        # Check if column 'quiz_score' exists
        cur.execute("SHOW COLUMNS FROM search_history LIKE 'quiz_score'")
        if not cur.fetchone():
            print("Adding 'quiz_score' column...")
            cur.execute("ALTER TABLE search_history ADD COLUMN quiz_score INTEGER")
            db.commit()

        # Check if column 'quiz_total' exists
        cur.execute("SHOW COLUMNS FROM search_history LIKE 'quiz_total'")
        if not cur.fetchone():
            print("Adding 'quiz_total' column...")
            cur.execute("ALTER TABLE search_history ADD COLUMN quiz_total INTEGER")
            db.commit()
        
        # Check if column 'is_favorite' exists
        cur.execute("SHOW COLUMNS FROM search_history LIKE 'is_favorite'")
        if not cur.fetchone():
            print("Adding 'is_favorite' column...")
            cur.execute("ALTER TABLE search_history ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE")
            db.commit()
        
        cur.close()
        db.close()
    except Exception as e:
        print(f"Error updating schema: {e}")

if __name__ == "__main__":
    update_schema()
