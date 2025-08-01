import React, { useState, useEffect } from "react";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

// range slider with number inputs for filters
const MacroRangeSlider = ({
  label,
  min,
  max,
  step,
  minVal,
  maxVal,
  setMinVal,
  setMaxVal,
} : {
  label: string;
  min: number;
  max: number;
  step: number;
  minVal: number | "";
  maxVal: number | "";
  setMinVal: (v: number | "") => void;
  setMaxVal: (v: number | "") => void;
}) => {
  return (
    <div style={{ margin: "20px 0" }}>
      <label style={{ fontWeight: "bold" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={minVal}
          onChange={(e) =>
            setMinVal(e.target.value === "" ? "" : Number(e.target.value))
          }
          style={{ width: "70px" }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={minVal === "" ? min : minVal}
          onChange={(e) => setMinVal(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span>to</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={maxVal === "" ? max : maxVal}
          onChange={(e) => setMaxVal(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={maxVal}
          onChange={(e) =>
            setMaxVal(e.target.value === "" ? "" : Number(e.target.value))
          }
          style={{ width: "70px" }}
        />
        <span>{label}</span>
      </div>
    </div>
  );
};

const COLORS = ["#fa75d2", "#5cb6fa", "#faec52"];

// pie chart for protein, carbs, and fats
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

const App = () => {
  const filters = ["calories", "protein", "carbs", "fat"]
  const [restaurant, setRestaurant] = useState("")
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
  const [hasFetched, setHasFetched] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [items, setItems] = useState([])
  const [customRestaurant, setCustomRestaurant] = useState("")
  const [numItems, setNumItems] = useState<number | "">("")

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
      const res = await axios.get("http://127.0.0.1:5050/api/items", {
        params: {
          num: numItems,
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
      setItems(res.data);
      setHasFetched(true);
    } catch (err) {
      console.error("error fetching menu:", err);
      setItems([]);
      setHasFetched(true);
    }
  };

  const fetchRestaurants = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:5050/api/get_restaurants");
      setRestaurants(res.data);
    } catch (err) {
      console.error("error fetching menu:", err);
      setRestaurants([]);
    }
  };

  const fetchCategories = async () => {
    if (!restaurant) return;

    try {
      const res = await axios.get("http://127.0.0.1:5050/api/categories", {
        params: { restaurant },
      });
      setCategories(res.data);
      setSelectedCategories(new Set(res.data));
    } catch (err) {
      console.error("error fetching categories:", err);
      setCategories([]);
      setSelectedCategories(new Set());
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [restaurant]);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: "75px" }}>
      <h2>welcome to Name Your Calories!</h2>
      <br /> <br />

      {/* choose restaurant */}
      <div>
        <label htmlFor="restaurantChoice" style={{ marginRight: "8px" }}>
          choose a restaurant:
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", justifyContent: "center" }}>
          <select
            key={restaurant}
            id="restaurantChoice"
            value={restaurant}
            onChange={(e) => {
              setRestaurant(e.target.value);
              setCustomRestaurant("");
            }}
          >
            <option value="">select from dropdown</option>
            {restaurants.map((rest) => (
              <option key={rest} value={rest}>
                {rest}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* categories */}
      {categories.length > 0 && (
        <div>
          <h4>include categories:</h4>
          {categories.map((cat) => (
            <label key={cat} style={{ marginRight: "10px" }}>
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

      {/* filters */}
      <div>
        <h4>include macro filters: </h4>
        {filters.map((filter) => (
          <label key={filter} style={{ marginRight: "10px" }}>
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

      {/* sliders */}
      {selectedFilters.has("calories") && (
        <MacroRangeSlider
          label="calories"
          min={0}
          max={2000}
          step={50}
          minVal={minCalories}
          maxVal={maxCalories}
          setMinVal={setMinCalories}
          setMaxVal={setMaxCalories}
        />
      )}
      {selectedFilters.has("protein") && (
        <MacroRangeSlider
          label="protein"
          min={0}
          max={150}
          step={5}
          minVal={minProtein}
          maxVal={maxProtein}
          setMinVal={setMinProtein}
          setMaxVal={setMaxProtein}
        />
      )}
      {selectedFilters.has("carbs") && (
        <MacroRangeSlider
          label="carbs"
          min={0}
          max={300}
          step={5}
          minVal={minCarbs}
          maxVal={maxCarbs}
          setMinVal={setMinCarbs}
          setMaxVal={setMaxCarbs}
        />
      )}
      {selectedFilters.has("fat") && (
        <MacroRangeSlider
          label="fat"
          min={0}
          max={100}
          step={5}
          minVal={minFat}
          maxVal={maxFat}
          setMinVal={setMinFat}
          setMaxVal={setMaxFat}
        />
      )}

      <br /> <br />
      <input type="number" value={numItems}
        onChange={(e) =>
          setNumItems(e.target.value === "" ? "" : Number(e.target.value))
        }
        placeholder="items in shuffle res"
      />
      <span> </span>
      <button onClick={fetchItems}>get items</button>
      <br /> <br />

      {/* items */}
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
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                  }}
                >
                  <h3 style={{ marginBottom: "8px" }}>{item.name}</h3>
                  <p style={{ marginBottom: "4px" }}>calories: {item.calories}</p>
                  <p style={{ marginBottom: "4px" }}>category: {item.category}</p>
                </div>
                <MacroPieChart protein={item.protein} carbs={item.carbs} fat={item.fat} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default App;
