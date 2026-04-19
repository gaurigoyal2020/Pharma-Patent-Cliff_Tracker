from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import pandas as pd
import json
from datetime import datetime, timedelta
import os

app = Flask(__name__)
CORS(app, origins=[
    'http://localhost:5173',
    'http://localhost:5001',
    'https://pharma-patent-cliff-tracker.vercel.app',
    'https://pharma-patent-cliff-tr-git-760465-drishti-gauri-dishita-project.vercel.app',
    'https://pharma-patent-cliff-tracker-74hhsb7fr.vercel.app'
])

print("Loading ML models...")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(BASE_DIR, 'models', 'patent_lifetime_predictor.pkl'), 'rb') as f:
    prediction_model = pickle.load(f)
with open(os.path.join(BASE_DIR, 'models', 'prediction_features.json'), 'r') as f:
    feature_columns = json.load(f)
with open(os.path.join(BASE_DIR, 'data', 'eda_statistics.json'), 'r') as f:
    eda_stats = json.load(f)
with open(os.path.join(BASE_DIR, 'models', 'patent_classifier_gradient_boosting.pkl'), 'rb') as f:
    binary_classifier = pickle.load(f)


# Load price dataset
PRICES_PATH = os.path.join(BASE_DIR, 'data', 'drug_summary_with_prices.csv')
drugs_prices_df = pd.read_csv(PRICES_PATH)
print("Price dataset loaded!")
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



# Load savings data at startup
import pandas as pd
SAVINGS_PATH = os.path.join(BASE_DIR, 'data', 'drug_summary_with_prices.csv')
TOP10_PATH = os.path.join(BASE_DIR, 'data', 'top10_savings.csv')
CATEGORY_PATH = os.path.join(BASE_DIR, 'data', 'category_savings_analysis.csv')

savings_df = pd.read_csv(SAVINGS_PATH)
top10_df = pd.read_csv(TOP10_PATH)
category_df = pd.read_csv(CATEGORY_PATH)
print("Savings data loaded!")

@app.route('/api/savings/<brand_name>', methods=['GET'])
def get_savings(brand_name):
    try:
        drug = savings_df[
            savings_df['brand_name'].str.upper() == brand_name.upper()
        ]
        if drug.empty:
            drug = savings_df[
                savings_df['brand_name'].str.upper().str.contains(brand_name.upper())
            ]
        if drug.empty:
            return jsonify({'success': False, 'error': 'Drug not found'}), 404

        drug = drug.iloc[0]

        if drug['status'] == 'Active':
            return jsonify({
                'success': True,
                'brand_name': drug['brand_name'],
                'generic_name': drug['generic_name'],
                'status': 'Active',
                'generic_available': 'No',
                'brand_price_monthly': round(float(drug['brand_price_monthly']), 2),
                'brand_price_annual': round(float(drug['brand_price_annual']), 2),
                'earliest_expiry': str(drug['earliest_expiry']),
                'days_until': int(drug['days_until']) if pd.notna(drug['days_until']) else None,
                'message': 'Generic not available yet - patent still active'
            })

        return jsonify({
            'success': True,
            'brand_name': drug['brand_name'],
            'generic_name': drug['generic_name'],
            'category': drug['category'],
            'status': 'Expired',
            'generic_available': 'Yes',
            'brand_price_monthly': round(float(drug['brand_price_monthly']), 2),
            'brand_price_annual': round(float(drug['brand_price_annual']), 2),
            'generic_price_monthly': round(float(drug['generic_price_monthly']), 2),
            'generic_price_annual': round(float(drug['generic_price_annual']), 2),
            'monthly_savings': round(float(drug['monthly_savings']), 2),
            'annual_savings': round(float(drug['annual_savings']), 2),
            'savings_percent': round(float(drug['savings_percent']), 1),
            'savings_5_years': round(float(drug['annual_savings']) * 5, 2),
            'savings_10_years': round(float(drug['annual_savings']) * 10, 2)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/savings/top10', methods=['GET'])
def get_top10():
    try:
        result = top10_df[[
            'brand_name', 'generic_name', 'category',
            'brand_price_monthly', 'generic_price_monthly',
            'monthly_savings', 'annual_savings', 'savings_percent'
        ]].round(2).to_dict('records')
        return jsonify({'success': True, 'top10': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/savings/by-category', methods=['GET'])
def get_savings_by_category():
    try:
        result = category_df.reset_index().round(2).to_dict('records')
        return jsonify({'success': True, 'categories': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/savings/stats', methods=['GET'])
def get_savings_stats():
    try:
        expired = savings_df[savings_df['status'] == 'Expired']
        return jsonify({
            'success': True,
            'stats': {
                'total_drugs': int(len(savings_df)),
                'expired_drugs': int(len(expired)),
                'active_drugs': int(len(savings_df) - len(expired)),
                'avg_brand_price_monthly': round(float(savings_df['brand_price_monthly'].mean()), 2),
                'avg_generic_price_monthly': round(float(expired['generic_price_monthly'].mean()), 2),
                'avg_monthly_savings': round(float(expired['monthly_savings'].mean()), 2),
                'avg_annual_savings': round(float(expired['annual_savings'].mean()), 2),
                'avg_savings_percent': round(float(expired['savings_percent'].mean()), 1),
                'total_annual_savings_pool': round(float(expired['annual_savings'].sum()), 2)
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    print("FLASK ML BACKEND STARTING on port 5000")
    app.run(host='0.0.0.0', port=5001, debug=False, use_reloader=False)
