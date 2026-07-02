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
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS uploads (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                filename VARCHAR(255) NOT NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS uploads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                filename TEXT NOT NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
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

def add_upload_record(user_id, filename):
    """Log a file upload event."""
    conn, placeholder = get_db_connection()
    cursor = conn.cursor()
    sql = f'INSERT INTO uploads (user_id, filename) VALUES ({placeholder}, {placeholder})'
    try:
        cursor.execute(sql, (user_id, filename))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error logging upload record: {e}")
        return False
    finally:
        cursor.close()
        conn.close()

def get_user_uploads(user_id):
    """Retrieve the upload history of a user, ordered by upload date descending."""
    conn, placeholder = get_db_connection()
    cursor = conn.cursor()
    sql = f'SELECT filename, uploaded_at FROM uploads WHERE user_id = {placeholder} ORDER BY uploaded_at DESC'
    cursor.execute(sql, (user_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    
    uploads = []
    for r in rows:
        dt_val = r[1]
        dt_str = dt_val.strftime('%Y-%m-%d %H:%M:%S') if hasattr(dt_val, 'strftime') else str(dt_val)
        uploads.append({
            'filename': r[0],
            'uploaded_at': dt_str
        })
    return uploads

def get_user_stats(user_id):
    """Get profile stats for the user: count of uploads, member since date, and last upload time."""
    conn, placeholder = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Get member since date and username
    sql_user = f'SELECT created_at, username FROM users WHERE id = {placeholder}'
    cursor.execute(sql_user, (user_id,))
    user_row = cursor.fetchone()
    
    # 2. Get total upload count
    sql_count = f'SELECT COUNT(*) FROM uploads WHERE user_id = {placeholder}'
    cursor.execute(sql_count, (user_id,))
    count_row = cursor.fetchone()
    total_uploads = count_row[0] if count_row else 0
    
    # 3. Get last upload time
    sql_last = f'SELECT MAX(uploaded_at) FROM uploads WHERE user_id = {placeholder}'
    cursor.execute(sql_last, (user_id,))
    last_row = cursor.fetchone()
    
    cursor.close()
    conn.close()
    
    member_since = "N/A"
    username = "N/A"
    if user_row:
        dt_val = user_row[0]
        member_since = dt_val.strftime('%Y-%m-%d') if hasattr(dt_val, 'strftime') else str(dt_val)[:10]
        username = user_row[1]
        
    last_upload = "N/A"
    if last_row and last_row[0]:
        dt_last = last_row[0]
        last_upload = dt_last.strftime('%Y-%m-%d %H:%M:%S') if hasattr(dt_last, 'strftime') else str(dt_last)
        
    return {
        'username': username,
        'member_since': member_since,
        'total_uploads': total_uploads,
        'last_upload_at': last_upload
    }

