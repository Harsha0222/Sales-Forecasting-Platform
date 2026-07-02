// ==========================================================================
// PREDICTA SALES PLATFORM - FRONTEND APPLICATION SCRIPT
// ==========================================================================

// Global Application State
const state = {
    user: null,
    currentFile: null,
    forecastData: null, 
    tablePage: 0,
    tablePageSize: 10,
    chartInstance: null
};

// DOM Elements
const elements = {
    authContainer: document.getElementById('auth-container'),
    dashboardContainer: document.getElementById('dashboard-container'),
    
    // Auth Forms
    loginPanel: document.getElementById('login-form-panel'),
    registerPanel: document.getElementById('register-form-panel'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    linkToRegister: document.getElementById('link-to-register'),
    linkToLogin: document.getElementById('link-to-login'),
    authAlert: document.getElementById('auth-alert'),
    authAlertMsg: document.getElementById('auth-alert-message'),
    registerPassword: document.getElementById('register-password'),
    strengthBar: document.getElementById('strength-bar'),
    strengthLabel: document.getElementById('strength-label'),
    
    // Sidebar & Profile
    sidebarUsername: document.getElementById('sidebar-username'),
    userAvatarInitials: document.getElementById('user-avatar-initials'),
    btnLogout: document.getElementById('btn-logout'),
    
    // Upload Components
    activeFileBadge: document.getElementById('active-file-badge'),
    activeFileText: document.getElementById('active-file-text'),
    uploadDropzone: document.getElementById('upload-dropzone'),
    fileInput: document.getElementById('file-input'),
    btnBrowseFiles: document.getElementById('btn-browse-files'),
    uploadProgressContainer: document.getElementById('upload-progress-container'),
    uploadProgressBar: document.getElementById('upload-progress-bar'),
    uploadError: document.getElementById('upload-error'),
    uploadErrorMsg: document.getElementById('upload-error-message'),
    
    // PDF Report Button
    btnPrintReport: document.getElementById('btn-print-report'),
    
    // Analytics Workspace
    analyticsWorkspace: document.getElementById('analytics-workspace'),
    
    // Metrics Card Values
    metricTotalSales: document.getElementById('metric-total-sales'),
    metricAvgSales: document.getElementById('metric-avg-sales'),
    metricDataPoints: document.getElementById('metric-datapoints-count'),
    metricR2: document.getElementById('metric-r2'),
    badgeR2Status: document.getElementById('badge-r2-status'),
    metricGrowth: document.getElementById('metric-growth'),
    badgeGrowthStatus: document.getElementById('badge-growth-status'),
    
    // Controls
    paramModelType: document.getElementById('param-model-type'),
    paramHorizon: document.getElementById('param-horizon'),
    paramCategory: document.getElementById('param-category'),
    controlGroupCategory: document.getElementById('control-group-category'),
    
    // Data Views
    insightsList: document.getElementById('insights-list'),
    projectionsTableBody: document.getElementById('projections-table-body'),
    tablePaginationInfo: document.getElementById('table-pagination-info'),
    btnPrevPage: document.getElementById('btn-prev-page'),
    btnNextPage: document.getElementById('btn-next-page'),
    btnExportForecast: document.getElementById('btn-export-forecast'),
    
    // Canvas
    chartCanvas: document.getElementById('sales-forecast-chart')
};

// ==========================================================================
// 1. Initial Setup, Session Check & Theme Loaders
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Load cached theme
    const savedTheme = localStorage.getItem('theme');
    const isLight = savedTheme === 'light';
    if (isLight) {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
    updateThemeIcon(isLight);

    checkSession();
    setupEventListeners();
});

