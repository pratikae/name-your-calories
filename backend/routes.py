from flask import Blueprint, request, jsonify
from database import db, MenuItem
from sqlalchemy import desc, and_
from pdf_cache import scrape_nutritionix_menu, cache_restaurant
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

    macros = {
        "calorieMin": request.args.get("calorieMin"),
        "calorieMax": request.args.get("calorieMax"),
        "proteinMin": request.args.get("proteinMin"),
        "proteinMax": request.args.get("proteinMax"),
        "fatMin":     request.args.get("fatMin"),
        "fatMax":     request.args.get("fatMax"),
        "carbMin":    request.args.get("carbMin"),
        "carbMax":    request.args.get("carbMax"),
    }

    # query by what is in the filters arr
    items_query = MenuItem.query.filter(and_(*filters))
    items = items_query.all()

    closest = False
    if not items:
        # fall back to all items for this restaurant/categories, scored by distance
        closest = True
        base_filters = [MenuItem.restaurant == restaurant]
        if categories:
            base_filters.append(MenuItem.category.in_(categories))
        items = MenuItem.query.filter(and_(*base_filters)).all()
        items.sort(key=lambda item: item_distance(item, macros))

    if num_items:
        if num_items < len(items):
            items = random.sample(items, num_items) if not closest else items[:num_items]

    return jsonify({
        "items": [
            {
                "name": item.name,
                "calories": item.calories,
                "protein": item.protein,
                "carbs": item.carbs,
                "fat": item.fat,
                "category": item.category
            } for item in items
        ],
        "closest": closest,
    })
  
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

#  how much each macro is outside its target range
def macro_distance(totals, macros):
    d = 0
    checks = [
        (totals.get("calories"), "calorieMin", "calorieMax"),
        (totals.get("protein"),  "proteinMin", "proteinMax"),
        (totals.get("fat"),      "fatMin",     "fatMax"),
        (totals.get("carbs"),    "carbMin",    "carbMax"),
    ]
    for val, min_key, max_key in checks:
        if val is None:
            continue
        min_val = safe_float(macros.get(min_key))
        max_val = safe_float(macros.get(max_key))
        if min_val is not None and val < min_val:
            d += min_val - val
        elif max_val is not None and val > max_val:
            d += val - max_val
    return d

def item_distance(item, macros):
    return macro_distance({
        "calories": item.calories or 0,
        "protein":  item.protein  or 0,
        "fat":      item.fat      or 0,
        "carbs":    item.carbs    or 0,
    }, macros)

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

# dfs with early pruning 
def find_combos_dp(items, macros, max_items, category_limits=None, collect_limit=500):
    cal_max  = safe_float(macros.get("calorieMax"))
    prot_max = safe_float(macros.get("proteinMax"))
    fat_max  = safe_float(macros.get("fatMax"))
    carb_max = safe_float(macros.get("carbMax"))
    cal_min  = safe_float(macros.get("calorieMin"))
    prot_min = safe_float(macros.get("proteinMin"))
    fat_min  = safe_float(macros.get("fatMin"))
    carb_min = safe_float(macros.get("carbMin"))
    cat_lim  = category_limits or {}

    valid_combos = []
    n = len(items)

    def meets_min(cal, prot, fat, carb):
        if cal_min  is not None and cal  < cal_min:  return False
        if prot_min is not None and prot < prot_min: return False
        if fat_min  is not None and fat  < fat_min:  return False
        if carb_min is not None and carb < carb_min: return False
        return True

    def meets_category_min(cat_counts):
        for cat, limits in cat_lim.items():
            min_cat = limits.get("min")
            if min_cat is not None and cat_counts.get(cat, 0) < min_cat:
                return False
        return True

    # cat_counts is mutated in-place and undone after each recursive call
    def dfs(start, count, cal, prot, fat, carb, combo, cat_counts):
        if len(valid_combos) >= collect_limit:
            return

        if count >= 2 and meets_min(cal, prot, fat, carb) and meets_category_min(cat_counts):
            valid_combos.append(list(combo))
            if len(valid_combos) >= collect_limit:
                return

        if count >= max_items:
            return

        for i in range(start, n):
            if len(valid_combos) >= collect_limit:
                return

            item = items[i]
            cat = item.category or ""

            # prune if this category already hit its max
            if cat_lim.get(cat, {}).get("max") is not None:
                if cat_counts.get(cat, 0) >= cat_lim[cat]["max"]:
                    continue

            new_cal  = cal  + (item.calories or 0)
            new_prot = prot + (item.protein  or 0)
            new_fat  = fat  + (item.fat      or 0)
            new_carb = carb + (item.carbs    or 0)

            if cal_max  is not None and new_cal  > cal_max:  break
            if prot_max is not None and new_prot > prot_max: continue
            if fat_max  is not None and new_fat  > fat_max:  continue
            if carb_max is not None and new_carb > carb_max: continue

            cat_counts[cat] = cat_counts.get(cat, 0) + 1
            combo.append(item)
            dfs(i + 1, count + 1, new_cal, new_prot, new_fat, new_carb, combo, cat_counts)
            combo.pop()
            cat_counts[cat] -= 1
            if cat_counts[cat] == 0:
                del cat_counts[cat]

    dfs(0, 0, 0, 0, 0, 0, [], {})
    return valid_combos

