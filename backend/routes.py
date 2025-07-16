from flask import Blueprint, request, jsonify
from database import db, MenuItem
from sqlalchemy import desc

routes = Blueprint('routes', __name__)

@routes.route('/api/menu')
def get_menu():
    restaurant = request.args.get('restaurant', '').lower()
    cal_max = int(request.args.get('calorieMax', 0))
    cal_min = int(request.args.get('calorieMin', 0))

    items = MenuItem.query.filter(
        MenuItem.restaurant == restaurant,
        MenuItem.calories <= cal_max,
        MenuItem.calories >= cal_min
    ).order_by(desc(MenuItem.calories)).all()

    if not items:
        return jsonify("no items"), 200

    return jsonify([
        {
            "name": item.name,
            "calories": item.calories,
            "protein": item.protein,
            "carbs": item.carbs,
            "fat": item.fat,
            "category": item.category
        } for item in items
    ])
    
@routes.route('/api/get_restaurants')
def get_restaurants():
    restaurant_names = db.session.query(MenuItem.restaurant).distinct().all()
    restaurants = sorted({name for (name,) in restaurant_names})
    return jsonify(restaurants)
    
    
    
    