// Check if user is already logged in
async function checkSession() {
    try {
        const response = await fetch('/api/session');
        const data = await response.json();
        
        if (data.authenticated) {
            loginSession(data.user);
            if (data.current_file) {
                state.currentFile = data.current_file;
                elements.activeFileBadge.className = "badge success-badge";
                elements.activeFileText.textContent = data.current_file;
                elements.activeFileBadge.classList.remove('hidden');
                elements.analyticsWorkspace.classList.remove('hidden');
                elements.btnPrintReport.classList.remove('hidden');
                
                triggerForecast();
            }
        } else {
            logoutSession();
        }
    } catch (err) {
        console.error('Session verification failed:', err);
        logoutSession();
    }
}

// ==========================================================================
// 2. Authentication & View Switcher Event Listeners
// ==========================================================================
function setupEventListeners() {
    // Auth Panel toggling
    elements.linkToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        hideAuthAlert();
        elements.loginPanel.classList.remove('active');
        elements.registerPanel.classList.add('active');
    });
    
    elements.linkToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        hideAuthAlert();
        elements.registerPanel.classList.remove('active');
        elements.loginPanel.classList.add('active');
    });
    
    // Register Password Strength Evaluator
    elements.registerPassword.addEventListener('input', () => {
        const password = elements.registerPassword.value;
        evaluatePasswordStrength(password);
    });

    // Login Form Submit
    elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAuthAlert();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        
        const btn = document.getElementById('btn-login-submit');
        setLoading(btn, true);
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            
            if (response.ok) {
                loginSession(data.user);
            } else {
                showAuthAlert(data.error || 'Login failed. Please check credentials.');
            }
        } catch (err) {
            showAuthAlert('Network error. Unable to contact server.');
        } finally {
            setLoading(btn, false);
        }
    });

    // Register Form Submit
    elements.registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAuthAlert();
        const username = document.getElementById('register-username').value;
        const password = elements.registerPassword.value;
        
        const btn = document.getElementById('btn-register-submit');
        setLoading(btn, true);
        
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            
            if (response.ok) {
                showAuthAlert(data.message, 'success');
                setTimeout(() => {
                    elements.linkToLogin.click();
                    document.getElementById('login-username').value = username;
                }, 1500);
            } else {
                showAuthAlert(data.error || 'Registration failed.');
            }
        } catch (err) {
            showAuthAlert('Network error. Unable to contact server.');
        } finally {
            setLoading(btn, false);
        }
    });

    // Logout Action
    elements.btnLogout.addEventListener('click', async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
            logoutSession();
        } catch (err) {
            console.error('Logout request failed:', err);
        }
    });

    // Navigation subviews router click triggers
    document.getElementById('nav-home').addEventListener('click', () => switchSubview('home'));
    document.getElementById('nav-dashboard').addEventListener('click', () => switchSubview('dashboard'));
    document.getElementById('nav-profile').addEventListener('click', () => switchSubview('profile'));
    
    // Sidebar User Profile card shortcut
    document.getElementById('sidebar-profile-card').addEventListener('click', () => switchSubview('profile'));
    
    // Home banner quick shortcuts
    document.getElementById('btn-goto-forecaster').addEventListener('click', () => switchSubview('dashboard'));

    // Theme Switcher Button
    document.getElementById('btn-theme-toggle').addEventListener('click', () => {
        const isLight = document.body.classList.toggle('light-theme');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        updateThemeIcon(isLight);
        
        // Redraw chart to dynamically adapt grid/text colors to active theme
        if (state.forecastData) {
            renderForecastChart(state.forecastData);
        }
    });

    // History select file dropdown trigger
    document.getElementById('history-file-select').addEventListener('change', (e) => {
        const selectedFile = e.target.value;
        if (selectedFile) {
            loadPastFile(selectedFile);
        }
    });

    // ================= UPLOAD ZONE EVENT LISTENERS =================
    elements.btnBrowseFiles.addEventListener('click', () => {
        elements.fileInput.click();
    });
    
    elements.fileInput.addEventListener('change', () => {
        if (elements.fileInput.files.length > 0) {
            handleFileUpload(elements.fileInput.files[0]);
        }
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        elements.uploadDropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            elements.uploadDropzone.classList.add('dragover');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        elements.uploadDropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            elements.uploadDropzone.classList.remove('dragover');
        }, false);
    });
    
    elements.uploadDropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    // ================= FORECAST PARAMETERS TRIGGER =================
    elements.paramModelType.addEventListener('change', () => triggerForecast());
    elements.paramHorizon.addEventListener('change', () => triggerForecast());
    elements.paramCategory.addEventListener('change', () => triggerForecast());

    // ================= REPORT / PRINT EVENT LISTENER =================
    elements.btnPrintReport.addEventListener('click', () => {
        window.print();
    });

    // ================= PAGINATION LISTENERS =================
    elements.btnPrevPage.addEventListener('click', () => {
        if (state.tablePage > 0) {
            state.tablePage--;
            renderProjectionsTable();
        }
    });
    
    elements.btnNextPage.addEventListener('click', () => {
        const maxPages = Math.ceil(getAllTableRows().length / state.tablePageSize);
        if (state.tablePage < maxPages - 1) {
            state.tablePage++;
            renderProjectionsTable();
        }
    });

    // ================= EXPORT BUTTON LISTENER =================
    elements.btnExportForecast.addEventListener('click', () => exportForecastCSV());

    // ================= DOUBLE CLICK GRAPH RESET =================
    elements.chartCanvas.addEventListener('dblclick', () => {
        if (state.chartInstance) {
            state.chartInstance.resetZoom();
        }
    });
}

