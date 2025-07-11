from database import db, MenuItem
from app import app
import requests, os, sys
from dotenv import load_dotenv

load_dotenv()

API_ID = os.getenv("NUTRITIONIX_APP_ID")
API_KEY = os.getenv("NUTRITIONIX_API_KEY")

headers = {'x-app-id': API_ID, 'x-app-key': API_KEY}

def cache(restaurant):
    print(f"Fetching items for {restaurant}")
    search_url = "https://trackapi.nutritionix.com/v2/search/instant"
    response = requests.get(search_url, headers=headers, params={"query": restaurant})
    items = response.json().get("branded", [])

    for item in items:
        item_id = item.get("nix_item_id")
        if not item_id: # if no id, don't cache
            continue

        detail_resp = requests.get(
            "https://trackapi.nutritionix.com/v2/search/item",
            headers=headers,
            params={"nix_item_id": item_id}
        )
        if not detail_resp.ok:
            continue

        food = detail_resp.json().get("foods", [])[0]
        if not food:
            continue

        if food.get("nf_calories") is None: # if no calories provided, don't cache
            continue

        menu_item = MenuItem(
            restaurant=restaurant.lower(),
            name=food["food_name"],
            calories=int(food["nf_calories"]),
            brand=food.get("brand_name"),
            category=food.get("tags", {}).get("food_group", "unknown")
        )
        db.session.add(menu_item)

    db.session.commit()
    print(f"finished caching for {restaurant}")

if __name__ == "__main__": # can only run if directly called
    if len(sys.argv) < 2: # checks if a restaurant is provided
        print("usage: python seed_single.py <restaurant>")
        sys.exit(1)

    restaurant = sys.argv[1]
    with app.app_context():
        cache(restaurant)
