import React, { useState, useEffect } from "react";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const App = () => {
  const filters = ["calories", "protein", "carbs", "fat"];

  const [restaurant, setRestaurant] = useState("");
  const [restaurants, setRestaurants] = useState([])
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set())
  const [minCalories, setMinCalories] = useState<number | "">("")
  const [maxCalories, setMaxCalories] = useState<number | "">("")
  const [minProtein, setMinProtein] = useState<number | "">("")
  const [maxProtein, setMaxProtein] = useState<number | "">("")
  const [minFat, setMinFat] = useState<number | "">("")
  const [maxFat, setMaxFat] = useState<number | "">("")
  const [minCarbs, setMinCarbs] = useState<number | "">("")
  const [maxCarbs, setMaxCarbs] = useState<number | "">("")

  const [hasFetched, setHasFetched] = useState(false);
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [items, setItems] = useState([])
  const [customRestaurant, setCustomRestaurant] = useState("")

  // need this to make flask understand the list of categories
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
      let restaurantToUse = restaurant;

      if (restaurant === "new") {
        if (!customRestaurant.trim()) {
          console.error("custom restaurant name is empty");
          return;
        }

        // download & cache the new restaurant menu
        try {
          await axios.get("http://127.0.0.1:5050/api/add_restaurant", {
            params: { name: customRestaurant },
          });
          console.log("successfully added and cached new restaurant.");
        } catch (err) {
          console.error("failed to add new restaurant:", err);
          return;
        }
      }

      const res = await axios.get("http://127.0.0.1:5050/api/menu", {
          params: {
          restaurant,
          calorieMax: maxCalories,
          calorieMin: minCalories,
          proteinMin: minProtein,
          proteinMax: maxProtein,
          fatMin: minFat,
          fatMax: maxFat,
          carbMin: minCarbs,
          carbMax: maxCarbs,
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

  const COLORS = ["#fa75d2", "#5cb6fa", "#faec52"]; // colors for protein, carbs, fat

  const MacroPieChart = ({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) => {
    const data = [
      { name: "protein", value: protein },
      { name: "carbs", value: carbs },
      { name: "fat", value: fat },
    ];

    return (
      <PieChart width={200} height={200}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={65}
          fill="#8884d8"
          label
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    );
  };

  return (
    <div style={{ textAlign: "center", marginTop: "75px" }}>
        <h2>welcome to Name Your Calories!</h2>
        <br /> <br />
        {/* choosing restaurants */}
        <div>
          <label htmlFor="restaurant" style={{ marginRight: "8px" }}>choose a restaurant: </label>
          <select
            value={restaurant}
            onChange={(e) => setRestaurant(e.target.value)}
          >
            <option value="">select an option</option>
            {restaurants.map((rest) => (
              <option key={rest} value={rest}>
                {rest}
              </option>
            ))}
            <option value="new">enter new restaurant</option>
          </select>

          {/* show textbox if 'new' is selected */}
          {restaurant === "new" && (
            <div style={{ marginTop: "10px" }}>
              <label htmlFor="customRestaurant">enter restaurant name: </label>
              <input
                id="customRestaurant"
                type="text"
                value={customRestaurant}
                onChange={(e) => setCustomRestaurant(e.target.value)}
              />
            </div>
          )}
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

        
        {/* toggle macro filters */}
        <div>
          <h4>include macro filters: </h4>
          {filters.map((filter) => (
              <label>
                <input
                  type="checkbox"
                  checked={selectedFilters.has(filter)}
                  onChange={() => {
                    setSelectedFilters((prev) => {
                      const newSet = new Set(prev);
                      if (newSet.has(filter)) newSet.delete(filter);
                      else newSet.add(filter);
                      return newSet;
                    });
                  }}
                />
                {filter}
              </label>
            ))}
        </div>

        {/* filters range */}
        {selectedFilters.has("calories") && (
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
          )
        }

        {selectedFilters.has("protein") && (
          <div>
            <input
              type="number"
              value={minProtein}
              onChange={(e) => setMinProtein(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="min protein"
            />
            <span> to </span>
            <input
              type="number"
              value={maxProtein}
              onChange={(e) => setMaxProtein(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="max protein"
            />
            <span className="ml-2 font-semibold text-gray-700 whitespace-nowrap"> protein </span>
          </div>
          )
        }

        {selectedFilters.has("carbs") && (
          <div>
            <input
              type="number"
              value={minCarbs}
              onChange={(e) => setMinCarbs(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="min carbs"
            />
            <span> to </span>
            <input
              type="number"
              value={maxCarbs}
              onChange={(e) => setMaxCarbs(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="max carbs"
            />
            <span className="ml-2 font-semibold text-gray-700 whitespace-nowrap"> carbs </span>
          </div>
          )
        }

        {selectedFilters.has("fat") && (
          <div>
            <input
              type="number"
              value={minFat}
              onChange={(e) => setMinFat(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="min fat"
            />
            <span> to </span>
            <input
              type="number"
              value={maxFat}
              onChange={(e) => setMaxFat(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="max fat"
            />
            <span className="ml-2 font-semibold text-gray-700 whitespace-nowrap"> fat </span>
          </div>
          )
        }

        <br /> <br />
        <button onClick={fetchItems}>
          get items
        </button>

        <br /> <br />
        <div>
          {hasFetched && items.length === 0 ? (
            <p>no items found</p>
          ) : (
            items.map((item: any, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    width: "33%",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    padding: "10px",
                    alignItems: "center",
                  }}
                >
                  {/* calories and category */}
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                    }}>
                    <h3 style={{ marginBottom: "8px" }}>{item.name}</h3>
                    <p style={{ marginBottom: "4px" }}>calories: {item.calories}</p>
                    <p style={{ marginBottom: "4px" }}>category: {item.category}</p>
                  </div>

                  {/* macros pie chart */}
                  <MacroPieChart
                    protein={item.protein}
                    carbs={item.carbs}
                    fat={item.fat}
                  />
                </div>
              </div>
            ))
          )}
        </div>

    </div>
  );
};

export default App;