function loginSession(user) {
    state.user = user;
    elements.sidebarUsername.textContent = user.username;
    elements.userAvatarInitials.textContent = user.username.substring(0, 2).toUpperCase();
    
    elements.authContainer.className = "page-container auth-page hidden";
    elements.dashboardContainer.className = "page-container dashboard-page";
    
    // Switch to Home subview
    switchSubview('home');
}

function logoutSession() {
    state.user = null;
    state.currentFile = null;
    state.forecastData = null;
    state.tablePage = 0;
    
    if (state.chartInstance) {
        state.chartInstance.destroy();
        state.chartInstance = null;
    }
    
    elements.activeFileBadge.className = "badge warning-badge hidden";
    elements.activeFileText.textContent = "No active dataset";
    elements.analyticsWorkspace.classList.add('hidden');
    elements.btnPrintReport.classList.add('hidden');
    elements.controlGroupCategory.classList.add('hidden');
    
    elements.dashboardContainer.className = "page-container dashboard-page hidden";
    elements.authContainer.className = "page-container auth-page";
    elements.loginPanel.classList.add('active');
    elements.registerPanel.classList.remove('active');
    
    elements.loginForm.reset();
    elements.registerForm.reset();
    evaluatePasswordStrength('');
}


// Password Strength Checker
function evaluatePasswordStrength(password) {
    let score = 0;
    if (password.length >= 6) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[A-Z]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
    
    elements.strengthBar.className = "strength-bar";
    if (password.length === 0) {
        elements.strengthLabel.textContent = "Password Strength";
        elements.strengthBar.style.width = "0%";
    } else if (score === 1) {
        elements.strengthBar.classList.add('weak');
        elements.strengthLabel.textContent = "Weak Password (add numbers/symbols)";
    } else if (score === 2) {
        elements.strengthBar.classList.add('medium');
        elements.strengthLabel.textContent = "Medium Password (add caps/symbols)";
    } else if (score === 3) {
        elements.strengthBar.classList.add('strong');
        elements.strengthLabel.textContent = "Strong Secure Password";
    }
}

// Helpers
function setLoading(btn, isLoading) {
    const textSpan = btn.querySelector('span');
    const loaderSpan = btn.querySelector('.btn-loader');
    
    if (isLoading) {
        btn.disabled = true;
        textSpan.classList.add('hidden');
        loaderSpan.classList.remove('hidden');
    } else {
        btn.disabled = false;
        textSpan.classList.remove('hidden');
        loaderSpan.classList.add('hidden');
    }
}

function showAuthAlert(message, type = 'error') {
    elements.authAlert.className = `alert ${type}`;
    elements.authAlertMsg.textContent = message;
    elements.authAlert.classList.remove('hidden');
}

