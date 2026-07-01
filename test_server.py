import unittest
import pandas as pd
import numpy as np
import os
import shutil

import db
import forecaster

class TestSalesForecaster(unittest.TestCase):
    
    def setUp(self):
        # Override database path to use a test-specific file
        self.test_db_path = os.path.join(os.path.dirname(db.__file__), 'test_sales_platform.db')
        db.DATABASE_PATH = self.test_db_path
        # Initialize test DB
        db.init_db()
        
    def tearDown(self):
        # Clean up test database file
        if os.path.exists(self.test_db_path):
            try:
                os.remove(self.test_db_path)
            except OSError:
                pass

    def test_user_auth(self):
        # Generate random credentials
        username = "testuser_" + str(np.random.randint(1000, 9999))
        password = "SecurePassword123"
        
        # Register user
        reg_success = db.register_user(username, password)
        self.assertTrue(reg_success)
        
        # Re-registration should fail
        reg_success_again = db.register_user(username, password)
        self.assertFalse(reg_success_again)
        
        # Verify valid user credentials
        verified_user = db.verify_user(username, password)
        self.assertIsNotNone(verified_user)
        self.assertEqual(verified_user['username'], username)
        
        # Verify invalid password
        verified_user_wrong = db.verify_user(username, "wrongpassword")
        self.assertIsNone(verified_user_wrong)

    def test_forecasting_logic(self):
        # Create a mock dataframe
        dates = pd.date_range(start='2024-01-01', periods=12, freq='ME')
        sales = [100.0, 110.0, 120.0, 130.0, 125.0, 140.0, 150.0, 160.0, 155.0, 170.0, 180.0, 190.0]
        
        df = pd.DataFrame({
            'ds': dates,
            'y': sales
        })
        
        # 1. Test Linear Forecast
        res_linear = forecaster.generate_forecast(df, horizon_months=6, model_type='linear')
        self.assertIn('historical', res_linear)
        self.assertIn('forecast', res_linear)
        self.assertIn('metrics', res_linear)
        self.assertIn('insights', res_linear)
        self.assertEqual(len(res_linear['historical']), 12)
        self.assertEqual(len(res_linear['forecast']), 6)
        self.assertGreaterEqual(res_linear['metrics']['r2'], 0.5)
        
        # 2. Test Moving Average Forecast
        res_ma = forecaster.generate_forecast(df, horizon_months=4, model_type='moving_average')
        self.assertEqual(len(res_ma['forecast']), 4)
        
        # 3. Test Holt's Exponential Smoothing Forecast
        res_es = forecaster.generate_forecast(df, horizon_months=12, model_type='exponential_smoothing')
        self.assertEqual(len(res_es['forecast']), 12)
        
        # Validate confidence intervals are logically expanding
        ci_first = res_es['forecast'][0]['ci_95_upper'] - res_es['forecast'][0]['ci_95_lower']
        ci_last = res_es['forecast'][-1]['ci_95_upper'] - res_es['forecast'][-1]['ci_95_lower']
        self.assertGreater(ci_last, ci_first)

if __name__ == '__main__':
    unittest.main()
