import pdfplumber
import os
import re
import requests
from bs4 import BeautifulSoup
from database import db, MenuItem

PDF_DIR = "pdf_menus"

# initial files
restaurant_files = {
    "taco bell": "taco-bell.pdf",
    "chick-fil-a": "chick-fil-a.pdf",
    "mcdonalds": "mcdonalds.pdf",
    "nandos peri peri": "nandos-peri-peri.pdf",
    "shake shack": "shake-shack.pdf",
}

disallowed_categories = ["at participating locations", "catering", "trays"]

# get restaurant's full menu from nutritionix.com/{slug}/menu/premium
# returns (restaurant_name, items_list)
def scrape_nutritionix_menu(slug):
    url = f"https://www.nutritionix.com/{slug}/menu/premium"
    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    r = requests.get(url, headers=headers, timeout=15)
    if r.status_code != 200:
        raise ValueError(f"Nutritionix returned {r.status_code} for '{slug}'")

    soup = BeautifulSoup(r.text, "html.parser")

    # get the restaurant name from the page
    title = soup.title.string if soup.title else ""
    title_match = re.match(r"^(.+?)\s+-\s+(Full|Interactive) Nutrition", title)
    restaurant_name = title_match.group(1).strip() if title_match else slug.replace("-", " ").title()

    # get the column ids for nutrition info
    col_ids = {}
    for th in soup.find_all("th", id=re.compile(r"^inmGrid_c\d+$")):
        text = th.get_text(strip=True).lower()
        col_id = th["id"].split("_")[1]  # e.g. "c1"
        if "calorie" in text:
            col_ids["calories"] = col_id
        elif "total fat" in text:
            col_ids["fat"] = col_id
        elif "total carbohydrate" in text:
            col_ids["carbs"] = col_id
        elif "protein" in text:
            col_ids["protein"] = col_id

    if not col_ids:
        raise ValueError(f"could not detect nutrition columns for '{slug}'")

    items = []
    current_category = "Other"

    # go through all <tr> elements in order
    for row in soup.find_all("tr"):
        if "subCategory" in (row.get("class") or []):
            h3 = row.find("h3")
            if h3:
                current_category = h3.get_text(strip=True)
            continue

        name_td = row.find("td", class_="al")
        if not name_td:
            continue

        name_link = name_td.find("a", class_="nmItem")
        if not name_link:
            continue
        name = name_link.get("title") or name_link.get_text(strip=True)

        def get_col(col_id):
            td = row.find("td", headers=f"inmGrid_{col_id}")
            return td.get_text(strip=True) if td else None

        try:
            calories = int(get_col(col_ids["calories"]).replace(",", ""))
            fat      = float(get_col(col_ids["fat"]).replace(",", ""))
            carbs    = float(get_col(col_ids["carbs"]).replace(",", ""))
            protein  = float(get_col(col_ids["protein"]).replace(",", ""))
        except (TypeError, ValueError, AttributeError):
            continue

        items.append({
            "name": name,
            "restaurant": restaurant_name,
            "category": current_category,
            "calories": calories,
            "fat": fat,
            "carbs": carbs,
            "protein": protein,
        })

    if not items:
        raise ValueError(f"No menu items found for '{slug}' — restaurant may not exist on Nutritionix")

    return restaurant_name, items

def get_restaurant_name(filepath):
    with pdfplumber.open(filepath) as pdf:
        first_page_text = pdf.pages[0].extract_text()
        if not first_page_text:
            return "unknown"

        # make one page
        first_page_text = " ".join(first_page_text.splitlines())
        first_page_text = re.sub(r'\s+', ' ', first_page_text)

        # get the name using regex
        match = re.search(
            r'\d{1,2}/\d{1,2}/\d{2,4},\s*\d{1,2}:\d{2}\s*[AP]M\s+(.*?)\s+-\s+(Full|Interactive) Nutrition (Information|Menu)',
            first_page_text
        )

        if match:
            return match.group(1).strip()
        else:
            return "unknown"
        
def get_indices(table):
    transposed = list(map(list, zip(*table)))
    col_map = {}

    for col_index, col in enumerate(transposed):
        word = "".join(cell.strip() if cell else "" for cell in col).lower()
        word = re.sub(r"\s+", "", word)
        
        if "seirolac" in word:
            col_map["calories"] = col_index
        elif "taflatot" in word:
            col_map["fat"] = col_index
        elif "setardyhobraclatot" in word:
            col_map["carbs"] = col_index
        elif "nietorp" in word:
            col_map["protein"] = col_index

    return col_map

def parse_menu_pdf(filepath):
    menu_items = []
    restaurant_name = get_restaurant_name(filepath)
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            if not tables or not tables[0]:  # skip if tables is empty or first table is empty
                continue
            
            # get indexes for calories, protein, carbs, and fat
            col_map = get_indices(tables[0])
                    
            for table in tables:
                for row in table[1:]:
                    if not row or len(row) < 5:
                        continue
                    
                    category_candidate = row[0].strip() if row[0] else ""

                    # check if the row is a category header
                    if not any(row[i] for i in col_map.values()) and category_candidate:
                        last_category = category_candidate
                        if "Veggie Cravings" in last_category: # taco bell is annoying
                            last_category = "Veggie Cravings"
                        continue  # skip the category header row itself

                    # make sure row has nutrition info
                    if not all(row[i] for i in col_map.values()):
                        print("skipping bad row")
                        continue
                    
                    # don't need disallowed categories
                    if any(disallowed in last_category.lower() for disallowed in disallowed_categories):
                        continue

                    name = row[0].strip()
                    try:
                        calories = int(row[col_map["calories"]])
                        fat = float(row[col_map["fat"]])
                        carbs = float(row[col_map["carbs"]])
                        protein = float(row[col_map["protein"]])
                    except (ValueError, IndexError): # skip bad stuff that didnt get caught somehow
                        continue 

                    restaurant_name = restaurant_name[0].upper() + restaurant_name[1:]
                    menu_items.append({
                        "name": name,
                        "restaurant": restaurant_name,
                        "category": last_category if 'last_category' in locals() else "unknown",
                        "calories": calories,
                        "fat": fat,
                        "carbs": carbs,
                        "protein": protein
                    })

    return menu_items

def cache_restaurant(restaurant_name, items):
    print(f"caching {restaurant_name}")
    for item in items:
        db.session.add(MenuItem(
            restaurant=restaurant_name,
            name=item["name"],
            calories=item["calories"],
            fat=item["fat"],
            carbs=item["carbs"],
            protein=item["protein"],
            category=item["category"]
        ))
    db.session.commit()
    print("cached new restaurant")

def cache_first_restaurants(app):
    with app.app_context():
        for restaurant, filename in restaurant_files.items():
            print(f"parsing {restaurant}")
            full_path = f"{PDF_DIR}/{filename}"
            items = parse_menu_pdf(full_path)
            restaurant_name = items[0]["restaurant"] if items else restaurant
            cache_restaurant(restaurant_name, items)
        db.session.commit()
        print("cached all restaurants")

if __name__ == "__main__":
    from flask import Flask
    from dotenv import load_dotenv
    load_dotenv()
    _app = Flask(__name__)
    _app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///menu_items.db'
    _app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(_app)
    cache_first_restaurants(_app)