function hideAuthAlert() {
    elements.authAlert.classList.add('hidden');
}

// ==========================================================================
// 3. File Upload Management
// ==========================================================================
async function handleFileUpload(file) {
    hideUploadError();
    elements.uploadProgressContainer.classList.remove('hidden');
    elements.uploadProgressBar.style.width = '20%';
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        elements.uploadProgressBar.style.width = '50%';
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        elements.uploadProgressBar.style.width = '80%';
        const data = await response.json();
        
        if (response.ok) {
            elements.uploadProgressBar.style.width = '100%';
            elements.activeFileBadge.className = "badge success-badge";
            elements.activeFileText.textContent = data.filename;
            
            // Populate category select list if category column was parsed
            populateCategoryFilter(data.summary.categories);
            
            setTimeout(() => {
                elements.uploadProgressContainer.classList.add('hidden');
                triggerForecast();
            }, 500);
        } else {
            elements.uploadProgressContainer.classList.add('hidden');
            showUploadError(data.error || 'Failed to upload file.');
        }
    } catch (err) {
        elements.uploadProgressContainer.classList.add('hidden');
        showUploadError('Network error uploading file.');
    }
}

function populateCategoryFilter(categories) {
    elements.paramCategory.innerHTML = '';
    
    if (categories && categories.length > 0) {
        // Add default 'All'
        const allOpt = document.createElement('option');
        allOpt.value = 'All';
        allOpt.textContent = 'All Categories';
        elements.paramCategory.appendChild(allOpt);
        
        // Loop individual categories
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            elements.paramCategory.appendChild(opt);
        });
        
        elements.controlGroupCategory.classList.remove('hidden');
    } else {
        elements.controlGroupCategory.classList.add('hidden');
    }
}

function showUploadError(msg) {
    elements.uploadErrorMsg.textContent = msg;
    elements.uploadError.classList.remove('hidden');
}

function hideUploadError() {
    elements.uploadError.classList.add('hidden');
}

// ==========================================================================
// 4. Analytics & Forecasting Engine Request
// ==========================================================================
async function triggerForecast() {
    const modelType = elements.paramModelType.value;
    const horizon = elements.paramHorizon.value;
    const category = elements.paramCategory.value || 'All';
    
    try {
        const response = await fetch('/api/forecast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                model_type: modelType, 
                horizon: parseInt(horizon),
                category: category
            })
        });
        const data = await response.json();
        
        if (response.ok) {
            state.forecastData = data;
            state.tablePage = 0;
            
            // Render UI Components
            populateMetricsCards(data.metrics);
            renderForecastChart(data);
            populateInsights(data.insights);
            renderProjectionsTable();
            
            // Reveal workspace
            elements.analyticsWorkspace.classList.remove('hidden');
            elements.btnPrintReport.classList.remove('hidden');
        } else {
            console.error('Forecasting calculation failed:', data.error);
        }
    } catch (err) {
        console.error('Network error during forecasting:', err);
    }
}

// Populate KPI cards
function populateMetricsCards(metrics) {
    const fmtCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
    
    elements.metricTotalSales.textContent = fmtCurrency(metrics.total_sales);
    elements.metricAvgSales.textContent = fmtCurrency(metrics.avg_monthly_sales);
    elements.metricDataPoints.querySelector('span').textContent = `${state.forecastData.historical.length} Months`;
    
    // R2 Value
    elements.metricR2.textContent = metrics.r2.toFixed(3);
    elements.badgeR2Status.className = 'metric-badge';
    if (metrics.r2 > 0.7) {
        elements.badgeR2Status.classList.add('positive-badge');
        elements.badgeR2Status.querySelector('span').textContent = 'Strong Fit';
    } else if (metrics.r2 > 0.4) {
        elements.badgeR2Status.classList.add('neutral-badge');
        elements.badgeR2Status.querySelector('span').textContent = 'Moderate';
    } else {
        elements.badgeR2Status.classList.add('negative-badge');
        elements.badgeR2Status.querySelector('span').textContent = 'Weak Correlation';
    }
    
    // Projected Growth Rate
    const growth = metrics.projected_growth;
    elements.metricGrowth.textContent = `${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`;
    elements.badgeGrowthStatus.className = 'metric-badge';
    if (growth > 5) {
        elements.badgeGrowthStatus.classList.add('positive-badge');
        elements.badgeGrowthStatus.querySelector('span').textContent = 'Growth';
    } else if (growth < -5) {
        elements.badgeGrowthStatus.classList.add('negative-badge');
        elements.badgeGrowthStatus.querySelector('span').textContent = 'Decline';
    } else {
        elements.badgeGrowthStatus.classList.add('neutral-badge');
        elements.badgeGrowthStatus.querySelector('span').textContent = 'Stable';
    }
}

