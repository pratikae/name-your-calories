from flask import Blueprint, request, jsonify
from database import db, MenuItem
from sqlalchemy import desc, and_
import re
import os
import requests
import random
import time

routes = Blueprint('routes', __name__)

@routes.route('/api/items')
def get_items():
    restaurant = request.args.get('restaurant', '').lower()
    num_items = request.args.get('num')
    num_items = int(num_items)

    filters = [MenuItem.restaurant == restaurant]

    # add all of the macro filters to filters arr
    if request.args.get("calorieMax"):
        filters.append(MenuItem.calories <= int(request.args.get("calorieMax")))
    if request.args.get("calorieMin"):
        filters.append(MenuItem.calories >= int(request.args.get("calorieMin")))

    if request.args.get("proteinMax"):
        filters.append(MenuItem.protein <= int(request.args.get("proteinMax")))
    if request.args.get("proteinMin"):
        filters.append(MenuItem.protein >= int(request.args.get("proteinMin")))

    if request.args.get("fatMax"):
        filters.append(MenuItem.fat <= int(request.args.get("fatMax")))
    if request.args.get("fatMin"):
        filters.append(MenuItem.fat >= int(request.args.get("fatMin")))

    if request.args.get("carbMax"):
        filters.append(MenuItem.carbs <= int(request.args.get("carbMax")))
    if request.args.get("carbMin"):
        filters.append(MenuItem.carbs >= int(request.args.get("carbMin")))

    # add category filters to filters arr
    categories = request.args.getlist("categories")
    if categories:
        filters.append(MenuItem.category.in_(categories))

    # query by what is in the filters arr
    items_query = MenuItem.query.filter(and_(*filters))
    items = items_query.all()
        
    if num_items:
        if num_items < len(items):
            items = random.sample(items, num_items)
            
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
    
@routes.route('/api/categories')
def get_categories():
    restaurant = request.args.get("restaurant")
    if not restaurant:
        return jsonify([])

    categories = (
        db.session.query(MenuItem.category)
        .filter_by(restaurant=restaurant)
        .distinct()
        .all()
    )
    return jsonify(sorted({cat for (cat,) in categories if cat}))

# clean name to use in url    
def clean_name(name):
    name = name.lower()
    name = re.sub(r'[^\w\s-]', '', name)  # remove punctuation except dash/space
    name = re.sub(r'\s+', '-', name.strip())  # spaces -> dash
    return name    
    
    

