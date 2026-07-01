# PredictaSales: Professional Sales Forecasting & Time-Series Analytics Platform

PredictaSales is an enterprise-grade, full-stack predictive sales forecasting platform. It allows business analysts, operations managers, and financial executives to upload historical transaction datasets, run time-series projection algorithms, analyze statistical metrics, review qualitative insights, and generate printable reports. 

The application is built on a high-performance **Python (Flask)** backend and an interactive **Single Page Application (SPA)** frontend using vanilla HTML5/CSS3/JS, connected to an isolated **SQLite** database.

---

## Table of Contents
1. [Core Capabilities](#core-capabilities)
2. [Technical Stack](#technical-stack)
3. [System Architecture](#system-architecture)
4. [Mathematical & Algorithmic Specifications](#mathematical--algorithmic-specifications)
5. [API Reference Specification](#api-reference-specification)
6. [Data Schema & CSV Specifications](#data-schema--csv-specifications)
7. [Installation & Setup Guide](#installation--setup-guide)
8. [Automated Testing](#automated-testing)
9. [UI & UX Configurations](#ui--ux-configurations)

---

## Core Capabilities

* **Secure Authentication Management**: Custom registration and sign-in modules backed by SQLite. Password integrity is secured using salted **PBKDF2 with HMAC-SHA256** hashing.
* **Algorithmic Modeling**: Select between **Linear Regression**, **Simple Moving Average**, and **Holt's Linear Exponential Smoothing** to accommodate different business cycles.
* **Fan Chart Visualizations**: Implements Chart.js vector line graphs showing actual sales, model fits, forecasts, and shaded **80% and 95% Confidence Intervals** that expand dynamically over time to reflect projection uncertainty.
* **Z-Score Anomaly Detector**: Scans historical sales records to automatically flag statistical outliers (exceeding $\pm 2.0$ standard deviations from the dataset mean) and lists troubleshooting alerts.
* **Interactive Charting controls**: Integrates timeline panning (click-and-drag) and wheel-based zooming via Hammer.js to allow analysts to focus on specific historical quarters.
* **PDF Report Composer**: Implements custom `@media print` style overrides to compile a clean, margin-optimized corporate PDF print template directly through the browser.

---

## Technical Stack

### Backend
* **Runtime**: Python 3.12+
* **Framework**: Flask 3.0.3 (Session-based auth management)
* **Data Processing**: Pandas 2.2.2 & NumPy 2.5.0
* **Machine Learning**: Scikit-Learn 1.5.0 (for Linear Regression fitting)
* **Database**: SQLite3 (Internal module)

### Frontend
* **Core**: Semantic HTML5 & Vanilla CSS3 (custom dark glassmorphic UI)
* **Scripting**: Modular ES6 JavaScript (No compilation required)
* **Visualization**: Chart.js 4.x
* **Interactions**: Hammer.js 2.0.8 (touch/gesture panning) & Chart.js Zoom Plugin 2.0.1

---

## System Architecture

```
sales-forecaster/
│
├── app.py                  # API endpoints, session verification, static serving
├── db.py                   # SQLite tables creation, password hashing & verification
├── forecaster.py           # Pandas file parsing, ML forecasting, outlier Z-scoring
├── test_server.py          # Isolated unit test suite (runs via test_sales_platform.db)
├── requirements.txt        # Backend dependencies manifest
├── Procfile                # Heroku/Railway WSGI startup configuration file
├── README.md               # Extensive project documentation
│
├── templates/
│   └── index.html          # SPA HTML structure, CDN loads
│
├── static/
│   ├── style.css           # Glassmorphic layout, metrics styling, print styles
│   └── app.js              # State manager, API fetch, Chart.js zoom integrations
│
└── uploads/                # User-isolated secure file upload storage directory
```

---


## Mathematical & Algorithmic Specifications

PredictaSales calculates forecasting trajectories and reliability ratings using standard statistical methods:

### 1. Linear Regression (Trend Model)
Fits a straight line modeling long-term trend direction using ordinary least squares (OLS):
\[y_t = \beta_0 + \beta_1 t + \epsilon_t\]
Where:
* \(t\) represents the index of the month.
* \(\beta_1\) (slope) and \(\beta_0\) (intercept) are calculated to minimize the sum of squared residuals:
  \[\beta_1 = \frac{\sum (t_i - \bar{t})(y_i - \bar{y})}{\sum (t_i - \bar{t})^2}\]

### 2. Holt's Linear Exponential Smoothing (Trend-Adjusted Smoothing)
Tracks a changing level and trend over time without seasonality, updating parameters dynamically:
* **Level Update**: \(l_t = \alpha y_t + (1-\alpha)(l_{t-1} + b_{t-1})\)
* **Trend Update**: \(b_t = \beta(l_t - l_{t-1}) + (1-\beta)b_{t-1}\)
* **Forecast Projection**: \(\hat{y}_{t+h|t} = l_t + h b_t\)
* *Default Weights*: Smoothing factors are set to \(\alpha = 0.35\) and trend factor \(\beta = 0.15\).

### 3. Model Reliability ($R^2$)
Measures the proportion of sales variance explained by the forecasting model:
\[R^2 = 1 - \frac{SS_{\text{res}}}{SS_{\text{tot}}}\]
Where:
* \(SS_{\text{res}} = \sum (y_i - \hat{y}_i)^2\) (Sum of squared residuals)
* \(SS_{\text{tot}} = \sum (y_i - \bar{y})^2\) (Total sum of squares)

### 4. Confidence Intervals (Fan Chart Uncertainty)
Error standard deviation of historical residuals is calculated:
\[s_e = \sqrt{\frac{\sum (y_i - \hat{y}_i)^2}{n - k}}\]
Where \(n\) is historical periods and \(k\) is parameters. The confidence interval expands over the forecast horizon \(h\) to simulate growing prediction uncertainty:
* **80% Confidence Interval**: \(\hat{y} \pm 1.28 \times s_e \times \sqrt{h}\)
* **95% Confidence Interval**: \(\hat{y} \pm 1.96 \times s_e \times \sqrt{h}\)

### 5. Z-Score Anomaly Detection
Checks historical values to identify outlier entries. A month \(i\) is flagged if:
\[|Z| = \left| \frac{y_i - \mu}{\sigma} \right| > 2.0\]
Where \(\mu\) is the dataset mean and \(\sigma\) is the dataset standard deviation.

---

## API Reference Specification

All requests must carry appropriate headers. Session cookies manage authorization.

### 1. User Registration
* **Endpoint**: `POST /api/register`
* **Request Body**:
  ```json
  {
    "username": "example_user",
    "password": "SecurePassword123"
  }
  ```
* **Responses**:
  * `201 Created`: Account registered.
  * `400 Bad Request`: Missing inputs or password length < 6.
  * `409 Conflict`: Username already exists.

### 2. User Sign In
* **Endpoint**: `POST /api/login`
* **Request Body**:
  ```json
  {
    "username": "example_user",
    "password": "SecurePassword123"
  }
  ```
* **Responses**:
  * `200 OK`: Cookie session established. Returns user object.
  * `401 Unauthorized`: Invalid credentials.

### 3. File Upload & Column Parsing
* **Endpoint**: `POST /api/upload`
* **Request Type**: `multipart/form-data`
* **Form Parameters**: `file` (CSV or Excel binary)
* **Response Body (`200 OK`)**:
  ```json
  {
    "filename": "sales_q4.csv",
    "message": "File uploaded and validated successfully!",
    "summary": {
      "data_points": 36,
      "detected_date_col": "Transaction_Month",
      "detected_sales_col": "Sales_Revenue",
      "detected_category_col": "Product_Category",
      "categories": ["Software Licenses", "Hardware Sales"],
      "min_date": "2023-01-01",
      "max_date": "2025-12-01",
      "total_sales": 2648462.0
    }
  }
  ```

### 4. Run Projections
* **Endpoint**: `POST /api/forecast`
* **Request Body**:
  ```json
  {
    "model_type": "exponential_smoothing",
    "horizon": 12,
    "category": "Software Licenses"
  }
  ```
* **Response Body (`200 OK`)**:
  ```json
  {
    "historical": [
      {"date": "2025-12-01", "actual": 115937.47, "fitted": 110235.1}
    ],
    "forecast": [
      {
        "date": "2026-01-01",
        "forecast": 110387.73,
        "ci_80_lower": 98235.1,
        "ci_80_upper": 122540.3,
        "ci_95_lower": 97355.2,
        "ci_95_upper": 123421.4
      }
    ],
    "metrics": {
      "r2": 0.851,
      "rmse": 6250.32,
      "avg_monthly_sales": 73568.1,
      "projected_growth": 2.0
    },
    "insights": [
      {
        "type": "positive",
        "title": "High Model Fit Accuracy",
        "text": "The model explains 85.1% of the sales variance."
      }
    ]
  }
  ```

---

## Data Schema & CSV Specifications

PredictaSales auto-detects date, sales, and category columns based on name patterns. For optimal results, structure your CSV/Excel file according to one of the following schemas:

### Multi-Category Schema (Recommended)
| Transaction_Month | Product_Category | Sales_Revenue |
| :--- | :--- | :--- |
| 2024-01 | Software Licenses | 48500.50 |
| 2024-01 | Hardware Sales | 22400.00 |
| 2024-02 | Software Licenses | 49200.00 |

### Standard Flat Schema
| Month | Sales |
| :--- | :--- |
| 2024-01-01 | 70900.00 |
| 2024-02-01 | 72150.30 |

* **Dates format supported**: `YYYY-MM-DD`, `YYYY-MM`, `MM/DD/YYYY`, or standard Excel Date cells.
* **Numeric format**: Remove currency symbols (e.g. `$`) or thousands commas (e.g. `,`) if the parser throws a validation error.

---

## Installation & Setup Guide

Ensure **Python 3.12+** is installed on your local computer.

### Step 1: Open PowerShell or Command Terminal
Navigate into the project workspace root directory:
```bash
cd C:\Users\user\.gemini\antigravity\scratch\sales-forecaster
```

### Step 2: Establish Python Virtual Environment
Initialize a clean environment (`venv` folder) inside the directory:
```powershell
python -m venv venv
```
Activate the environment:
* **Windows (PowerShell)**:
  ```powershell
  .\venv\Scripts\Activate.ps1
  ```
* **macOS/Linux**:
  ```bash
  source venv/bin/activate
  ```

### Step 3: Install Required Dependencies
Download and install packages using pip:
```bash
pip install -r requirements.txt
```

### Step 4: Boot Flask Server
Start the server in debug mode:
```bash
python app.py
```
Upon successful boot, open your web browser of choice and go to:
👉 **`http://127.0.0.1:5000/`**

---

## Automated Testing

An automated test suite is provided to verify database integrity, password hashing algorithms, and forecasting calculations. To execute the tests in an isolated, temporary database setup:

```bash
python test_server.py
```

The script will report:
```
Ran 2 tests in 0.691s
OK
```

---

## UI & UX Configurations

### Interactive Zooming
Zooming and Panning are configured on the Chart.js canvas in `app.js` using the `chartjs-plugin-zoom` interface. 
* To zoom along the X-axis (timeline), use the **mouse wheel** or **pinch gesture** on the chart area.
* To pan left or right, **click and drag** the chart.
* To reset the zoom levels to fit the entire dataset timeline, **double click** anywhere on the chart.

### PDF Report Customization
The print view utilizes standard browser print mechanisms (`window.print()`). 
CSS rules inside `@media print` in `style.css` perform the following actions:
1. Hides sidebar navigation menus (`.sidebar`), upload components, parameter selectors, and action buttons.
2. Strips dark neon backgrounds, changing body colors to `#ffffff` and text colors to `#0f172a` (high contrast black ink).
3. Adapts the Chart.js canvas to display properly on standard A4 print sheets.
4. Set table row limits to avoid orphan rows across page boundaries (`page-break-inside: avoid`).

---

## Railway Deployment Guide

This project is configured to deploy directly to [Railway](https://railway.app) without any code modifications.

### 1. Deployment Requirements Satisfied:
* **Production Web Server**: `gunicorn` is listed in `requirements.txt` to run the WSGI application container.
* **Process Configuration**: A `Procfile` is present at the root, instructing Railway's runner to start the server:
  ```
  web: gunicorn app:app
  ```
* **Dynamic Port Binding**: `app.py` is configured to bind to `0.0.0.0` and read the dynamic port assigned by Railway via the `PORT` environment variable.
* **Database Portability**: The SQLite file path uses absolute script-relative resolution, ensuring data stores correctly on Railway's container disk.

### 2. Steps to Deploy:
1. Initialize a Git repository in this folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for Railway deployment"
   ```
2. Create a new GitHub repository and push your project to it.
3. Log in to [Railway](https://railway.app), click **New Project**, and select **Deploy from GitHub repo**.
4. Choose your pushed repository.
5. Railway will automatically detect the Python environment, read the `Procfile`, install the dependencies via pip, run the WSGI production container, and bind to the correct network interfaces.