// Populate diagnostic text insights
function populateInsights(insights) {
    elements.insightsList.innerHTML = '';
    
    if (insights.length === 0) {
        elements.insightsList.innerHTML = `
            <div class="insight-block">
                <div class="insight-status-dot" style="background: var(--text-muted)"></div>
                <div>
                    <h4>No anomalies detected</h4>
                    <p>Sales pattern behaves according to default statistical distributions.</p>
                </div>
            </div>`;
        return;
    }
    
    insights.forEach(item => {
        const div = document.createElement('div');
        div.className = `insight-block ${item.type}`;
        div.innerHTML = `
            <div class="insight-status-dot"></div>
            <div>
                <h4>${item.title}</h4>
                <p>${item.text}</p>
            </div>
        `;
        elements.insightsList.appendChild(div);
    });
}

// ==========================================================================
// 5. Chart rendering using Chart.js with Zoom capabilities
// ==========================================================================
function renderForecastChart(data) {
    const ctx = elements.chartCanvas.getContext('2d');
    
    // Read the active theme state
    const isLightTheme = document.body.classList.contains('light-theme');
    
    const legendColor = isLightTheme ? '#0f172a' : '#f3f4f6';
    const tickColor = isLightTheme ? '#334155' : '#9ca3af';
    const gridColor = isLightTheme ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.05)';
    const fittedLineColor = isLightTheme ? 'rgba(15, 23, 42, 0.3)' : 'rgba(255, 255, 255, 0.35)';
    
    const histDates = data.historical.map(h => h.date);
    const forecastDates = data.forecast.map(f => f.date);
    const allLabels = [...histDates, ...forecastDates];
    
    const actuals = data.historical.map(h => h.actual);
    const fitted = data.historical.map(h => h.fitted);
    
    const nullPadding = Array(data.historical.length - 1).fill(null);
    const lastActual = actuals[actuals.length - 1];
    
    const forecasts = [...nullPadding, lastActual, ...data.forecast.map(f => f.forecast)];
    
    const ci80Lower = [...nullPadding, lastActual, ...data.forecast.map(f => f.ci_80_lower)];
    const ci80Upper = [...nullPadding, lastActual, ...data.forecast.map(f => f.ci_80_upper)];
    
    const ci95Lower = [...nullPadding, lastActual, ...data.forecast.map(f => f.ci_95_lower)];
    const ci95Upper = [...nullPadding, lastActual, ...data.forecast.map(f => f.ci_95_upper)];
    
    if (state.chartInstance) {
        state.chartInstance.destroy();
    }
    
    state.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: allLabels,
            datasets: [
                {
                    label: 'Historical Actual Sales',
                    data: actuals,
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.15,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Model Fitted Fit',
                    data: fitted,
                    borderColor: fittedLineColor,
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.15,
                    pointRadius: 0
                },
                {
                    label: 'Forecast Project',
                    data: forecasts,
                    borderColor: '#c084fc',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.1,
                    pointRadius: 3,
                    pointHoverRadius: 5
                },
                // 95% Confidence Interval
                {
                    label: '95% CI Lower',
                    data: ci95Lower,
                    borderColor: 'transparent',
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: '95% Confidence Interval (Lighter)',
                    data: ci95Upper,
                    borderColor: 'transparent',
                    pointRadius: 0,
                    fill: '-1', 
                    backgroundColor: 'rgba(192, 132, 252, 0.08)'
                },
                // 80% Confidence Interval
                {
                    label: '80% CI Lower',
                    data: ci80Lower,
                    borderColor: 'transparent',
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: '80% Confidence Interval (Darker)',
                    data: ci80Upper,
                    borderColor: 'transparent',
                    pointRadius: 0,
                    fill: '-1',
                    backgroundColor: 'rgba(192, 132, 252, 0.15)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x'
                    },
                    zoom: {
                        wheel: {
                            enabled: true
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x'
                    }
                },
                legend: {
                    labels: {
                        color: legendColor,
                        filter: function(item) {
                            return !item.text.includes('CI Lower');
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label.includes('Lower') || label.includes('Upper')) return null;
                            if (context.parsed.y !== null) {
                                label += ': ' + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: tickColor,
                        maxTicksLimit: 12
                    }
                },
                y: {
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: tickColor,
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}


// ==========================================================================
// 6. Projections Grid (Table View) & Pagination
// ==========================================================================
function getAllTableRows() {
    if (!state.forecastData) return [];
    
    const histRows = state.forecastData.historical.map(h => ({
        date: h.date,
        type: 'Historical',
        amount: h.actual,
        margin: 'N/A'
    }));
    
    const forecastRows = state.forecastData.forecast.map(f => ({
        date: f.date,
        type: 'Forecast',
        amount: f.forecast,
        margin: `${Math.round(f.ci_95_lower).toLocaleString()} - ${Math.round(f.ci_95_upper).toLocaleString()}`
    }));
    
    return [...histRows, ...forecastRows].reverse();
}

function renderProjectionsTable() {
    const rows = getAllTableRows();
    const count = rows.length;
    
    const maxPages = Math.ceil(count / state.tablePageSize);
    
    if (state.tablePage >= maxPages) state.tablePage = Math.max(0, maxPages - 1);
    
    const startIdx = state.tablePage * state.tablePageSize;
    const endIdx = Math.min(startIdx + state.tablePageSize, count);
    
    const pageRows = rows.slice(startIdx, endIdx);
    
    elements.projectionsTableBody.innerHTML = '';
    
    pageRows.forEach(row => {
        const tr = document.createElement('tr');
        if (row.type === 'Forecast') {
            tr.className = 'forecast-row';
        }
        
        const formattedAmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.amount);
        
        tr.innerHTML = `
            <td>${row.date}</td>
            <td><span class="badge ${row.type === 'Historical' ? 'success-badge' : 'warning-badge'}">${row.type}</span></td>
            <td class="font-mono">${formattedAmt}</td>
            <td class="font-mono">${row.margin}</td>
        `;
        
        elements.projectionsTableBody.appendChild(tr);
    });
    
    elements.tablePaginationInfo.textContent = count > 0 
        ? `Showing ${startIdx + 1}-${endIdx} of ${count} periods`
        : 'Showing 0-0 of 0 periods';
        
    elements.btnPrevPage.disabled = state.tablePage === 0;
    elements.btnNextPage.disabled = state.tablePage >= maxPages - 1 || count === 0;
}

// ==========================================================================
// 7. Data Export Functionality
// ==========================================================================
function exportForecastCSV() {
    if (!state.forecastData) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Type,Actual_Or_Projected,CI_95_Lower,CI_95_Upper\r\n";
    
    state.forecastData.historical.forEach(h => {
        csvContent += `${h.date},Historical,${h.actual},,\r\n`;
    });
    
    state.forecastData.forecast.forEach(f => {
        csvContent += `${f.date},Forecast,${f.forecast},${f.ci_95_lower},${f.ci_95_upper}\r\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_forecast_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Dynamic Print-mode Adjustment for Chart.js typography legibility
window.addEventListener('beforeprint', () => {
    if (state.chartInstance) {
        const options = state.chartInstance.options;
        
        // Convert to high-contrast dark colors for print rendering
        options.plugins.legend.labels.color = '#0f172a';
        options.scales.x.ticks.color = '#1e293b';
        options.scales.x.grid.color = 'rgba(15, 23, 42, 0.08)';
        options.scales.y.ticks.color = '#1e293b';
        options.scales.y.grid.color = 'rgba(15, 23, 42, 0.08)';
        
        // Make model fitted line darker during print
        state.chartInstance.data.datasets[1].borderColor = 'rgba(15, 23, 42, 0.4)';
        
        state.chartInstance.update('none'); // Update silently without animations
    }
});

window.addEventListener('afterprint', () => {
    if (state.chartInstance) {
        const options = state.chartInstance.options;
        
        // Restore neon light theme configurations for the screen
        options.plugins.legend.labels.color = '#f3f4f6';
        options.scales.x.ticks.color = '#9ca3af';
        options.scales.x.grid.color = 'rgba(255, 255, 255, 0.05)';
        options.scales.y.ticks.color = '#9ca3af';
        options.scales.y.grid.color = 'rgba(255, 255, 255, 0.05)';
        
        // Restore model fitted line transparency
        state.chartInstance.data.datasets[1].borderColor = 'rgba(255, 255, 255, 0.35)';
        
        state.chartInstance.update('none');
    }
});

// ==========================================================================
// 8. Navigation Views Switcher & Profile/History Loaders
// ==========================================================================
function switchSubview(viewId) {
    // Hide all subview panes
    document.querySelectorAll('.subview-pane').forEach(p => p.classList.add('hidden'));
    // Show active subview pane
    const activePane = document.getElementById(`subview-${viewId}`);
    if (activePane) activePane.classList.remove('hidden');
    
    // Update active nav-item class in sidebar
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Highlight sidebar nav selection
    const navItem = document.getElementById(`nav-${viewId}`);
    if (navItem) {
        navItem.classList.add('active');
    }
    
    // Set headers Title / Subtitle dynamically
    const pageTitle = document.getElementById('page-title-label');
    const pageSubtitle = document.getElementById('page-subtitle-label');
    
    if (viewId === 'home') {
        pageTitle.textContent = "Home Dashboard";
        pageSubtitle.textContent = "Welcome to your sales forecasting command center.";
        elements.btnPrintReport.classList.add('hidden');
        elements.activeFileBadge.classList.add('hidden');
        loadHomeData(); // Reload recent uploads and profile stats
    } else if (viewId === 'dashboard') {
        pageTitle.textContent = "Sales Forecasting Command Center";
        pageSubtitle.textContent = "Upload sales datasets, run statistical models, and download accurate projections.";
        
        // Show active file badge in Forecaster tab
        elements.activeFileBadge.classList.remove('hidden');
        if (state.currentFile) {
            elements.btnPrintReport.classList.remove('hidden');
            elements.activeFileBadge.className = "badge success-badge";
            elements.activeFileText.textContent = state.currentFile;
        } else {
            elements.btnPrintReport.classList.add('hidden');
            elements.activeFileBadge.className = "badge warning-badge";
            elements.activeFileText.textContent = "No active dataset";
        }
        loadHistoryDropdown(); // Populate history select
    } else if (viewId === 'profile') {
        pageTitle.textContent = "User Profile Settings";
        pageSubtitle.textContent = "Manage your database configuration and account credentials.";
        elements.btnPrintReport.classList.add('hidden');
        elements.activeFileBadge.classList.add('hidden');
        loadProfileData(); // Fetch profile details
    }
}

async function loadHomeData() {
    // Set username displays
    document.querySelectorAll('.username-display').forEach(el => {
        el.textContent = state.user ? state.user.username : 'User';
    });
    
    try {
        // Fetch profile stats
        const profileRes = await fetch('/api/profile');
        const stats = await profileRes.json();
        if (profileRes.ok) {
            document.getElementById('home-stat-uploads').textContent = stats.total_uploads;
            document.getElementById('home-stat-db').textContent = stats.database_type;
        }
        
        // Fetch upload history list
        const historyRes = await fetch('/api/uploads');
        const data = await historyRes.json();
        if (historyRes.ok) {
            const listContainer = document.getElementById('home-recent-uploads');
            listContainer.innerHTML = '';
            
            if (data.uploads.length === 0) {
                listContainer.innerHTML = '<p class="text-muted text-center py-3">No past uploads found.</p>';
                return;
            }
            
            // Show up to 5 recent uploads
            listContainer.innerHTML = '';
            data.uploads.slice(0, 5).forEach(item => {
                const div = document.createElement('div');
                div.className = 'history-item';
                div.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px; color: var(--color-primary);"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        <strong>${item.filename}</strong>
                    </div>
                    <span class="text-muted" style="font-size: 0.8rem;">${item.uploaded_at}</span>
                `;
                div.addEventListener('click', () => {
                    loadPastFile(item.filename);
                });
                listContainer.appendChild(div);
            });
        }
    } catch (err) {
        console.error("Error loading home page statistics:", err);
    }
}

