import pandas as pd
import numpy as np
import os
from datetime import datetime

def parse_sales_data(filepath, category_filter=None):
    """
    Load CSV or Excel file, auto-detect date, sales, and optional category columns,
    apply category filtering if requested, and return aggregated DataFrame.
    """
    ext = os.path.splitext(filepath)[1].lower()
    
    if ext == '.csv':
        df = pd.read_csv(filepath)
    elif ext in ['.xlsx', '.xls']:
        df = pd.read_excel(filepath)
    else:
        raise ValueError("Unsupported file format. Please upload a CSV or Excel file.")

    if df.empty:
        raise ValueError("The uploaded file is empty.")

    # Lowercase column names for detection
    cols_lower = [str(c).lower().strip() for c in df.columns]
    
    # 1. Detect Date Column
    date_col = None
    date_keywords = ['date', 'month', 'year', 'time', 'period', 'timestamp', 'ds', 'sales_date']
    for kw in date_keywords:
        for idx, col in enumerate(cols_lower):
            if kw in col:
                date_col = df.columns[idx]
                break
        if date_col:
            break
            
    if not date_col:
        date_col = df.columns[0]

    # 2. Detect Category Column (Optional)
    category_col = None
    category_keywords = ['category', 'product', 'type', 'dept', 'department', 'segment', 'division', 'line']
    for kw in category_keywords:
        for idx, col in enumerate(cols_lower):
            if df.columns[idx] == date_col:
                continue
            if kw in col:
                category_col = df.columns[idx]
                break
        if category_col:
            break

    # 3. Detect Sales Column
    sales_col = None
    sales_keywords = ['sales', 'revenue', 'amount', 'sold', 'quantity', 'qty', 'turnover', 'total', 'y', 'value']
    for kw in sales_keywords:
        for idx, col in enumerate(cols_lower):
            if df.columns[idx] == date_col or df.columns[idx] == category_col:
                continue
            if kw in col:
                sales_col = df.columns[idx]
                break
        if sales_col:
            break
            
    if not sales_col:
        for col in df.columns:
            if col == date_col or col == category_col:
                continue
            if pd.api.types.is_numeric_dtype(df[col]):
                sales_col = col
                break
                
    if not sales_col:
        raise ValueError("Could not auto-detect a numeric sales/revenue column.")

    # Get list of unique categories before filtering
    categories = []
    if category_col:
        # Fill missing values and convert to string
        df[category_col] = df[category_col].fillna("Unknown").astype(str).str.strip()
        categories = sorted(list(df[category_col].unique()))

    # Apply category filtering if active
    if category_col and category_filter and category_filter != 'All':
        df = df[df[category_col] == category_filter]
        if df.empty:
            raise ValueError(f"No records found for category '{category_filter}'.")

    # 4. Clean and Parse Dates
    try:
        df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
    except Exception as e:
        raise ValueError(f"Failed to parse dates in column '{date_col}': {str(e)}")

    df = df.dropna(subset=[date_col, sales_col])
    
    if df.empty:
        raise ValueError("No valid rows remaining after cleaning missing dates or sales values.")

    df[sales_col] = pd.to_numeric(df[sales_col], errors='coerce')
    df = df.dropna(subset=[sales_col])
    
    if df.empty:
        raise ValueError("No numeric data found in the sales column.")

    # Rename columns for internal forecasting
    df_internal = df.rename(columns={date_col: 'date', sales_col: 'sales'})
    df_internal = df_internal.sort_values('date')
    
    # Aggregate monthly
    df_internal['year_month'] = df_internal['date'].dt.to_period('M')
    monthly_df = df_internal.groupby('year_month').agg({'sales': 'sum', 'date': 'first'}).reset_index()
    monthly_df = monthly_df.sort_values('date')
    
    result_df = pd.DataFrame({
        'ds': monthly_df['date'],
        'y': monthly_df['sales']
    })
    
    original_cols = {
        'date_col': str(date_col),
        'sales_col': str(sales_col),
        'category_col': str(category_col) if category_col else None,
        'categories': categories
    }
    
    return result_df, original_cols