# there there are no exact combos exist, get all combos ignoring max constraints and return the closest ones
def find_closest_combos(items, macros, max_items, category_limits=None, collect_limit=300):

    # relax max constraints so the DFS doesn't prune on them
    relaxed = dict(macros)
    for key in ("calorieMax", "proteinMax", "fatMax", "carbMax"):
        relaxed[key] = None

    combos = find_combos_dp(items, relaxed, max_items, category_limits, collect_limit)

    if not combos:
        # also relax min constraints as a last resort
        empty = {k: None for k in macros}
        combos = find_combos_dp(items, empty, max_items, category_limits, collect_limit)

    def combo_dist(combo):
        return macro_distance({
            "calories": sum(i.calories or 0 for i in combo),
            "protein":  sum(i.protein  or 0 for i in combo),
            "fat":      sum(i.fat      or 0 for i in combo),
            "carbs":    sum(i.carbs    or 0 for i in combo),
        }, macros)

    combos.sort(key=combo_dist)
    return combos

@routes.route('/api/get_combos', methods=['POST'])
def get_combos():
    data = request.get_json()
    categories = data.get("categories", [])
    restaurant = data.get("restaurant")
    macros = data.get("macros")
    num = data.get("num", 10)
    max_items = data.get("maxItems", 5)
    # e.g. {"entree": {"min": 1, "max": 1}, "side": {"max": 2}}
    category_limits = data.get("categoryLimits", {})

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

    valid_combos = find_combos_dp(filtered_items, macros, max_items=max_items, category_limits=category_limits)

    closest = False
    if not valid_combos:
        closest = True
        # use all items (not just individually valid ones) for the relaxed search
        all_shuffled = list(all_items)
        random.shuffle(all_shuffled)
        all_shuffled.sort(key=lambda x: (x.calories or 0))
        valid_combos = find_closest_combos(all_shuffled, macros, max_items, category_limits)

    print(f"combos found: {len(valid_combos)}, closest={closest}")

    if closest:
        result = valid_combos[:num]
    else:
        result = random.sample(valid_combos, min(num, len(valid_combos)))

    return jsonify({
        "combos": [format_combo(combo) for combo in result],
        "closest": closest,
    })

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


@routes.route('/api/add_restaurant', methods=['POST'])
def add_restaurant():
    data = request.get_json()
    slug = data.get("slug", "").strip()
    if not slug:
        return jsonify({"error": "slug is required"}), 400

    slug = clean_name(slug)

    # check if already cached (match by slug-derived name heuristic)
    existing = db.session.query(MenuItem.restaurant).filter(
        MenuItem.restaurant.ilike(slug.replace("-", " "))
    ).first()
    if existing:
        return jsonify({"error": f"'{existing[0]}' is already cached"}), 409

    try:
        restaurant_name, items = scrape_nutritionix_menu(slug)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": f"Failed to scrape menu: {str(e)}"}), 500

    # double-check by canonical name in case slug->name differs from DB
    existing_by_name = db.session.query(MenuItem.restaurant).filter(
        MenuItem.restaurant.ilike(restaurant_name)
    ).first()
    if existing_by_name:
        return jsonify({"error": f"'{existing_by_name[0]}' is already cached"}), 409

    cache_restaurant(restaurant_name, items)
    return jsonify({"restaurant": restaurant_name, "items_cached": len(items)})



