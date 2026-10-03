import sqlite3

def fix_db():
    conn = sqlite3.connect('mcq_selftest.db')
    cursor = conn.cursor()
    cursor.execute("UPDATE questions SET answer_source = 'answer_key_in_document' WHERE answer_source = 'answer_key_section'")
    conn.commit()
    conn.close()
    print("Database fixed successfully.")

if __name__ == "__main__":
    fix_db()
