from flask import Blueprint, request, jsonify
from database import db, MenuItem
from sqlalchemy import desc, and_
from pdf_cache import parse_menu_pdf, cache_restaurant
import re
import os
import requests
from bs4 import BeautifulSoup

routes = Blueprint('routes', __name__)

@routes.route('/api/menu')
def get_menu():
    restaurant = request.args.get('restaurant', '').lower()

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

    items = items_query.order_by(desc(MenuItem.calories)).all()

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
   
PDF_DIR = "pdf_menus"
   
# does not work, no button to click from html :(
    # solution 1: create a web scraper for the url and make that a pdf then make a new pdf parser (might be best)
    # solution 2: have user go to the url and download themselves and give me the pdf (bad)
@routes.route("/api/add_restaurant")
def add_restaurant():
    raw_name = request.args.get("name", "")
    if not raw_name:
        return jsonify({"error": "missing restaurant name"}), 400
    
    cleaned_name = clean_name(raw_name)
    pdf_url = f"https://www.nutritionix.com/{cleaned_name}/menu/premium?sort=calories"
    pdf_path = os.path.join(PDF_DIR, f"{cleaned_name}.pdf")

    try:
        page = requests.get(page_url)
        page.raise_for_status()

        # have to go through html of the website to find the download button
        soup = BeautifulSoup(page.text, "html.parser")
        pdf_link_tag = soup.find("a", string="Download Menu (PDF)")
        if not pdf_link_tag or not pdf_link_tag.get("href"):
            return jsonify({"error": "could not find PDF link on page"}), 404

        pdf_url = pdf_link_tag["href"]
        if not pdf_url.startswith("http"):
            pdf_url = "https://www.nutritionix.com" + pdf_url

        # download pdf!
        pdf_response = requests.get(pdf_url)
        pdf_response.raise_for_status()
        with open(pdf_path, "wb") as f:
            f.write(pdf_response.content)

    except Exception as e:
        return jsonify({"error": f"failed to download PDF: {str(e)}"}), 500

    # now parse the pdf 
    try:
        items = parse_menu_pdf(pdf_path)
        cache_restaurant(cleaned_name, items)
    except Exception as e:
        return jsonify({"error": f"failed to parse/cache menu: {str(e)}"}), 500

    return jsonify({"message": "restaurant added and menu cached", "restaurant": cleaned_name})   
    
# clean name to use in url    
def clean_name(name):
    name = name.lower()
    name = re.sub(r'[^\w\s-]', '', name)  # remove punctuation except dash/space
    name = re.sub(r'\s+', '-', name.strip())  # spaces -> dash
    return name    
    
    

