from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv
import random

load_dotenv()

app = Flask(__name__)
CORS(app)

API_ID = os.getenv("NUTRITIONIX_APP_ID")
API_KEY = os.getenv("NUTRITIONIX_API_KEY")

@app.route('/api/menu')
def get_menu():
    restaurant = request.args.get('restaurant')
    cal_limit = int(request.args.get('calorieLimit'))

    headers = {
        'x-app-id': API_ID,
        'x-app-key': API_KEY
    }

    search_url = "https://trackapi.nutritionix.com/v2/search/instant"
    params = {'query': restaurant}

    response = requests.get(search_url, headers=headers, params=params)
    data = response.json()
    branded = data.get('branded', [])

    # only get first 20 results so it doesnt go crazy
    branded = branded[:20]

    results = []

    for item in branded:
        item_id = item['nix_item_id']
        detail_resp = requests.get(
        "https://trackapi.nutritionix.com/v2/search/item",
        headers=headers,
        params={"nix_item_id": item_id}
        )
        if detail_resp.ok:
            food = detail_resp.json()['foods'][0]
        if food['nf_calories'] <= cal_limit:
            results.append({
                "name": food['food_name'],
                "calories": round(food['nf_calories']),
                "brand": food.get('brand_name'),
                "category": food.get('tags', {}).get('food_group', 'unknown')
            })


    return jsonify(random.sample(results, min(3, len(results))))

if __name__ == "__main__":
    app.run(debug=True)
