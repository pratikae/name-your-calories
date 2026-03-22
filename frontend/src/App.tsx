import React, { useState, useEffect } from "react";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

// pastel versions of the original pink / blue / yellow
const COLORS = ["#f9b3e3", "#a8d4f7", "#fef08a"];

const pill = (active: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 14px",
  borderRadius: "99px",
  border: `1.5px solid ${active ? "#f4a7d9" : "#e0e0e0"}`,
  backgroundColor: active ? "#fce8f5" : "#fafafa",
  color: active ? "#b0469a" : "#777",
  cursor: "pointer",
  fontSize: "0.82rem",
  userSelect: "none",
  fontWeight: active ? 500 : 400,
  transition: "all 0.15s",
});

const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: "8px",
  border: "1.5px solid #e0e0e0",
  fontSize: "0.88rem",
  outline: "none",
  width: "90px",
  color: "#444",
};

const btnStyle: React.CSSProperties = {
  padding: "7px 18px",
  borderRadius: "8px",
  border: "1.5px solid #f4a7d9",
  backgroundColor: "#fce8f5",
  color: "#b0469a",
  cursor: "pointer",
  fontSize: "0.88rem",
  fontWeight: 500,
};

const sectionStyle: React.CSSProperties = {
  marginBottom: "20px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#aaa",
  marginBottom: "8px",
  display: "block",
};

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
}) => (
  <div style={{ margin: "14px 0", display: "flex", justifyContent: "center" }}>
    <div style={{ width: "55%" }}>
      <div style={{ fontSize: "0.75rem", color: "#aaa", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="number" min={min} max={max} step={step} value={minVal}
          onChange={(e) => setMinVal(e.target.value === "" ? "" : Number(e.target.value))}
          style={{ ...inputStyle, width: "65px" }}
        />
        <input
          type="range" min={min} max={max} step={step}
          value={minVal === "" ? min : minVal}
          onChange={(e) => setMinVal(Number(e.target.value))}
          style={{ flex: 1, accentColor: "#f4a7d9" } as React.CSSProperties}
        />
        <span style={{ color: "#ccc", fontSize: "0.8rem" }}>–</span>
        <input
          type="range" min={min} max={max} step={step}
          value={maxVal === "" ? max : maxVal}
          onChange={(e) => setMaxVal(Number(e.target.value))}
          style={{ flex: 1, accentColor: "#f4a7d9" } as React.CSSProperties}
        />
        <input
          type="number" min={min} max={max} step={step} value={maxVal}
          onChange={(e) => setMaxVal(e.target.value === "" ? "" : Number(e.target.value))}
          style={{ ...inputStyle, width: "65px" }}
        />
      </div>
    </div>
  </div>
);

const MacroPieChart = ({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) => {
  const data = [
    { name: "protein", value: protein },
    { name: "carbs", value: carbs },
    { name: "fat", value: fat },
  ];
  return (
    <PieChart width={180} height={180}>
      <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
        {data.map((_, index) => (
          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
        ))}
      </Pie>
      <Tooltip />
      <Legend iconSize={10} wrapperStyle={{ fontSize: "0.75rem" }} />
    </PieChart>
  );
};

type MenuItem = {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  category: string;
};

type MacroLimits = {
  calories?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
};

type PinnedItem = {
  menuItem: MenuItem;
  count: number;
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
  const [showCombos, setShowCombos] = useState(false);

  type ComboData = {
    items: string[];
    count: number;
    total: { calories: number; protein: number; fat: number; carbs: number };
  };

  const [combos, setCombos] = useState<ComboData[]>([]);
  const [numCombos, setNumCombos] = useState<number | "">("");
  const [maxItemsPerCombo, setMaxItemsPerCombo] = useState<number | "">();
  const [closestItems, setClosestItems] = useState(false);
  const [closestCombos, setClosestCombos] = useState(false);

  type CategoryLimit = { min: number | ""; max: number | "" };
  const [categoryLimits, setCategoryLimits] = useState<Record<string, CategoryLimit>>({});

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
          num: numItems, restaurant,
          calorieMin: minCalories, calorieMax: maxCalories,
          proteinMin: minProtein, proteinMax: maxProtein,
          fatMin: minFat, fatMax: maxFat,
          carbMin: minCarbs, carbMax: maxCarbs,
          categories: Array.from(selectedCategories),
        },
        paramsSerializer,
      });
      setItems(res.data.items);
      setClosestItems(res.data.closest);
      setShowCombos(false);
      setHasFetched(true);
    } catch (err) {
      console.error("error fetching items:", err);
      setItems([]);
      setClosestItems(false);
      setShowCombos(false);
      setHasFetched(true);
    }
  };

  const fetchCombos = async () => {
    try {
      const res = await axios.post("http://127.0.0.1:5050/api/get_combos", {
        restaurant,
        categories: Array.from(selectedCategories),
        macros: {
          calorieMin: minCalories, calorieMax: maxCalories,
          proteinMin: minProtein, proteinMax: maxProtein,
          fatMin: minFat, fatMax: maxFat,
          carbMin: minCarbs, carbMax: maxCarbs,
        },
        num: numCombos,
        maxItems: maxItemsPerCombo,
        categoryLimits: Object.fromEntries(
          Object.entries(categoryLimits)
            .filter(([, lim]) => lim.min !== "" || lim.max !== "")
            .map(([cat, lim]) => [cat, {
              ...(lim.min !== "" ? { min: lim.min } : {}),
              ...(lim.max !== "" ? { max: lim.max } : {}),
            }])
        ),
      });
      setCombos(res.data.combos);
      setClosestCombos(res.data.closest);
      setShowCombos(true);
      setHasFetched(true);
    } catch (err) {
      console.error("error fetching combos:", err);
      setCombos([]);
      setClosestCombos(false);
      setShowCombos(true);
      setHasFetched(true);
    }
  };

  const cleanNum = (val: number | ""): number => (typeof val === "number" ? val : 0);

  const calculateRemainingMacros = (
    selectedFilters: Set<string>,
    pinnedItems: PinnedItem[],
    maxVals: { calories: number | ""; protein: number | ""; fat: number | ""; carbs: number | "" }
  ) => {
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

  const calculateCurrentMacros = (pinnedItems: PinnedItem[]) =>
    pinnedItems.reduce(
      (acc, { menuItem: item, count }) => ({
        calories: (acc.calories ?? 0) + item.calories * count,
        protein: (acc.protein ?? 0) + item.protein * count,
        fat: (acc.fat ?? 0) + item.fat * count,
        carbs: (acc.carbs ?? 0) + item.carbs * count,
      }),
      {} as MacroLimits
    );

  const updateRemainingMacros = () => {
    const remaining = calculateRemainingMacros(selectedFilters, pinnedItems, {
      calories: maxCalories, protein: maxProtein, fat: maxFat, carbs: maxCarbs,
    });
    setRemainingMacros(remaining);
  };

  useEffect(() => {
    if (makeCombo && pinnedItems.length > 0) {
      updateRemainingMacros();
    } else {
      setRemainingMacros({});
    }
  }, [pinnedItems, selectedFilters, maxCalories, maxProtein, maxFat, maxCarbs, makeCombo]);

  useEffect(() => {
    if (!makeCombo) setPinnedItems([]);
  }, [makeCombo]);

  const fetchComboItems = async () => {
    const itemCount = cleanNum(numItems);
    const remaining = calculateRemainingMacros(selectedFilters, pinnedItems, {
      calories: maxCalories, protein: maxProtein, fat: maxFat, carbs: maxCarbs,
    });
    try {
      const res = await axios.get("http://127.0.0.1:5050/api/make_combo", {
        params: {
          num: itemCount, restaurant,
          calorieMax: remaining.calories, proteinMax: remaining.protein,
          fatMax: remaining.fat, carbMax: remaining.carbs,
          categories: Array.from(selectedCategories),
        },
        paramsSerializer,
      });
      const fullCombo = [
        ...pinnedItems.flatMap((p) => Array(p.count).fill(p.menuItem)),
        ...res.data,
      ];
      setItems(fullCombo);
      setShowCombos(false);
      setHasFetched(true);
      setRemainingMacros(remaining);
    } catch (err) {
      console.error("error fetching combo items:", err);
      setItems([]);
      setShowCombos(false);
      setHasFetched(true);
    }
  };

  const fetchRestaurants = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:5050/api/get_restaurants");
      setRestaurants(res.data);
    } catch (err) {
      console.error("error fetching restaurants:", err);
      setRestaurants([]);
    }
  };

  const fetchCategories = async () => {
    if (!restaurant) return;
    try {
      const res = await axios.get("http://127.0.0.1:5050/api/categories", { params: { restaurant } });
      setCategories(res.data);
      setSelectedCategories(new Set(res.data));
      setCategoryLimits(Object.fromEntries(res.data.map((c: string) => [c, { min: "", max: "" }])));
    } catch (err) {
      console.error("error fetching categories:", err);
      setCategories([]);
      setSelectedCategories(new Set());
    }
  };

  useEffect(() => { fetchCategories(); }, [restaurant]);
  useEffect(() => { fetchRestaurants(); }, []);

  const currentMacros = calculateCurrentMacros(pinnedItems);

  const handlePinChange = (item: MenuItem, checked: boolean) => {
    setPinnedItems((prev) => {
      const existing = prev.find((p) => p.menuItem.name === item.name);
      if (checked) {
        if (existing) return prev.map((p) => p.menuItem.name === item.name ? { ...p, count: p.count + 1 } : p);
        return [...prev, { menuItem: item, count: 1 }];
      }
      return prev.filter((p) => p.menuItem.name !== item.name);
    });
  };

  const changeItemCount = (itemName: string, newCount: number) => {
    if (newCount <= 0) {
      setPinnedItems((prev) => prev.filter((p) => p.menuItem.name !== itemName));
    } else {
      setPinnedItems((prev) => prev.map((p) => p.menuItem.name === itemName ? { ...p, count: newCount } : p));
    }
  };

  const toggleFilter = (set: Set<string>, val: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(val) ? next.delete(val) : next.add(val);
    setter(next);
  };

  const cardStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "600px",
    maxWidth: "90vw",
    borderRadius: "14px",
    padding: "16px 20px",
    backgroundColor: "#fff",
    boxShadow: "0 2px 14px rgba(0,0,0,0.07)",
  };

  const cardContentStyle: React.CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    textAlign: "left",
    paddingRight: "12px",
  };

  const macroRowStyle: React.CSSProperties = {
    fontSize: "0.8rem",
    color: "#999",
    marginTop: "4px",
  };

  const categoryBadge: React.CSSProperties = {
    display: "inline-block",
    marginTop: "6px",
    padding: "2px 10px",
    borderRadius: "99px",
    backgroundColor: "#fce8f5",
    color: "#b0469a",
    fontSize: "0.75rem",
    fontWeight: 500,
  };

  return (
    <div style={{
      maxWidth: "760px",
      margin: "0 auto",
      padding: "48px 24px 80px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: "#333",
    }}>

      {/* header */}
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#444", marginBottom: "36px" }}>
        name your calories
      </h1>

      {/* restaurant */}
      <div style={sectionStyle}>
        <span style={labelStyle}>restaurant</span>
        <select
          value={restaurant}
          onChange={(e) => setRestaurant(e.target.value)}
          style={{ ...inputStyle, width: "auto", padding: "7px 12px" }}
        >
          <option value="">select a restaurant</option>
          {restaurants.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* categories */}
      {categories.length > 0 && (
        <div style={sectionStyle}>
          <span style={labelStyle}>categories</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {categories.map((cat) => (
              <label key={cat} style={pill(selectedCategories.has(cat))}>
                <input
                  type="checkbox"
                  checked={selectedCategories.has(cat)}
                  onChange={() => toggleFilter(selectedCategories, cat, setSelectedCategories)}
                  style={{ display: "none" }}
                />
                {cat}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* combo category limits */}
      {selectedCategories.size > 0 && (
        <div style={sectionStyle}>
          <span style={labelStyle}>combo category limits</span>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", alignItems: "center", gap: "6px 16px", maxWidth: "340px" }}>
            <div style={{ fontSize: "0.72rem", color: "#ccc", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }} />
            <div style={{ fontSize: "0.72rem", color: "#ccc", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>min</div>
            <div style={{ fontSize: "0.72rem", color: "#ccc", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>max</div>
            {categories.filter((cat) => selectedCategories.has(cat)).map((cat) => (
              <React.Fragment key={cat}>
                <span style={{ fontSize: "0.85rem", color: "#666" }}>{cat}</span>
                <input
                  type="number" min={0} placeholder="—"
                  value={categoryLimits[cat]?.min ?? ""}
                  onChange={(e) => setCategoryLimits((prev) => ({
                    ...prev,
                    [cat]: { ...prev[cat], min: e.target.value === "" ? "" : Number(e.target.value) },
                  }))}
                  style={{ ...inputStyle, width: "60px", textAlign: "center" }}
                />
                <input
                  type="number" min={0} placeholder="—"
                  value={categoryLimits[cat]?.max ?? ""}
                  onChange={(e) => setCategoryLimits((prev) => ({
                    ...prev,
                    [cat]: { ...prev[cat], max: e.target.value === "" ? "" : Number(e.target.value) },
                  }))}
                  style={{ ...inputStyle, width: "60px", textAlign: "center" }}
                />
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* macro filters */}
      <div style={sectionStyle}>
        <span style={labelStyle}>macro filters</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {filters.map((f) => (
            <label key={f} style={pill(selectedFilters.has(f))}>
              <input
                type="checkbox"
                checked={selectedFilters.has(f)}
                onChange={() => toggleFilter(selectedFilters, f, setSelectedFilters)}
                style={{ display: "none" }}
              />
              {f}
            </label>
          ))}
        </div>

        {selectedFilters.has("calories") && (
          <MacroRangeSlider label="calories" min={0} max={2000} step={50}
            minVal={minCalories} maxVal={maxCalories}
            setMinVal={setMinCalories} setMaxVal={setMaxCalories} />
        )}
        {selectedFilters.has("protein") && (
          <MacroRangeSlider label="protein" min={0} max={150} step={5}
            minVal={minProtein} maxVal={maxProtein}
            setMinVal={setMinProtein} setMaxVal={setMaxProtein} />
        )}
        {selectedFilters.has("carbs") && (
          <MacroRangeSlider label="carbs" min={0} max={300} step={5}
            minVal={minCarbs} maxVal={maxCarbs}
            setMinVal={setMinCarbs} setMaxVal={setMaxCarbs} />
        )}
        {selectedFilters.has("fat") && (
          <MacroRangeSlider label="fat" min={0} max={100} step={5}
            minVal={minFat} maxVal={maxFat}
            setMinVal={setMinFat} setMaxVal={setMaxFat} />
        )}
      </div>

      {/* actions */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", marginBottom: "28px" }}>
        <label style={pill(makeCombo)}>
          <input type="checkbox" checked={makeCombo} onChange={(e) => setMakeCombo(e.target.checked)} style={{ display: "none" }} />
          combo mode
        </label>

        <span style={{ color: "#ddd" }}>|</span>

        <input
          type="number" value={numItems} placeholder="# items"
          onChange={(e) => setNumItems(e.target.value === "" ? "" : Number(e.target.value))}
          style={inputStyle}
        />
        <button onClick={() => makeCombo ? fetchComboItems() : fetchItems()} style={btnStyle}>
          shuffle
        </button>

        <span style={{ color: "#ddd" }}>|</span>

        <input
          type="number" value={numCombos} placeholder="# combos"
          onChange={(e) => setNumCombos(e.target.value === "" ? "" : Number(e.target.value))}
          style={inputStyle}
        />
        <input
          type="number" min={2} value={maxItemsPerCombo} placeholder="max items/combo"
          onChange={(e) => setMaxItemsPerCombo(e.target.value === "" ? "" : Number(e.target.value))}
          style={{ ...inputStyle, width: "110px" }}
        />
        <button onClick={fetchCombos} style={btnStyle}>
          get combos
        </button>
      </div>

      {/* pinned items */}
      {makeCombo && pinnedItems.length > 0 && (
        <div style={{ marginBottom: "20px", padding: "16px 20px", borderRadius: "12px", backgroundColor: "#fdf5fb", border: "1px solid #f4d4ec" }}>
          <div style={{ ...labelStyle, marginBottom: "12px" }}>pinned items</div>
          {pinnedItems.map(({ menuItem: item, count }) => (
            <div key={item.name} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span style={{ flex: 1, fontSize: "0.9rem" }}>{item.name}</span>
              <button onClick={() => changeItemCount(item.name, count - 1)} disabled={count <= 1}
                style={{ ...btnStyle, padding: "3px 10px" }}>−</button>
              <span style={{ fontSize: "0.9rem", minWidth: "16px", textAlign: "center" }}>{count}</span>
              <button onClick={() => changeItemCount(item.name, count + 1)}
                style={{ ...btnStyle, padding: "3px 10px" }}>+</button>
              <button onClick={() => setPinnedItems((prev) => prev.filter((p) => p.menuItem.name !== item.name))}
                style={{ ...btnStyle, border: "1.5px solid #f4c0c0", backgroundColor: "#fff5f5", color: "#c06060", padding: "3px 10px" }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* current / remaining macros */}
      {makeCombo && pinnedItems.length > 0 && (
        <div style={{ display: "flex", gap: "32px", marginBottom: "28px", fontSize: "0.85rem" }}>
          <div>
            <div style={labelStyle}>current</div>
            <div style={{ color: "#555", lineHeight: 1.8 }}>
              <div>{currentMacros.calories} cal</div>
              <div>P {currentMacros.protein}g · C {currentMacros.carbs}g · F {currentMacros.fat}g</div>
            </div>
          </div>
          {Object.keys(remainingMacros).length > 0 && (
            <div>
              <div style={labelStyle}>remaining</div>
              <div style={{ color: "#555", lineHeight: 1.8 }}>
                {maxCalories !== "" && <div>{remainingMacros.calories} cal</div>}
                {(maxProtein !== "" || maxFat !== "" || maxCarbs !== "") && (
                  <div>
                    {maxProtein !== "" && `P ${remainingMacros.protein}g`}
                    {maxCarbs !== "" && ` · C ${remainingMacros.carbs}g`}
                    {maxFat !== "" && ` · F ${remainingMacros.fat}g`}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* items */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
        {hasFetched && !showCombos && closestItems && items.length > 0 && (
          <p style={{ color: "#bbb", fontStyle: "italic", fontSize: "0.85rem", margin: "0 0 4px" }}>
            no exact matches — showing closest items
          </p>
        )}
        {hasFetched && !showCombos && items.length === 0 ? (
          <p style={{ color: "#bbb", fontSize: "0.9rem" }}>no items found</p>
        ) : (
          [
            ...Array.from(
              new Map(
                pinnedItems.map((pinnedItem) => {
                  const fullItem = items.find((i) => i.name === pinnedItem.menuItem.name) || pinnedItem.menuItem;
                  return [pinnedItem.menuItem.name, fullItem];
                })
              ).values()
            ),
            ...items.filter((item) => !pinnedItems.some((p) => p.menuItem.name === item.name)),
          ].map((item: any, index) => (
            <div key={index} style={cardStyle}>
              <div style={cardContentStyle}>
                {makeCombo && (
                  <label style={{ ...pill(pinnedItems.some((p) => p.menuItem.name === item.name)), marginBottom: "10px" }}>
                    <input
                      type="checkbox"
                      checked={pinnedItems.some((p) => p.menuItem.name === item.name)}
                      onChange={(e) => handlePinChange(item, e.target.checked)}
                      style={{ display: "none" }}
                    />
                    {pinnedItems.some((p) => p.menuItem.name === item.name) ? "pinned" : "pin"}
                  </label>
                )}
                <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#333" }}>{item.name}</div>
                <div style={macroRowStyle}>
                  {item.calories} cal · P {item.protein}g · C {item.carbs}g · F {item.fat}g
                </div>
                {item.category && <span style={categoryBadge}>{item.category}</span>}
              </div>
              <MacroPieChart protein={item.protein} carbs={item.carbs} fat={item.fat} />
            </div>
          ))
        )}
      </div>

      {/* combos */}
      {showCombos && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", marginTop: "32px" }}>
          <div style={{ ...labelStyle, alignSelf: "flex-start", marginLeft: "calc(50% - 300px)" }}>combos</div>
          {closestCombos && combos.length > 0 && (
            <p style={{ color: "#bbb", fontStyle: "italic", fontSize: "0.85rem", margin: "0 0 4px" }}>
              no exact matches — showing closest combos
            </p>
          )}
          {combos.length === 0 ? (
            <p style={{ color: "#bbb", fontSize: "0.9rem" }}>no combos found</p>
          ) : (
            combos.map((combo, index) => (
              <div key={index} style={cardStyle}>
                <div style={cardContentStyle}>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#333", marginBottom: "6px" }}>
                    combo {index + 1} — {combo.total.calories} cal
                  </div>
                  <ul style={{ margin: "0 0 6px", paddingLeft: "16px", fontSize: "0.85rem", color: "#555", lineHeight: 1.7 }}>
                    {combo.items.map((name, idx) => <li key={idx}>{name}</li>)}
                  </ul>
                  <div style={macroRowStyle}>
                    P {combo.total.protein}g · C {combo.total.carbs}g · F {combo.total.fat}g
                  </div>
                </div>
                <MacroPieChart protein={combo.total.protein} carbs={combo.total.carbs} fat={combo.total.fat} />
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
};

export default App;