def generate_forecast(df, horizon_months=6, model_type='linear'):
    """
    Generates future sales predictions along with metrics, confidence intervals, and insights (including anomaly warnings).
    """
    y = df['y'].values.astype(float)
    dates = df['ds'].values
    n_historical = len(dates)
    
    if n_historical < 3:
        raise ValueError("Dataset too small. Need at least 3 data points (months) for forecasting.")

    # Prepare indices for modeling
    x = np.arange(n_historical)
    
    # Generate future dates
    last_date = pd.to_datetime(dates[-1])
    future_dates = []
    curr_date = last_date
    for _ in range(horizon_months):
        if curr_date.month == 12:
            curr_date = datetime(curr_date.year + 1, 1, 1)
        else:
            curr_date = datetime(curr_date.year, curr_date.month + 1, 1)
        future_dates.append(curr_date)
        
    future_dates = np.array(future_dates)
    x_future = np.arange(n_historical, n_historical + horizon_months)
    
    # 1. Forecasting Models
    fit_values = np.zeros(n_historical)
    forecast_values = np.zeros(horizon_months)
    
    if model_type == 'linear':
        slope, intercept = np.polyfit(x, y, 1)
        fit_values = slope * x + intercept
        forecast_values = slope * x_future + intercept
        forecast_values = np.clip(forecast_values, 0, None)
        
    elif model_type == 'moving_average':
        window = min(3, n_historical - 1)
        fit_values = pd.Series(y).rolling(window=window, min_periods=1).mean().values
        
        temp_y = list(y)
        for i in range(horizon_months):
            val = np.mean(temp_y[-window:])
            forecast_values[i] = val
            temp_y.append(val)
            
    elif model_type == 'exponential_smoothing':
        alpha, beta = 0.35, 0.15
        l = [y[0]]
        b = [y[1] - y[0]]
        fit_values[0] = y[0]
        
        for t in range(1, n_historical):
            y_t = y[t]
            l_t = alpha * y_t + (1 - alpha) * (l[-1] + b[-1])
            b_t = beta * (l_t - l[-1]) + (1 - beta) * b[-1]
            l.append(l_t)
            b.append(b_t)
            fit_values[t] = l[-1]
            
        last_l = l[-1]
        last_b = b[-1]
        forecast_values = np.array([last_l + (h + 1) * last_b for h in range(horizon_months)])
        forecast_values = np.clip(forecast_values, 0, None)
        
    else:
        raise ValueError(f"Unknown model type: {model_type}")

    # 2. Performance Metrics
    residuals = y - fit_values
    mae = np.mean(np.abs(residuals))
    rmse = np.sqrt(np.mean(residuals ** 2))
    mape = np.mean(np.abs(residuals / np.where(y == 0, 1e-5, y))) * 100
    
    ss_res = np.sum(residuals ** 2)
    ss_tot = np.sum((y - np.mean(y)) ** 2)
    r2 = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

    # 3. Confidence Intervals
    std_err = np.std(residuals) if len(residuals) > 1 else y[0]*0.1
    if std_err == 0:
        std_err = y[0] * 0.05
        
    ci_factor = np.sqrt(np.arange(1, horizon_months + 1))
    
    ci_80_lower = np.clip(forecast_values - 1.28 * std_err * ci_factor, 0, None)
    ci_80_upper = forecast_values + 1.28 * std_err * ci_factor
    
    ci_95_lower = np.clip(forecast_values - 1.96 * std_err * ci_factor, 0, None)
    ci_95_upper = forecast_values + 1.96 * std_err * ci_factor

    # 4. Insights & Anomaly Detection
    total_sales = np.sum(y)
    avg_sales = np.mean(y)
    
    # Calculate historical growth
    first_half_avg = np.mean(y[:max(1, n_historical // 2)])
    second_half_avg = np.mean(y[max(1, n_historical // 2):])
    historical_growth = ((second_half_avg - first_half_avg) / first_half_avg * 100) if first_half_avg > 0 else 0.0
    
    # Forecast growth
    last_hist_val = y[-1]
    forecast_avg = np.mean(forecast_values)
    forecasted_growth = ((forecast_avg - last_hist_val) / last_hist_val * 100) if last_hist_val > 0 else 0.0

    coef_var = (np.std(y) / avg_sales * 100) if avg_sales > 0 else 0.0
    
    insights = []
    
    # Anomaly Detection
    sales_mean = np.mean(y)
    sales_std = np.std(y)
    if sales_std > 0:
        anomalies = []
        for idx, (val, d) in enumerate(zip(y, dates)):
            # Outlier check (> 2.0 standard deviations from the dataset mean)
            z_score = (val - sales_mean) / sales_std
            if abs(z_score) > 2.0:
                anomalies.append((pd.to_datetime(d).strftime('%B %Y'), val, z_score))
        
        for date_str, val, z in anomalies:
            direction = "surge" if z > 0 else "drop"
            insights.append({
                'type': 'warning',
                'title': f"Sales Outlier: {date_str}",
                'text': f"Sales experienced a significant {direction} reaching ${val:,.2f} (Z-Score: {z:.2f}). Inspect external drivers, special campaigns, or transaction logs."
            })
            
    # Trend insights
    if forecasted_growth > 5:
        insights.append({
            'type': 'positive',
            'title': 'Upward Trend Detected',
            'text': f"Sales are projected to grow by {forecasted_growth:.1f}% on average over the next {horizon_months} months compared to the final historical month. Consider scaling up inventory and sales capacity."
        })
    elif forecasted_growth < -5:
        insights.append({
            'type': 'negative',
            'title': 'Downward Trend Projected',
            'text': f"Sales are projected to decline by {abs(forecasted_growth):.1f}% over the forecast horizon. Look into promotional campaigns, cost-reduction, or product line reviews."
        })
    else:
        insights.append({
            'type': 'warning',
            'title': 'Stable Trend Predicted',
            'text': f"Sales are projected to remain stable (change of {forecasted_growth:.1f}%). Use this period to optimize internal operations and build customer relationships."
        })

    # Volatility insight
    if coef_var > 25:
        insights.append({
            'type': 'warning',
            'title': 'High Volatility Notice',
            'text': f"Historical sales display high volatility (fluctuation index of {coef_var:.1f}%). The forecast has wider margins of error. Maintain a safety stock of popular items."
        })
    else:
        insights.append({
            'type': 'positive',
            'title': 'Consistent Sales Flow',
            'text': f"Historical sales are highly consistent (fluctuation index of {coef_var:.1f}%). This increases model confidence and makes supply chain planning highly predictable."
        })

    # Accuracy Fit
    if r2 > 0.7:
        insights.append({
            'type': 'positive',
            'title': 'High Model Fit Accuracy',
            'text': f"The '{model_type.replace('_', ' ').title()}' model explains {r2*100:.1f}% of the sales variance. You can use these projections with high confidence for strategic decisions."
        })
    elif r2 > 0.4:
        insights.append({
            'type': 'warning',
            'title': 'Moderate Model Fit Accuracy',
            'text': f"The model has moderate fit (R-squared: {r2:.2f}). External variables (promotions, season) might influence sales. Review this forecast alongside qualitative reports."
        })
    else:
        insights.append({
            'type': 'negative',
            'title': 'Low Historical Correlation',
            'text': f"The R-squared value is low ({r2:.2f}), suggesting sales patterns are highly irregular. Consider using 'Moving Average' to smooth patterns or gather more historical data."
        })

    # Format output for API
    historical_data = []
    for d, val, fit in zip(dates, y, fit_values):
        historical_data.append({
            'date': pd.to_datetime(d).strftime('%Y-%m-%d'),
            'actual': float(val),
            'fitted': float(fit)
        })
        
    forecast_data = []
    for d, val, l80, u80, l95, u95 in zip(future_dates, forecast_values, ci_80_lower, ci_80_upper, ci_95_lower, ci_95_upper):
        forecast_data.append({
            'date': pd.to_datetime(d).strftime('%Y-%m-%d'),
            'forecast': float(val),
            'ci_80_lower': float(l80),
            'ci_80_upper': float(u80),
            'ci_95_lower': float(l95),
            'ci_95_upper': float(u95)
        })

    metrics = {
        'total_sales': float(total_sales),
        'avg_monthly_sales': float(avg_sales),
        'historical_growth': float(historical_growth),
        'projected_growth': float(forecasted_growth),
        'r2': float(r2),
        'rmse': float(rmse),
        'mae': float(mae),
        'mape': float(mape)
    }

    return {
        'historical': historical_data,
        'forecast': forecast_data,
        'metrics': metrics,
        'insights': insights
    }
