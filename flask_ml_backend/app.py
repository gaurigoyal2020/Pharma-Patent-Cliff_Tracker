from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import pandas as pd
import json
from datetime import datetime, timedelta
import os

app = Flask(__name__)
CORS(app)

print("Loading ML models...")
BASE_DIR = os.getcwd()

with open(os.path.join(BASE_DIR, 'flask_ml_backend', 'models', 'patent_lifetime_predictor.pkl'), 'rb') as f:
    prediction_model = pickle.load(f)
with open(os.path.join(BASE_DIR, 'flask_ml_backend', 'models', 'prediction_features.json'), 'r') as f:
    feature_columns = json.load(f)
with open(os.path.join(BASE_DIR, 'flask_ml_backend', 'data', 'eda_statistics.json'), 'r') as f:
    eda_stats = json.load(f)
with open(os.path.join(BASE_DIR, 'flask_ml_backend', 'models', 'patent_classifier_gradient_boosting.pkl'), 'rb') as f:
    binary_classifier = pickle.load(f)

print("All models loaded!")

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'models_loaded': True}), 200

@app.route('/api/predict-expiry', methods=['POST'])
def predict_expiry():
    try:
        data = request.get_json()
        approval_year = int(data['approval_year'])
        approval_month = int(data['approval_month'])
        app_type = data['app_type']
        category = data['category']
        input_data = {
            'approval_year': [approval_year],
            'approval_month': [approval_month],
            'app_type_numeric': [1 if app_type == 'N' else 0]
        }
        for cat in ['Oral', 'Injectable', 'Respiratory', 'Topical', 'Other']:
            input_data['cat_' + cat] = [1 if category == cat else 0]
        input_df = pd.DataFrame(input_data)[feature_columns]
        predicted_days = prediction_model.predict(input_df)[0]
        approval_date = datetime(approval_year, approval_month, 1)
        predicted_expiry = approval_date + timedelta(days=predicted_days)
        level = 'Low' if predicted_days < 5475 else 'Medium' if predicted_days < 7300 else 'High'
        return jsonify({'success': True, 'prediction': {
            'predicted_expiry_date': predicted_expiry.strftime('%Y-%m-%d'),
            'predicted_lifetime_years': round(predicted_days / 365, 1),
            'confidence_interval_days': 1032,
            'confidence_level': level,
            'is_prediction': True,
            'note': 'ML prediction, not official FDA data'
        }}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/classify-status', methods=['POST'])
def classify_status():
    try:
        data = request.get_json()
        input_df = pd.DataFrame([{
            'expiry_year': int(data['expiry_year']),
            'expiry_month': int(data['expiry_month']),
            'expiry_day': int(data['expiry_day']),
            'patent_lifetime_days': int(data['patent_lifetime_days']),
            'days_from_today': int(data['days_from_today'])
        }])
        prediction = binary_classifier.predict(input_df)[0]
        probability = binary_classifier.predict_proba(input_df)[0]
        return jsonify({'success': True, 'result': {
            'status': 'Expired' if prediction == 1 else 'Active',
            'confidence_percent': round(float(max(probability)) * 100, 1),
            'is_expired': bool(prediction == 1)
        }}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/insights', methods=['GET'])
def get_insights():
    return jsonify({'success': True, 'data': eda_stats}), 200

if __name__ == '__main__':
    print("FLASK ML BACKEND STARTING on port 5000")
    app.run(host='0.0.0.0', port=5001, debug=False, use_reloader=False)
