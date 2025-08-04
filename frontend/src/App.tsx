import React, { useState, useEffect } from "react";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

// sliders for filter range inputs
const MacroRangeSlider = ({
  label,
  min,
  max,
  step,
  minVal,
  maxVal,
  setMinVal,
  setMaxVal,
}: {
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
    <div
      style={{
        margin: "20px 0",
        display: "flex",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <div style={{ width: "60%" }}>
        <label style={{ fontWeight: "bold" }}>{label}</label>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginTop: "4px",
            flexWrap: "wrap",
          }}
        >
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
        </div>
      </div>
    </div>
  );
};

const COLORS = ["#fa75d2", "#5cb6fa", "#faec52"];

// pie chart for protein, carbs, and fats
const MacroPieChart = ({
  protein,
  carbs,
  fat,
}: {
  protein: number;
  carbs: number;
  fat: number;
}) => {
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

type MenuItem = {
  name: string
  calories: number
  protein: number
  fat: number
  carbs: number
  category: string
};

type MacroLimits = {
  calories?: number
  protein?: number
  fat?: number
  carbs?: number
};

type PinnedItem = {
  menuItem: MenuItem
  count: number
};

const App = () => {
  const filters = ["calories", "protein", "carbs", "fat"];
  const [restaurant, setRestaurant] = useState("");
  const [restaurants, setRestaurants] = useState<string[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());
  const [minCalories, setMinCalories] = useState<number | "">("");
  const [maxCalories, setMaxCalories] = useState<number | "">("");
  const [minProtein, setMinProtein] = useState<number | "">("");
  const [maxProtein, setMaxProtein] = useState<number | "">("");
  const [minFat, setMinFat] = useState<number | "">("");
  const [maxFat, setMaxFat] = useState<number | "">("");
  const [minCarbs, setMinCarbs] = useState<number | "">("");
  const [maxCarbs, setMaxCarbs] = useState<number | "">("");
  const [hasFetched, setHasFetched] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [numItems, setNumItems] = useState<number | "">("");
  const [makeCombo, setMakeCombo] = useState(false);
  const [remainingMacros, setRemainingMacros] = useState<{
    calories?: number;
    protein?: number;
    fat?: number;
    carbs?: number;
  }>({});

  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);

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

  // fetching one item
  const fetchItems = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:5050/api/items", {
        params: {
          num: numItems,
          restaurant,
          calorieMin: minCalories,
          calorieMax: maxCalories,
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
      console.error("error fetching items:", err);
      setItems([]);
      setHasFetched(true);
    }
  };

  const cleanNum = (val: number | ""): number => (typeof val === "number" ? val : 0);

  const calculateRemainingMacros = (
    selectedFilters: Set<string>,
    pinnedItems: PinnedItem[],
    maxVals: {
      calories: number | "";
      protein: number | "";
      fat: number | "";
      carbs: number | "";
    }
  ): {
    calories?: number;
    protein?: number;
    fat?: number;
    carbs?: number;
  } => {
    const result: { [key: string]: number } = {};

    for (const macro of ["calories", "protein", "fat", "carbs"] as const) {
      if (selectedFilters.has(macro)) {
        const max = typeof maxVals[macro] === "number" ? maxVals[macro] : 0;
        const used = pinnedItems.reduce((sum, { menuItem: item, count }) => sum + item[macro] * count, 0);
        result[macro] = Math.max(0, max - used);
      }
    }

    return result;
  };

  const calculateCurrentMacros = (pinnedItems: PinnedItem[]) => {
    return pinnedItems.reduce(
      (acc, { menuItem: item, count }) => ({
        calories: (acc.calories ?? 0) + item.calories * count,
        protein: (acc.protein ?? 0) + item.protein * count,
        fat: (acc.fat ?? 0) + item.fat * count,
        carbs: (acc.carbs ?? 0) + item.carbs * count,
      }),
      {} as MacroLimits
    );
  };

  const updateRemainingMacros = () => {
    const remaining = calculateRemainingMacros(selectedFilters, pinnedItems, {
      calories: maxCalories,
      protein: maxProtein,
      fat: maxFat,
      carbs: maxCarbs,
    });
    setRemainingMacros(remaining);
  };

  // update remaining macros when pinned items or filters or max values change
  useEffect(() => {
    if (makeCombo && pinnedItems.length > 0) {
      updateRemainingMacros();
    } else {
      // clear remaining macros if not combo mode or no pinned items
      setRemainingMacros({});
    }
  }, [pinnedItems, selectedFilters, maxCalories, maxProtein, maxFat, maxCarbs, makeCombo]);

  // clear pinned items when makeCombo is unchecked
  useEffect(() => {
    if (!makeCombo) {
      setPinnedItems([]);
    }
  }, [makeCombo]);

  // fetch items with filters for combos, adjust filters for pins
  const fetchComboItems = async () => {
    const itemCount = cleanNum(numItems);

    const remaining = calculateRemainingMacros(selectedFilters, pinnedItems, {
      calories: maxCalories,
      protein: maxProtein,
      fat: maxFat,
      carbs: maxCarbs,
    });

    try {
      const res = await axios.get("http://127.0.0.1:5050/api/make_combo", {
        params: {
          num: itemCount,
          restaurant,
          calorieMax: remaining.calories,
          proteinMax: remaining.protein,
          fatMax: remaining.fat,
          carbMax: remaining.carbs,
          categories: Array.from(selectedCategories),
        },
        paramsSerializer,
      });

      const fullCombo = [
        ...pinnedItems.flatMap((p) => Array(p.count).fill(p.menuItem)),
        ...res.data,
      ];
      setItems(fullCombo);
      setHasFetched(true);
      setRemainingMacros(remaining);
    } catch (err) {
      console.error("error fetching combo items:", err);
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

  // fetch the food categories of the restuarant
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

  const currentMacros = calculateCurrentMacros(pinnedItems);

  // handle pin checkbox change, supports duplicates
  const handlePinChange = (item: MenuItem, checked: boolean) => {
    setPinnedItems((prev) => {
      const existing = prev.find((p) => p.menuItem.name === item.name);
      if (checked) {
        if (existing) {
          // increment count
          return prev.map((p) =>
            p.menuItem.name === item.name ? { ...p, count: p.count + 1 } : p
          );
        } else {
          // add new pinned item with count 1
          return [...prev, { menuItem: item, count: 1 }];
        }
      } else {
        // remove pinned item completely
        return prev.filter((p) => p.menuItem.name !== item.name);
      }
    });
  };

  // change count of pinned items with +/- buttons
  const changeCount = (itemName: string, newCount: number) => {
    if (newCount <= 0) {
      setPinnedItems((prev) => prev.filter((p) => p.menuItem.name !== itemName));
    } else {
      setPinnedItems((prev) =>
        prev.map((p) =>
          p.menuItem.name === itemName ? { ...p, count: newCount } : p
        )
      );
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "75px" }}>
      <h2>welcome to Name Your Calories!</h2>
      <br /> <br />

      {/* choose restaurant */}
      <div>
        <label
          htmlFor="restaurantChoice"
          style={{ marginRight: "8px", fontWeight: "bold" }}
        >
          choose a restaurant:
        </label>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "10px",
            justifyContent: "center",
          }}
        >
          <select
            key={restaurant}
            id="restaurantChoice"
            value={restaurant}
            onChange={(e) => {
              setRestaurant(e.target.value);
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

      <label style={{ marginLeft: "10px" }}>
        <input
          type="checkbox"
          checked={makeCombo}
          onChange={(e) => setMakeCombo(e.target.checked)}
        />
        make combo
      </label>

      <br /> <br />
      <input
        type="number"
        value={numItems}
        onChange={(e) =>
          setNumItems(e.target.value === "" ? "" : Number(e.target.value))
        }
        placeholder="items in shuffle res"
      />
      <span> </span>
      <button onClick={() => (makeCombo ? fetchComboItems() : fetchItems())}>
        shuffle items
      </button>

      <br /> <br />

      {/* pinned items with count and +/- buttons */}
      {makeCombo && pinnedItems.length > 0 && (
        <div style={{ marginTop: "20px", maxWidth: 500, marginLeft: "auto", marginRight: "auto" }}>
          <h3>pinned items</h3>
          {pinnedItems.map(({ menuItem: item, count }) => (
            <div
              key={item.name}
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "10px",
                marginBottom: "8px",
              }}
            >
              {/* decrease item count by one */}
              <span style={{ flex: 1 }}>{item.name}</span>
              <button onClick={() => changeCount(item.name, count - 1)} disabled={count <= 1}>
                -
              </button>
              <span>{count}</span>
              {/* increase item count by one */}
              <button onClick={() => changeCount(item.name, count + 1)}>
                +
              </button>

              {/* delete all instances of the item */}
              <button style={{ color: 'red' }} onClick={() => {
                  setPinnedItems((prev) =>
                    prev.filter((p) => p.menuItem.name !== item.name)
                  );
                }}
              >
                delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* current and remaining macros only if making a combo and something is pinned */}
      {makeCombo && pinnedItems.length > 0 && (
        <div
          style={{
            marginTop: "20px",
            display: "flex",
            justifyContent: "center",
            gap: "40px",
            width: "100%",
          }}
        >
          {/* current Macros */}
          <div style={{ textAlign: "center" }}>
            <h4 style={{ marginBottom: "8px" }}>current macros</h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              <li>calories: {currentMacros.calories}</li>
              <li>protein: {currentMacros.protein}</li>
              <li>fat: {currentMacros.fat}</li>
              <li>carbs: {currentMacros.carbs}</li>
            </ul>
          </div>

          {/* remaining Macros */}
          <div style={{ textAlign: "center" }}>
            <h4 style={{ marginBottom: "8px" }}>remaining macros</h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {maxCalories !== "" && <li>calories: {remainingMacros.calories}</li>}
              {maxProtein !== "" && <li>protein: {remainingMacros.protein}</li>}
              {maxFat !== "" && <li>fat: {remainingMacros.fat}</li>}
              {maxCarbs !== "" && <li>carbs: {remainingMacros.carbs}</li>}
            </ul>
          </div>
        </div>
      )}

      <br />

      {/* items */}
      <div>
        {hasFetched && items.length === 0 ? (
          <p>no items found</p>
        ) : (
          [
            // unique pinned items, so only one card per pinned item
            ...Array.from(
              new Map(
                pinnedItems.map((pinnedItem) => {
                  const fullItem =
                    items.find((i) => i.name === pinnedItem.menuItem.name) ||
                    pinnedItem.menuItem;
                  return [pinnedItem.menuItem.name, fullItem];
                })
              ).values()
            ),
            // plus all items that are not pinned
            ...items.filter(
              (item) =>
                !pinnedItems.some((p) => p.menuItem.name === item.name)
            ),
          ].map((item: any, index) => (
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
                  {/* checkbox to pin items */}
                  {makeCombo && (
                    <label>
                      <input
                        type="checkbox"
                        checked={pinnedItems.some((p) => p.menuItem.name === item.name)}
                        onChange={(e) => handlePinChange(item, e.target.checked)}
                      />
                      pin item
                    </label>
                  )}
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