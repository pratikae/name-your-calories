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
  border: `1.5px solid ${active ? "#d894ff" : "#e0e0e0"}`,
  backgroundColor: active ? "#f9eeff" : "#fafafa",
  color: active ? "#9b30d0" : "#777",
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
  border: "1.5px solid #d894ff",
  backgroundColor: "#f9eeff",
  color: "#9b30d0",
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
          style={{ flex: 1, accentColor: "#d894ff" } as React.CSSProperties}
        />
        <span style={{ color: "#ccc", fontSize: "0.8rem" }}>–</span>
        <input
          type="range" min={min} max={max} step={step}
          value={maxVal === "" ? max : maxVal}
          onChange={(e) => setMaxVal(Number(e.target.value))}
          style={{ flex: 1, accentColor: "#d894ff" } as React.CSSProperties}
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

const MacroPieChart = ({ protein, carbs, fat, size = 180 }: { protein: number; carbs: number; fat: number; size?: number }) => {
  const data = [
    { name: "protein", value: protein },
    { name: "carbs", value: carbs },
    { name: "fat", value: fat },
  ];
  return (
    <PieChart width={size} height={size}>
      <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={size * 0.33}>
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
  price?: number;
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
  const [restaurants, setRestaurants] = useState<{ name: string; logo: string | null }[]>([]);
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

  type ComboItem = { name: string; calories: number; protein: number; fat: number; carbs: number };
  type ComboData = {
    items: ComboItem[];
    count: number;
    total: { calories: number; protein: number; fat: number; carbs: number };
  };

  const [combos, setCombos] = useState<ComboData[]>([]);
  const [numCombos, setNumCombos] = useState<number | "">("");
  const [maxItemsPerCombo, setMaxItemsPerCombo] = useState<number | "">();
  const [closestItems, setClosestItems] = useState(false);
  const [closestCombos, setClosestCombos] = useState(false);
  const [addSlug, setAddSlug] = useState("");
  const [addStatus, setAddStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [exclusions, setExclusions] = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem("exclusions") || "{}"); } catch { return {}; }
  });
  const [favItems, setFavItems] = useState<Record<string, MenuItem[]>>(() => {
    try { return JSON.parse(localStorage.getItem("favItems") || "{}"); } catch { return {}; }
  });
  const [favCombos, setFavCombos] = useState<Record<string, ComboData[]>>(() => {
    try { return JSON.parse(localStorage.getItem("favCombos") || "{}"); } catch { return {}; }
  });
  const [expandedFavCombos, setExpandedFavCombos] = useState<Set<string>>(new Set());
  const [expandedFavItems, setExpandedFavItems] = useState<Set<string>>(new Set());

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
          exclude: excludedForRestaurant,
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
        excluded: excludedForRestaurant,
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
          exclude: excludedForRestaurant,
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

  const addRestaurant = async () => {
    if (!addSlug.trim()) return;
    setAddLoading(true);
    setAddStatus(null);
    try {
      const res = await axios.post("http://127.0.0.1:5050/api/add_restaurant", { slug: addSlug.trim() });
      setAddStatus({ msg: `cached ${res.data.restaurant} (${res.data.items_cached} items)`, ok: true });
      setAddSlug("");
      fetchRestaurants();
    } catch (err: any) {
      const msg = err.response?.data?.error || "failed to add restaurant";
      setAddStatus({ msg, ok: false });
    } finally {
      setAddLoading(false);
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
  useEffect(() => { localStorage.setItem("exclusions", JSON.stringify(exclusions)); }, [exclusions]);
  useEffect(() => { localStorage.setItem("favItems", JSON.stringify(favItems)); }, [favItems]);
  useEffect(() => { localStorage.setItem("favCombos", JSON.stringify(favCombos)); }, [favCombos]);

  const excludedForRestaurant = exclusions[restaurant] || [];

  const comboKey = (combo: ComboData) => combo.items.map((i) => i.name).sort().join("|");

  const isItemFaved = (name: string) => (favItems[restaurant] || []).some((i) => i.name === name);
  const toggleFavItem = (item: MenuItem) => {
    setFavItems((prev) => {
      const list = prev[restaurant] || [];
      return {
        ...prev,
        [restaurant]: isItemFaved(item.name) ? list.filter((i) => i.name !== item.name) : [...list, item],
      };
    });
  };

  const isComboFaved = (combo: ComboData) => (favCombos[restaurant] || []).some((c) => comboKey(c) === comboKey(combo));
  const toggleFavCombo = (combo: ComboData) => {
    setFavCombos((prev) => {
      const list = prev[restaurant] || [];
      return {
        ...prev,
        [restaurant]: isComboFaved(combo) ? list.filter((c) => comboKey(c) !== comboKey(combo)) : [...list, combo],
      };
    });
  };

  const excludeItem = (name: string) => {
    setExclusions((prev) => ({
      ...prev,
      [restaurant]: [...(prev[restaurant] || []), name],
    }));
    setItems((prev) => prev.filter((i) => i.name !== name));
  };

  const unexcludeItem = (name: string) => {
    setExclusions((prev) => {
      const next = (prev[restaurant] || []).filter((n) => n !== name);
      return { ...prev, [restaurant]: next };
    });
  };

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
    backgroundColor: "#f9eeff",
    color: "#9b30d0",
    fontSize: "0.75rem",
    fontWeight: 500,
  };

  const sidebarStyle: React.CSSProperties = {
    width: "180px",
    flexShrink: 0,
    position: "sticky",
    top: "48px",
    alignSelf: "flex-start",
    fontSize: "0.8rem",
  };

  const sidebarLabelStyle: React.CSSProperties = {
    fontSize: "0.7rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: "8px",
    display: "block",
  };

  return (
    <div style={{
      display: "flex",
      gap: "24px",
      maxWidth: "1300px",
      margin: "0 auto",
      padding: "48px 24px 80px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: "#333",
      alignItems: "flex-start",
    }}>

      {/* left sidebar — exclusions */}
      <div style={sidebarStyle}>
        {restaurant && excludedForRestaurant.length > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ ...sidebarLabelStyle, marginBottom: 0, color: "#c06060" }}>excluded</span>
              <button
                onClick={() => setExclusions((prev) => ({ ...prev, [restaurant]: [] }))}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.72rem", color: "#c06060" }}
              >clear all</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              {excludedForRestaurant.map((name) => (
                <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", borderRadius: "7px", backgroundColor: "#fff5f5", border: "1px solid #f4c0c0" }}>
                  <span style={{ color: "#c06060", fontSize: "0.78rem", flex: 1, marginRight: "4px", wordBreak: "break-word" }}>{name}</span>
                  <button onClick={() => unexcludeItem(name)} style={{ background: "none", border: "none", cursor: "pointer", color: "#c06060", padding: 0, fontSize: "0.72rem", flexShrink: 0 }}>✕</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* center — main content */}
      <div style={{ flex: 1, minWidth: "720px" }}>

      {/* header */}
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#444", marginBottom: "36px" }}>
        name your calories
      </h1>

      {/* restaurant */}
      <div style={sectionStyle}>
        <span style={labelStyle}>restaurant</span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <select
            value={restaurant}
            onChange={(e) => setRestaurant(e.target.value)}
            style={{ ...inputStyle, width: "auto", padding: "7px 12px" }}
          >
            <option value="">select a restaurant</option>
            {restaurants.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
          </select>
          {(() => {
            const logo = restaurants.find((r) => r.name === restaurant)?.logo;
            return logo ? (
              <img src={logo} alt={restaurant} style={{ height: "36px", objectFit: "contain", borderRadius: "6px" }} />
            ) : null;
          })()}
        </div>
      </div>

      {/* add restaurant */}
      <div style={{ ...sectionStyle, display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="new restaurant"
          value={addSlug}
          onChange={(e) => setAddSlug(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addRestaurant()}
          style={{ ...inputStyle, width: "200px" }}
        />
        <button onClick={addRestaurant} disabled={addLoading} style={btnStyle}>
          {addLoading ? "loading..." : "add restaurant"}
        </button>
        {addStatus && (
          <span style={{ fontSize: "0.82rem", color: addStatus.ok ? "#6abf6a" : "#e05c5c" }}>
            {addStatus.msg}
          </span>
        )}
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
        <div style={{ marginBottom: "20px", padding: "16px 20px", borderRadius: "12px", backgroundColor: "#faf4ff", border: "1px solid #e8beff" }}>
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
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#333" }}>{item.name}</div>
                  <button
                    onClick={() => toggleFavItem(item)}
                    title={isItemFaved(item.name) ? "unfavorite" : "favorite"}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem", padding: "0 2px", lineHeight: 1, color: isItemFaved(item.name) ? "#f5c518" : "#ccc" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#f5c518")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = isItemFaved(item.name) ? "#f5c518" : "#ccc")}
                  >{isItemFaved(item.name) ? "★" : "☆"}</button>
                  <button
                    onClick={() => excludeItem(item.name)}
                    title="exclude this item"
                    style={{ background: "none", border: "none", cursor: "pointer", color: excludedForRestaurant.includes(item.name) ? "#e05c5c" : "#ccc", fontSize: "0.8rem", padding: "0 2px", lineHeight: 1 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#e05c5c")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = excludedForRestaurant.includes(item.name) ? "#e05c5c" : "#ccc")}
                  >✕</button>
                </div>
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

      {/* order buttons */}
      {hasFetched && !showCombos && items.length > 0 && restaurant && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", marginTop: "28px" }}>
          <span style={labelStyle}>order on</span>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={() => window.open(`https://www.doordash.com/search/store/${encodeURIComponent(restaurant)}/`, "_blank")}
              style={{ ...btnStyle, backgroundColor: "#fff5f0", borderColor: "#ff6b35", color: "#ff6b35" }}
            >
              DoorDash
            </button>
            <button
              onClick={() => window.open(`https://www.ubereats.com/search?q=${encodeURIComponent(restaurant)}`, "_blank")}
              style={{ ...btnStyle, backgroundColor: "#f0fff4", borderColor: "#06c167", color: "#06c167" }}
            >
              Uber Eats
            </button>
            <button
              onClick={() => {
                const names = items.map((i) => i.name).join("\n");
                navigator.clipboard.writeText(names);
              }}
              style={btnStyle}
            >
              copy items
            </button>
          </div>
          <div style={{ fontSize: "0.78rem", color: "#bbb", textAlign: "center", maxWidth: "400px" }}>
            opens the restaurant search — use "copy items" to paste your order into the app
          </div>
        </div>
      )}

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
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#333" }}>
                      combo {index + 1} — {combo.total.calories} cal
                    </div>
                    <button
                      onClick={() => toggleFavCombo(combo)}
                      title={isComboFaved(combo) ? "unfavorite" : "favorite"}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem", padding: "0 2px", lineHeight: 1, color: isComboFaved(combo) ? "#f5c518" : "#ccc" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#f5c518")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = isComboFaved(combo) ? "#f5c518" : "#ccc")}
                    >{isComboFaved(combo) ? "★" : "☆"}</button>
                  </div>
                  <ul style={{ margin: "0 0 6px", paddingLeft: "16px", fontSize: "0.85rem", color: "#555", lineHeight: 1.7 }}>
                    {(() => {
                      const counts = new Map<string, { item: typeof combo.items[0]; count: number }>();
                      for (const item of combo.items) {
                        const entry = counts.get(item.name);
                        if (entry) entry.count++;
                        else counts.set(item.name, { item, count: 1 });
                      }
                      return Array.from(counts.values()).map(({ item, count }) => (
                        <li key={item.name} style={{ position: "relative", cursor: "default" }}
                          onMouseEnter={(e) => {
                            const tip = e.currentTarget.querySelector<HTMLDivElement>(".macro-tip");
                            if (tip) tip.style.display = "block";
                          }}
                          onMouseLeave={(e) => {
                            const tip = e.currentTarget.querySelector<HTMLDivElement>(".macro-tip");
                            if (tip) tip.style.display = "none";
                          }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            {item.name}
                            {count > 1 && <span style={{ color: "#9b30d0", fontWeight: 600 }}>×{count}</span>}
                            <button
                              onClick={(e) => { e.stopPropagation(); excludeItem(item.name); }}
                              title="exclude this item"
                              style={{ background: "none", border: "none", cursor: "pointer", color: excludedForRestaurant.includes(item.name) ? "#e05c5c" : "#ccc", fontSize: "0.75rem", padding: "0 1px", lineHeight: 1 }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#e05c5c")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = excludedForRestaurant.includes(item.name) ? "#e05c5c" : "#ccc")}
                            >✕</button>
                          </span>
                          <div className="macro-tip" style={{
                            display: "none", position: "absolute", left: "100%", top: "50%",
                            transform: "translateY(-50%)", marginLeft: "10px", zIndex: 10,
                            backgroundColor: "#fff", border: "1.5px solid #e8beff",
                            borderRadius: "8px", padding: "6px 10px", whiteSpace: "nowrap",
                            fontSize: "0.75rem", color: "#666", boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                          }}>
                            {item.calories * count} cal · P {item.protein * count}g · C {item.carbs * count}g · F {item.fat * count}g
                            {count > 1 && <span style={{ color: "#bbb" }}> ({item.calories} cal × {count})</span>}
                          </div>
                        </li>
                      ));
                    })()}
                  </ul>
                  <div style={macroRowStyle}>
                    P {combo.total.protein}g · C {combo.total.carbs}g · F {combo.total.fat}g
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(combo.items.map((i) => i.name).join("\n"))}
                    style={{ ...btnStyle, marginTop: "10px", fontSize: "0.78rem", padding: "4px 12px" }}
                  >
                    copy items
                  </button>
                </div>
                <MacroPieChart protein={combo.total.protein} carbs={combo.total.carbs} fat={combo.total.fat} />
              </div>
            ))
          )}
          {combos.length > 0 && restaurant && (
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center", marginTop: "8px" }}>
              <button
                onClick={() => window.open(`https://www.doordash.com/search/store/${encodeURIComponent(restaurant)}/`, "_blank")}
                style={{ ...btnStyle, backgroundColor: "#fff5f0", borderColor: "#ff6b35", color: "#ff6b35" }}
              >
                DoorDash
              </button>
              <button
                onClick={() => window.open(`https://www.ubereats.com/search?q=${encodeURIComponent(restaurant)}`, "_blank")}
                style={{ ...btnStyle, backgroundColor: "#f0fff4", borderColor: "#06c167", color: "#06c167" }}
              >
                Uber Eats
              </button>
            </div>
          )}
        </div>
      )}

      </div>{/* end center */}

      {/* right sidebar — favorites */}
      <div style={sidebarStyle}>
        {restaurant && (favItems[restaurant] || []).length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <span style={{ ...sidebarLabelStyle, color: "#b8860b" }}>starred items</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              {(favItems[restaurant] || []).map((item) => {
                const expanded = expandedFavItems.has(item.name);
                const toggle = () => setExpandedFavItems((prev) => {
                  const next = new Set(prev);
                  expanded ? next.delete(item.name) : next.add(item.name);
                  return next;
                });
                return (
                  <div key={item.name} style={{ borderRadius: "7px", backgroundColor: "#fffdf0", border: "1px solid #f5e49c", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "5px 8px" }}>
                      <div style={{ flex: 1, marginRight: "4px", cursor: "pointer" }} onClick={toggle}>
                        <div style={{ color: "#6b5800", fontSize: "0.78rem", wordBreak: "break-word", fontWeight: 500 }}>{item.name}</div>
                        <div style={{ color: "#b8a050", fontSize: "0.7rem", marginTop: "2px" }}>
                          {item.calories} cal · P {item.protein}g
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px", flexShrink: 0 }}>
                        <button onClick={() => toggleFavItem(item)} style={{ background: "none", border: "none", cursor: "pointer", color: "#f5c518", padding: 0, fontSize: "0.8rem" }}>★</button>
                        <button onClick={toggle} style={{ background: "none", border: "none", cursor: "pointer", color: "#c9a84c", padding: 0, fontSize: "0.65rem" }}>{expanded ? "▲" : "▼"}</button>
                      </div>
                    </div>
                    {expanded && (
                      <div style={{ borderTop: "1px solid #f5e49c", padding: "6px 8px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <MacroPieChart protein={item.protein} carbs={item.carbs} fat={item.fat} size={140} />
                        <div style={{ fontSize: "0.7rem", color: "#b8a050", marginTop: "4px", textAlign: "center", lineHeight: 1.6 }}>
                          <div>{item.calories} cal</div>
                          <div>P {item.protein}g · C {item.carbs}g · F {item.fat}g</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {restaurant && (favCombos[restaurant] || []).length > 0 && (
          <div>
            <span style={{ ...sidebarLabelStyle, color: "#b8860b" }}>starred combos</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              {(favCombos[restaurant] || []).map((combo, i) => {
                const key = comboKey(combo);
                const expanded = expandedFavCombos.has(key);
                const toggle = () => setExpandedFavCombos((prev) => {
                  const next = new Set(prev);
                  expanded ? next.delete(key) : next.add(key);
                  return next;
                });
                return (
                  <div key={i} style={{ borderRadius: "7px", backgroundColor: "#fffdf0", border: "1px solid #f5e49c", overflow: "hidden" }}>
                    {/* header row */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "5px 8px" }}>
                      <div style={{ flex: 1, marginRight: "4px", cursor: "pointer" }} onClick={toggle}>
                        <div style={{ color: "#6b5800", fontSize: "0.72rem", wordBreak: "break-word" }}>
                          {combo.items.map((it) => it.name).join(", ")}
                        </div>
                        <div style={{ color: "#b8a050", fontSize: "0.7rem", marginTop: "2px" }}>
                          {combo.total.calories} cal · P {combo.total.protein}g · {combo.count} items
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px", flexShrink: 0 }}>
                        <button onClick={() => toggleFavCombo(combo)} style={{ background: "none", border: "none", cursor: "pointer", color: "#f5c518", padding: 0, fontSize: "0.8rem" }}>★</button>
                        <button onClick={toggle} style={{ background: "none", border: "none", cursor: "pointer", color: "#c9a84c", padding: 0, fontSize: "0.65rem" }}>{expanded ? "▲" : "▼"}</button>
                      </div>
                    </div>
                    {/* expanded details */}
                    {expanded && (
                      <div style={{ borderTop: "1px solid #f5e49c", padding: "6px 8px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <MacroPieChart protein={combo.total.protein} carbs={combo.total.carbs} fat={combo.total.fat} size={140} />
                        <div style={{ fontSize: "0.7rem", color: "#b8a050", marginTop: "4px", textAlign: "center", lineHeight: 1.6 }}>
                          <div>{combo.total.calories} cal</div>
                          <div>P {combo.total.protein}g · C {combo.total.carbs}g · F {combo.total.fat}g</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default App;
