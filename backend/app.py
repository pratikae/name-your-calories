from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv
import random
from database import db, MenuItem

load_dotenv()

app = Flask(__name__)
CORS(app)

API_ID = os.getenv("NUTRITIONIX_APP_ID")
API_KEY = os.getenv("NUTRITIONIX_API_KEY")

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///menu_items.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

@app.route('/api/menu')
def get_menu():
    restaurant = request.args.get('restaurant', '').lower()
    cal_limit = int(request.args.get('calorieLimit', 0))

    items = MenuItem.query.filter(
        MenuItem.restaurant == restaurant,
        MenuItem.calories <= cal_limit
    ).all()

    if not items:
        return jsonify("no items"), 200

    return jsonify(random.sample([
        {
            "name": item.name,
            "calories": item.calories,
            "brand": item.brand,
            "category": item.category
        } for item in items
    ], min(3, len(items))))


if __name__ == "__main__":
    app.run(debug=True)