async function loadHistoryDropdown() {
    try {
        const response = await fetch('/api/uploads');
        const data = await response.json();
        if (response.ok) {
            const select = document.getElementById('history-file-select');
            select.innerHTML = '<option value="">-- Select a past file --</option>';
            data.uploads.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.filename;
                opt.textContent = `${item.filename} (${item.uploaded_at})`;
                if (state.currentFile === item.filename) {
                    opt.selected = true;
                }
                select.appendChild(opt);
            });
        }
    } catch (err) {
        console.error("Failed to load upload history list dropdown:", err);
    }
}

async function loadProfileData() {
    try {
        const response = await fetch('/api/profile');
        const stats = await response.json();
        if (response.ok) {
            document.getElementById('profile-avatar-big').textContent = stats.username.substring(0, 2).toUpperCase();
            document.getElementById('profile-username-val').textContent = stats.username;
            document.getElementById('profile-member-since').textContent = stats.member_since;
            document.getElementById('profile-stat-db-type').textContent = stats.database_type;
            document.getElementById('profile-stat-total-uploads').textContent = stats.total_uploads;
            document.getElementById('profile-stat-last-upload').textContent = stats.last_upload_at;
        }
    } catch (err) {
        console.error("Failed to load profile view statistics:", err);
    }
}

