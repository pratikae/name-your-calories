  import React, { useState, useEffect } from "react";
  import axios from "axios";

  const App = () => {
  const [restaurant, setRestaurant] = useState("");
  const [restaurants, setRestaurants] = useState([])
  const [minCalories, setMinCalories] = useState<number | "">("")
  const [maxCalories, setMaxCalories] = useState<number | "">("")
  const [hasFetched, setHasFetched] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [items, setItems] = useState([])

  const paramsSerializer = (params: any) => {
    const searchParams = new URLSearchParams();
    for (const key in params) {
      const value = params[key];
      if (Array.isArray(value)) {
        value.forEach((val) => searchParams.append(key, val));
      } else if (value !== undefined && value !== "") {
        searchParams.append(key, value);
      }
    }
    return searchParams.toString();
  };

  const fetchItems = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:5050/api/menu", {
          params: {
          restaurant,
          calorieMax: maxCalories,
          calorieMin: minCalories,
          categories: Array.from(selectedCategories),
        },
        paramsSerializer,
      });
      setItems(res.data)
      setHasFetched(true);
    } catch (err) {
      console.error("error fetching menu:", err)
      setItems([])
      setHasFetched(true);
    }
  };

  const fetchRestaurants = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:5050/api/get_restaurants")
      setRestaurants(res.data)
    } catch (err) {
      console.error("error fetching menu:", err)
      setRestaurants([])
    }
  }

  const fetchCategories = async () => {
    if (!restaurant) return;

    try {
      const res = await axios.get("http://127.0.0.1:5050/api/categories", {
        params: { restaurant }
      });
      setCategories(res.data);
      setSelectedCategories(new Set(res.data)); // default to all selected
    } catch (err) {
      console.error("error fetching categories:", err);
      setCategories([]);
      setSelectedCategories(new Set());
    }
  };

  // fetch when restaurant is selected
  useEffect(() => {
    fetchCategories();
  }, [restaurant])

  useEffect(() => {
    fetchRestaurants();
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: "75px" }}>
        <h2>welcome to Name Your Calories!</h2>
        <br /> <br />
        {/* choosing restaurants */}
        <div>
          <label>
            choose a restaurant: 
          </label>
          <select value={restaurant} onChange={(e) => setRestaurant(e.target.value)} >
            <option value="">select an option</option>
            {restaurants.map((rest) => (
              <option key={rest} value={rest}>
                {rest}
              </option>
            ))}
          </select>
        </div>

        {/* toggle different categories */}
        {categories.length > 0 && (
          <div>
            <h4>include categories:</h4>
            {categories.map((cat) => (
              <label>
                <input
                  type="checkbox"
                  checked={selectedCategories.has(cat)}
                  onChange={() => {
                    setSelectedCategories((prev) => {
                      const newSet = new Set(prev);
                      if (newSet.has(cat)) newSet.delete(cat);
                      else newSet.add(cat);
                      return newSet;
                    });
                  }}
                />
                {cat}
              </label>
            ))}
          </div>
        )}

        <br />
        {/* calorie range*/}
        <div>
          <input
            type="number"
            value={minCalories}
            onChange={(e) => setMinCalories(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="min calories"
          />
          <span> to </span>
          <input
            type="number"
            value={maxCalories}
            onChange={(e) => setMaxCalories(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="max calories"
          />
          <span className="ml-2 font-semibold text-gray-700 whitespace-nowrap"> calories</span>
        </div>

        <br /> <br />
        <button onClick={fetchItems}>
          get items
        </button>

        <div>
          {hasFetched && items.length === 0 ? (
            <p>no items found</p>
          ) : (
            items.map((item: any, index) => (
              <div key={index}>
                <h3>{item.name}</h3>
                <p>calories: {item.calories}</p>
                <p>protein: {item.protein}</p>
                <p>carbs: {item.carbs}</p>
                <p>fat: {item.fat}</p>
              </div>
            ))
          )}

        </div>
    </div>
  );
  };

  export default App;
