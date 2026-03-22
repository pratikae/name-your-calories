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
    
from flask import request, jsonify

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

# json formating for combos
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

#  dfs with early pruning 
def find_combos_dp(items, macros, max_items, collect_limit=500):
    cal_max  = safe_float(macros.get("calorieMax"))
    prot_max = safe_float(macros.get("proteinMax"))
    fat_max  = safe_float(macros.get("fatMax"))
    carb_max = safe_float(macros.get("carbMax"))
    cal_min  = safe_float(macros.get("calorieMin"))
    prot_min = safe_float(macros.get("proteinMin"))
    fat_min  = safe_float(macros.get("fatMin"))
    carb_min = safe_float(macros.get("carbMin"))

    valid_combos = []
    n = len(items)

    def meets_min(cal, prot, fat, carb):
        if cal_min  is not None and cal  < cal_min:  return False
        if prot_min is not None and prot < prot_min: return False
        if fat_min  is not None and fat  < fat_min:  return False
        if carb_min is not None and carb < carb_min: return False
        return True

    def dfs(start, count, cal, prot, fat, carb, combo):
        if len(valid_combos) >= collect_limit:
            return

        # a combo needs at least 2 items
        if count >= 2 and meets_min(cal, prot, fat, carb):
            valid_combos.append(list(combo))
            if len(valid_combos) >= collect_limit:
                return

        if count >= max_items:
            return

        for i in range(start, n):
            if len(valid_combos) >= collect_limit:
                return

            item = items[i]
            new_cal  = cal  + (item.calories or 0)
            new_prot = prot + (item.protein  or 0)
            new_fat  = fat  + (item.fat      or 0)
            new_carb = carb + (item.carbs    or 0)

            # prune any branches that have > calories
            if cal_max  is not None and new_cal  > cal_max:  break
            if prot_max is not None and new_prot > prot_max: continue
            if fat_max  is not None and new_fat  > fat_max:  continue
            if carb_max is not None and new_carb > carb_max: continue

            combo.append(item)
            dfs(i + 1, count + 1, new_cal, new_prot, new_fat, new_carb, combo)
            combo.pop()

    dfs(0, 0, 0, 0, 0, 0, [])
    return valid_combos

@routes.route('/api/get_combos', methods=['POST'])
def get_combos():
    data = request.get_json()
    categories = data.get("categories", [])
    restaurant = data.get("restaurant")
    macros = data.get("macros")
    num = data.get("num", 10)
    max_items = data.get("maxItems", 5)

    query = MenuItem.query
    if restaurant:
        query = query.filter_by(restaurant=restaurant)
    if categories:
        query = query.filter(MenuItem.category.in_(categories))

    all_items = query.all()

    # filter out items that individually exceed any max constraint
    filtered_items = [item for item in all_items if is_valid_item(item, macros)]

    # shuffle first so collect_limit samples are diverse, then sort by calories
    # for the break-pruning optimisation in find_combos_dp
    random.shuffle(filtered_items)
    filtered_items.sort(key=lambda x: (x.calories or 0))

    valid_combos = find_combos_dp(filtered_items, macros, max_items=max_items)

    print(f"valid combos found: {len(valid_combos)}")
    result = random.sample(valid_combos, min(num, len(valid_combos)))

    return jsonify([format_combo(combo) for combo in result])

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
    
    

