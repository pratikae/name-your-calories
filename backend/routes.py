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
  
@routes.route('/api/make_combo')
def make_combo():
    restaurant = request.args.get('restaurant', '').lower()
    shuffle_num = int(request.args.get('num'))

    filters = [MenuItem.restaurant == restaurant]

    # add all of the macro filters to filters arr (only max to build a combo)
    if request.args.get("calorieMax"):
        filters.append(MenuItem.calories <= int(request.args.get("calorieMax")))

    if request.args.get("proteinMax"):
        filters.append(MenuItem.protein <= int(request.args.get("proteinMax")))

    if request.args.get("fatMax"):
        filters.append(MenuItem.fat <= int(request.args.get("fatMax")))

    if request.args.get("carbMax"):
        filters.append(MenuItem.carbs <= int(request.args.get("carbMax")))

    # add category filters to filters arr
    categories = request.args.getlist("categories")
    if categories:
        filters.append(MenuItem.category.in_(categories))

    # query by what is in the filters arr
    items_query = MenuItem.query.filter(and_(*filters))
    items = items_query.all()
        
    if shuffle_num:
        if shuffle_num < len(items):
            items = random.sample(items, shuffle_num)
            
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
    
from itertools import combinations
from flask import request, jsonify

# checks if combo macros are within the target macros 
def check_macros(combo, macros):
    total = {
        "calories": sum(item.calories for item in combo),
        "protein": sum(item.protein for item in combo),
        "fat": sum(item.fat for item in combo),
        "carbs": sum(item.carbs for item in combo),
    }

    if safe_float(macros["calorieMin"]) is not None and total["calories"] < safe_float(macros["calorieMin"]):
        return False
    if safe_float(macros["calorieMax"]) is not None and total["calories"] > safe_float(macros["calorieMax"]):
        return False

    if safe_float(macros["proteinMin"]) is not None and total["protein"] < safe_float(macros["proteinMin"]):
        return False
    if safe_float(macros["proteinMax"]) is not None and total["protein"] > safe_float(macros["proteinMax"]):
        return False

    if safe_float(macros["fatMin"]) is not None and total["fat"] < safe_float(macros["fatMin"]):
        return False
    if safe_float(macros["fatMax"]) is not None and total["fat"] > safe_float(macros.get("fatMax")):
        return False

    if safe_float(macros["carbMin"]) is not None and total["carbs"] < safe_float(macros["carbMin"]):
        return False
    if safe_float(macros["carbMax"]) is not None and total["carbs"] > safe_float(macros["carbMax"]):
        return False

    return True

def in_range(total, min_key, max_key, macros):
    min_val = safe_float(macros.get(min_key))
    max_val = safe_float(macros.get(max_key))

    if min_val is not None and total < min_val:
        return False
    if max_val is not None and total > max_val:
        return False
    return True

def safe_float(val):
    try:
        return float(val)
    except (TypeError, ValueError):
        return None

def violates_max(item, key, max_key, macros):
    max_val = safe_float(macros.get(max_key))
    return max_val is not None and getattr(item, key) > max_val

# returns whether an item is valid for a combo
def is_valid_item(item, macros):
    return not (
        violates_max(item, "calories", "calorieMax", macros) or
        violates_max(item, "protein", "proteinMax", macros) or
        violates_max(item, "fat", "fatMax", macros) or
        violates_max(item, "carbs", "carbMax", macros)
    )

def format_combo(combo):
    return {
        "items": [item.name for item in combo],
        "count": len(combo),
        "total": {
            "calories": sum(item.calories for item in combo),
            "protein": sum(item.protein for item in combo),
            "fat": sum(item.fat for item in combo),
            "carbs": sum(item.carbs for item in combo),
        }
    }
    
@routes.route('/api/get_combos', methods=['POST'])
def get_combos():
    data = request.get_json()
    categories = data.get("categories", [])
    restaurant = data.get("restaurant")
    macros = data.get("macros")
    num = data.get("num")

    query = MenuItem.query
    if restaurant:
        query = query.filter_by(restaurant=restaurant)
    if categories:
        query = query.filter(MenuItem.category.in_(categories))
    
    all_items = query.all()

    # filter out items that exceed individual max constraints (can't be part of a combo)
    filtered_items = [item for item in all_items if is_valid_item(item, macros)]

    valid_combos = []
    for r in range(2, len(filtered_items) + 1): 
        if r > 5: # for now, no need for combos with more than 5 items (or else it will take forever to get all combos)
            break
        for combo in combinations(filtered_items, r): # this will automatically have it in order of least to most items per combo
            if check_macros(combo, macros):
                valid_combos.append(list(combo))

    print(f"valid combos: {len(valid_combos)}")
    if num:
        valid_combos = random.sample(valid_combos, min(num, len(valid_combos)))
    else:
        valid_combos = random.sample(valid_combos, min(10, len(valid_combos)))

    return jsonify([format_combo(combo) for combo in valid_combos])

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
    
    

