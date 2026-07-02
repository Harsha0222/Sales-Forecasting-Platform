import sqlite3
import os
import psycopg2
from werkzeug.security import generate_password_hash, check_password_hash

# DATABASE_URL environment variable is set by platforms like Render or Neon
DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db_connection():
    if DATABASE_URL:
        # Connect to PostgreSQL
        conn = psycopg2.connect(DATABASE_URL, sslmode='require')
        return conn, '%s'
    else:
        # Fallback to local SQLite for local testing
        database_path = os.path.join(os.path.dirname(__file__), 'sales_platform.db')
        conn = sqlite3.connect(database_path)
        conn.row_factory = sqlite3.Row
        return conn, '?'

def init_db():
    """Initialize the database tables if they do not exist."""
    conn, placeholder = get_db_connection()
    cursor = conn.cursor()
    
    if DATABASE_URL:
        # PostgreSQL Schema
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(300) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    else:
        # SQLite Schema
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
    conn.commit()
    cursor.close()
    conn.close()

def register_user(username, password):
    """
    Register a new user with hashed password.
    Returns True if registration is successful, False if username already exists.
    """
    if not username or not password:
        return False
    
    password_hash = generate_password_hash(password)
    
    conn, placeholder = get_db_connection()
    cursor = conn.cursor()
    
    sql = f'INSERT INTO users (username, password_hash) VALUES ({placeholder}, {placeholder})'
    
    try:
        cursor.execute(sql, (username, password_hash))
        conn.commit()
        return True
    except Exception as e:
        err_name = type(e).__name__
        if 'IntegrityError' in err_name or 'UniqueViolation' in err_name:
            return False
        raise e
    finally:
        cursor.close()
        conn.close()

def verify_user(username, password):
    """
    Verify user credentials.
    Returns user details (dict) if valid, otherwise None.
    """
    if not username or not password:
        return None
        
    conn, placeholder = get_db_connection()
    cursor = conn.cursor()
    
    sql = f'SELECT id, username, password_hash FROM users WHERE username = {placeholder}'
    cursor.execute(sql, (username,))
    
    # Handle Row extraction depending on SQLite vs PostgreSQL
    if DATABASE_URL:
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        if user and check_password_hash(user[2], password):
            return {
                'id': user[0],
                'username': user[1]
            }
    else:
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        if user and check_password_hash(user['password_hash'], password):
            return {
                'id': user['id'],
                'username': user['username']
            }
            
    return None
