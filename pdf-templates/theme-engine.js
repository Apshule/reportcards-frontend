(() => {
  "use strict";

  const defaults = {
    NURSERY: { primary_color: "#8BC34A", accent_color: "#DCEDC8", background_color: "#F4F9EC" },
    PRIMARY: { primary_color: "#1E5EB5", accent_color: "#BBDEFB", background_color: "#F1F7FD" },
    O_LEVEL: { primary_color: "#7B1FA2", accent_color: "#E1BEE7", background_color: "#FBF5FC" },
    A_LEVEL: { primary_color: "#4B2E9E", accent_color: "#D1C4E9", background_color: "#F6F2FC" },
  };
  const hex = /^#[0-9a-f]{6}$/i;
  let rows = {};
  let loaded = false;
  let pending = null;

  function levelCode(level) {
    const code = String(level || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (/^(ALEVEL|S[56])/.test(code)) return "A_LEVEL";
    if (/^(OLEVEL|S[1-4])/.test(code)) return "O_LEVEL";
    if (/^(PRIMARY|P[1-7])/.test(code)) return "PRIMARY";
    return "NURSERY";
  }

  function normalizeTheme(theme, fallback) {
    const result = { ...fallback };
    if (!theme || typeof theme !== "object") return result;
    for (const key of ["primary_color", "accent_color", "background_color"]) {
      if (typeof theme[key] === "string" && hex.test(theme[key])) result[key] = theme[key];
    }
    return result;
  }

  async function load(api) {
    if (loaded) return rows;
    if (pending) return pending;
    pending = (async () => {
      try {
        if (typeof api === "function") {
          const response = await api("/api/level-themes");
          const themes = Array.isArray(response?.themes) ? response.themes : [];
          rows = themes.reduce((map, item) => {
            const level = levelCode(item?.level);
            map[level] = normalizeTheme(item, { ...defaults[level] });
            return map;
          }, {});
        }
      } catch {
        rows = {};
      } finally {
        loaded = true;
        pending = null;
      }
      return rows;
    })();
    return pending;
  }

  function getTheme(level, supplied) {
    const key = levelCode(level);
    return normalizeTheme(supplied, normalizeTheme(rows[key], { ...defaults[key] }));
  }

  function defaultsFor(level) {
    return { ...defaults[levelCode(level)] };
  }

  window.ReportCardThemeEngine = { defaults, levelCode, load, getTheme, defaultsFor };
})();
