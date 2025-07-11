import React, { useState } from "react";
import axios from "axios";

const App = () => {
  const [restaurant, setRestaurant] = useState("mcdonalds");
  const [minCalories, setMinCalories] = useState(0);
  const [maxCalories, setMaxCalories] = useState(600);
  const [items, setItems] = useState([]);

  const fetchItems = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/menu", {
        params: {
          restaurant,
          calorieMax: maxCalories,
          calorieMin: minCalories
        },
      });
      setItems(res.data);
    } catch (err) {
      console.error("Error fetching menu:", err);
    }
  };

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
            <option value="mcdonalds">McDonald's</option>
            <option value="taco bell">Taco Bell</option>
            <option value="chick-fil-a">Chick-fil-A</option>
          </select>
        </div>

        <br />
        {/* calorie range*/}
        <div>
          <input
            type="number"
            value={minCalories}
            onChange={(e) => setMinCalories(Number(e.target.value))}
            placeholder="Min calories"
          />
          <span> to </span>
          <input
            type="number"
            value={maxCalories}
            onChange={(e) => setMaxCalories(Number(e.target.value))}
            placeholder="Max calories"
          />
          <span className="ml-2 font-semibold text-gray-700 whitespace-nowrap"> calories</span>
        </div>

        <br /> <br />
        <button onClick={fetchItems}>
          get items
        </button>

        <div className="mt-8 w-full">
          {items.map((item: any, index) => (
            <div
              key={index}
              className="border border-gray-300 rounded p-4 mb-4 shadow-sm bg-white"
            >
              <h2 className="text-lg font-semibold">{item.name}</h2>
              <p>calories: {item.calories}</p>
              <p>category: {item.category}</p>
            </div>
          ))}
        </div>
    </div>
  );
};

export default App;