async function loadPastFile(filename) {
    try {
        elements.uploadProgressContainer.classList.remove('hidden');
        elements.uploadError.classList.add('hidden');
        
        const response = await fetch('/api/uploads/load', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        const data = await response.json();
        
        elements.uploadProgressContainer.classList.add('hidden');
        
        if (response.ok) {
            state.currentFile = data.filename;
            
            // Switch views to Forecaster!
            switchSubview('dashboard');
            
            // Populate category selector
            populateCategoryFilter(data.summary.categories);
            
            // Reveal analytics dashboard UI
            elements.activeFileBadge.className = "badge success-badge";
            elements.activeFileText.textContent = data.filename;
            elements.activeFileBadge.classList.remove('hidden');
            elements.analyticsWorkspace.classList.remove('hidden');
            elements.btnPrintReport.classList.remove('hidden');
            
            // Trigger initial forecast
            triggerForecast();
        } else {
            showUploadError(data.error || 'Failed to load historical dataset.');
        }
    } catch (err) {
        elements.uploadProgressContainer.classList.add('hidden');
        showUploadError('Network error loading file from database.');
    }
}

function updateThemeIcon(isLight) {
    const sun = document.querySelector('.theme-icon-sun');
    const moon = document.querySelector('.theme-icon-moon');
    if (isLight) {
        sun.classList.remove('hidden');
        moon.classList.add('hidden');
    } else {
        sun.classList.add('hidden');
        moon.classList.remove('hidden');
    }
}


