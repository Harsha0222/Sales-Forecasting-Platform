# PredictaSales: Sales Forecasting Platform

PredictaSales is an enterprise-grade, glassmorphic single-page web dashboard designed for multi-category sales forecasting. The platform allows businesses to upload historical transactional sales files (CSV or Excel), automatically clean and parse timelines, run advanced statistical models with confidence margins, isolate anomaly outliers, and generate high-contrast PDF reports.

The platform is designed with a **dual-database architecture**: running a local SQLite database for offline development, and dynamically connecting to a secure PostgreSQL database when deployed on cloud containers (such as Render + Neon).

---

## System Architecture

```
sales-forecaster/
│
├── app.py                  
├── db.py                  
├── forecaster.py           
├── test_server.py          
├── requirements.txt        
├── Procfile                
├── runtime.txt             
├── README.md               
│
├── templates/
│   └── index.html          
│
├── static/
│   ├── style.css           
│   └── app.js              
│
└── uploads/                
```

---

## Core Features & Operations

1. **Secure Authentication**: Built with secure user session hashing using **PBKDF2 with HMAC-SHA256** stretching (600,000 iterations).
2. **Dual-Database Support**: Dynamically routes authentication queries to PostgreSQL if `DATABASE_URL` is set, or defaults to a local SQLite database (`sales_platform.db`).
3. **Automated Schema Parsing**: Auto-detects columns containing date values, sales figures, and category splits. Standardizes data types and formats numbers dynamically.
4. **Outlier Anomaly Detection**: Runs a sliding window Z-score check:
   \[|Z| = \left| \frac{x_i - \mu}{\sigma} \right| > 2.0\]
   Flagging anomalies dynamically in a dedicated system logs feed.
5. **Advanced Forecasting Engines**:
   * **Linear Regression**: Best-fit OLS trendlines.
   * **Moving Average (SMA)**: Rolling trend indicator.
   * **Holt's Exponential Smoothing**: Dual parameter level/trend updates.
6. **Fan Chart Margin of Error**: Computes expanding standard deviation uncertainty ranges for $80\%$ and $95\%$ confidence boundaries:
   \[\text{Interval} = \hat{y} \pm Z_c \times s_e \times \sqrt{h}\]
7. **Pinch-to-Zoom Timeline**: Interactive drag, scroll, and double-click reset actions on graphs.
8. **Print-to-PDF Formatting**: Dynamically swaps typography and grid line styles to high-contrast dark text during document printing.

---

## Deployment Guide (Render + Neon Postgres)

This project is configured to deploy directly to **Render** and link to a free persistent **Neon.tech** database.

### 1. Create a Neon PostgreSQL Database (Free Forever)
1. Sign up at [Neon.tech](https://neon.tech/) (use your GitHub login).
2. Create a new project.
3. On your Neon dashboard, toggle **"Show password"** and copy your **Connection String**:
   `postgresql://neondb_owner:[password]@[host]/neondb?sslmode=require`

### 2. Deploy on Render
1. Push your project code to GitHub.
2. Log in to [Render](https://render.com) and click **New +** -> **Web Service**.
3. Link your GitHub repository.
4. Set the following parameters:
   * **Name**: `sales-forecasting-platform`
   * **Runtime**: `Python`
   * **Build Command**: `pip install -r requirements.txt`
   * **Start Command**: `gunicorn app:app` (Render reads this from your `Procfile`)
   * **Instance Type**: Select **Free**
5. Go to the **Environment** tab on the left sidebar:
   * Click **Add Environment Variable**.
   * Add **`PYTHON_VERSION`** with value **`3.11.9`** (forces a stable build without compiling).
   * Add **`DATABASE_URL`** with value **`(paste your Neon Connection String)`**.
   * Click **Save Changes**.

Render will deploy the app live in 4-5 minutes.

---

## Local Installation & Setup

### Prerequisites
* **Python 3.12+**
* Git

### Step 1: Clone the repository
Navigate to your working folder and run:
```bash
git clone <your-repository-url>
cd sales-forecaster
```

### Step 2: Establish Virtual Environment
Create and activate a clean environment:
```powershell
# Windows
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Run the Server
```bash
python app.py
```
Open [http://127.0.0.1:5000](http://127.0.0.1:5000) in your browser.

---

## Running Automated Tests
The platform utilizes an isolated test suite to verify endpoints and DB queries:
```bash
python test_server.py
```
*Outputs:*
```
Ran 2 tests in 0.691s
OK
```