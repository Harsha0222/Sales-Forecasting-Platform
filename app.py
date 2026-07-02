import os
import secrets
from flask import Flask, request, jsonify, session, send_from_directory, render_template
from werkzeug.utils import secure_filename
import pandas as pd
import numpy as np
from datetime import datetime

import db
import forecaster

app = Flask(__name__, template_folder='templates', static_folder='static')
app.secret_key = os.environ.get('FLASK_SECRET_KEY', secrets.token_hex(24))

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB limit

ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Initialize database
db.init_db()

@app.route('/')
def index():
    return render_template('index.html')

# --- AUTHENTICATION ENDPOINTS ---

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'Username and password are required.'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters long.'}), 400

    success = db.register_user(username, password)
    if success:
        return jsonify({'message': 'Registration successful! You can now log in.'}), 201
    else:
        return jsonify({'error': 'Username already exists. Please choose another.'}), 409

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'Username and password are required.'}), 400

    user = db.verify_user(username, password)
    if user:
        session['user_id'] = user['id']
        session['username'] = user['username']
        session.pop('current_file_path', None)
        session.pop('current_filename', None)
        return jsonify({
            'message': 'Login successful!',
            'user': {
                'id': user['id'],
                'username': user['username']
            }
        }), 200
    else:
        return jsonify({'error': 'Invalid username or password.'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully.'}), 200

@app.route('/api/session', methods=['GET'])
def get_session():
    if 'user_id' in session:
        return jsonify({
            'authenticated': True,
            'user': {
                'id': session['user_id'],
                'username': session['username']
            },
            'current_file': session.get('current_filename')
        }), 200
    return jsonify({'authenticated': False}), 200

# --- DATA UPLOAD & FORECAST ENDPOINTS ---

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized. Please log in first.'}), 401

    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded.'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected.'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Only CSV and Excel (XLSX, XLS) files are allowed.'}), 400

    user_id = session['user_id']
    user_upload_dir = os.path.join(app.config['UPLOAD_FOLDER'], str(user_id))
    os.makedirs(user_upload_dir, exist_ok=True)

    filename = secure_filename(file.filename)
    filepath = os.path.join(user_upload_dir, filename)
    file.save(filepath)

    try:
        # Validate data and extract column summary (including category lists)
        parsed_df, col_info = forecaster.parse_sales_data(filepath)
        
        session['current_file_path'] = filepath
        session['current_filename'] = filename
        
        # Log successful upload into database
        db.add_upload_record(user_id, filename)
        
        y_vals = parsed_df['y'].values
        summary = {
            'data_points': len(parsed_df),
            'min_date': parsed_df['ds'].min().strftime('%Y-%m-%d'),
            'max_date': parsed_df['ds'].max().strftime('%Y-%m-%d'),
            'total_sales': float(y_vals.sum()),
            'avg_sales': float(y_vals.mean()),
            'detected_date_col': col_info['date_col'],
            'detected_sales_col': col_info['sales_col'],
            'detected_category_col': col_info['category_col'],
            'categories': col_info['categories']
        }
        
        return jsonify({
            'message': 'File uploaded and validated successfully!',
            'filename': filename,
            'summary': summary
        }), 200

    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({'error': f'Failed to process file: {str(e)}'}), 420

@app.route('/api/forecast', methods=['POST'])
def forecast():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized. Please log in first.'}), 401

    filepath = session.get('current_file_path')
    if not filepath or not os.path.exists(filepath):
        return jsonify({'error': 'No active dataset. Please upload a file first.'}), 400

    data = request.get_json() or {}
    model_type = data.get('model_type', 'linear')
    horizon = int(data.get('horizon', 6))
    category = data.get('category', 'All')

    if horizon not in [3, 6, 12, 24]:
        return jsonify({'error': 'Invalid horizon length. Choose 3, 6, 12, or 24.'}), 400

    try:
        df, _ = forecaster.parse_sales_data(filepath, category_filter=category)
        forecast_results = forecaster.generate_forecast(df, horizon_months=horizon, model_type=model_type)
        return jsonify(forecast_results), 200
    except Exception as e:
        return jsonify({'error': f'Forecasting error: {str(e)}'}), 500

@app.route('/api/uploads', methods=['GET'])
def list_uploads():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized.'}), 401
    history = db.get_user_uploads(session['user_id'])
    return jsonify({'uploads': history}), 200

@app.route('/api/uploads/load', methods=['POST'])
def load_upload():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized.'}), 401
    
    data = request.get_json() or {}
    filename = data.get('filename')
    if not filename:
        return jsonify({'error': 'Filename is required.'}), 400
        
    user_id = session['user_id']
    user_upload_dir = os.path.join(app.config['UPLOAD_FOLDER'], str(user_id))
    filepath = os.path.join(user_upload_dir, secure_filename(filename))
    
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found on server.'}), 404
        
    try:
        parsed_df, col_info = forecaster.parse_sales_data(filepath)
        
        session['current_file_path'] = filepath
        session['current_filename'] = filename
        
        y_vals = parsed_df['y'].values
        summary = {
            'data_points': len(parsed_df),
            'min_date': parsed_df['ds'].min().strftime('%Y-%m-%d'),
            'max_date': parsed_df['ds'].max().strftime('%Y-%m-%d'),
            'total_sales': float(y_vals.sum()),
            'avg_sales': float(y_vals.mean()),
            'detected_date_col': col_info['date_col'],
            'detected_sales_col': col_info['sales_col'],
            'detected_category_col': col_info['category_col'],
            'categories': col_info['categories']
        }
        
        return jsonify({
            'message': f'File {filename} loaded successfully!',
            'filename': filename,
            'summary': summary
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to parse file: {str(e)}'}), 420

@app.route('/api/profile', methods=['GET'])
def user_profile():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized.'}), 401
    stats = db.get_user_stats(session['user_id'])
    stats['database_type'] = 'PostgreSQL (Cloud)' if os.environ.get('DATABASE_URL') else 'SQLite (Local)'
    return jsonify(stats), 200

@app.route('/api/sample', methods=['GET'])
def download_sample():
    """Generates and serves a realistic synthetic multi-category sales dataset for demo purposes."""
    sample_path = os.path.join(app.config['UPLOAD_FOLDER'], 'sample_sales_data.csv')
    
    # Re-generate data to ensure category presence
    dates = pd.date_range(start='2023-01-01', periods=36, freq='MS')
    np.random.seed(42)
    
    category_rows = []
    
    for dt_idx, date in enumerate(dates):
        # 1. Software Licenses (Upward growth, high dec peak, low noise)
        base_sw = 45000 + dt_idx * 1500
        season_sw = 1.35 if date.month in [11, 12] else (0.85 if date.month in [1, 2] else 1.0)
        noise_sw = np.random.normal(0, 2000)
        sales_sw = np.clip(base_sw * season_sw + noise_sw, 15000, None)
        category_rows.append({
            'Transaction_Month': date.strftime('%Y-%m'),
            'Product_Category': 'Software Licenses',
            'Sales_Revenue': round(sales_sw, 2)
        })
        
        # 2. Hardware Sales (Flat/Volatile trend, large outlier in July 2024)
        base_hw = 25000 + dt_idx * 300
        season_hw = 1.45 if date.month == 12 else (0.90 if date.month == 1 else 1.0)
        
        # Add a major artificial outlier in July 2024 (idx 18) to trigger the anomaly detector
        if dt_idx == 18:
            sales_hw = 120000.0  # Huge outlier
        else:
            noise_hw = np.random.normal(0, 4000)
            sales_hw = np.clip(base_hw * season_hw + noise_hw, 5000, None)
            
        category_rows.append({
            'Transaction_Month': date.strftime('%Y-%m'),
            'Product_Category': 'Hardware Sales',
            'Sales_Revenue': round(sales_hw, 2)
        })
        
        # 3. Consulting Support (Slow consistent growth, minimal noise, no seasonality)
        base_con = 8000 + dt_idx * 500
        noise_con = np.random.normal(0, 500)
        sales_con = np.clip(base_con + noise_con, 4000, None)
        category_rows.append({
            'Transaction_Month': date.strftime('%Y-%m'),
            'Product_Category': 'Consulting Support',
            'Sales_Revenue': round(sales_con, 2)
        })
        
    sample_df = pd.DataFrame(category_rows)
    sample_df.to_csv(sample_path, index=False)
        
    return send_from_directory(app.config['UPLOAD_FOLDER'], 'sample_sales_data.csv', as_attachment=True)

if __name__ == '__main__':
    # Bind to PORT environment variable assigned by Railway (defaults to 5000)
    port = int(os.environ.get('PORT', 5000))
    # Bind to 0.0.0.0 to accept external requests inside container
    app.run(host='0.0.0.0', port=port, debug=True)


