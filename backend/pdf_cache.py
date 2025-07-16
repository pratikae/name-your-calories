import pdfplumber
import os
from database import db, MenuItem
from app import app

PDF_DIR = "pdf_menus"

restaurant_files = {
    "taco bell": "taco-bell.pdf",
    "chick-fil-a": "chick-fil-a.pdf",
    "mcdonalds": "mcdonalds.pdf",
    "nandos peri peri": "nandos-peri-peri.pdf",
    "shake shack": "shake-shack.pdf",
}

import re
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
                        continue  # skip the category header row itself

                    # make sure row has nutrition info
                    if not all(row[i] for i in col_map.values()):
                        print("skipping bad row")
                        continue

                    name = row[0].strip()
                    try:
                        calories = int(row[col_map["calories"]])
                        fat = float(row[col_map["fat"]])
                        carbs = float(row[col_map["carbs"]])
                        protein = float(row[col_map["protein"]])
                    except (ValueError, IndexError): # skip bad stuff
                        continue 

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

def cache_restaurants():
    with app.app_context():
        for restaurant, filename in restaurant_files.items():
            print(f"caching {restaurant}")
            full_path = f"{PDF_DIR}/{filename}"
            items = parse_menu_pdf(full_path)
            for item in items:
                db.session.add(MenuItem(
                    restaurant=restaurant,
                    name=item["name"],
                    calories=item["calories"],
                    fat=item["fat"],
                    carbs=item["carbs"],
                    protein=item["protein"],
                    category=item["category"]
                ))
        db.session.commit()
        print("cached all restaurants")

if __name__ == "__main__":
    cache_restaurants()
    
    # just for checking the names
    # for key, filename in restaurant_files.items():
    #     path = os.path.join(PDF_DIR, filename)
    #     name = get_restaurant_name(path)
    #     print(name)
    
