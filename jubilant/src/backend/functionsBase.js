const normalizeBase = (base) => String(base || "").trim().replace(/\/+$/, "");

const readRuntimeBase = () => {
  try {
    return normalizeBase(localStorage.getItem("liras_functions_base_url"));
  } catch {
    return "";
  }
};

const readEnvBase = () =>
  normalizeBase(
    import.meta.env.VITE_FUNCTIONS_BASE_URL ||
      import.meta.env.VITE_NETLIFY_SITE_URL ||
      import.meta.env.VITE_SITE_URL ||
      // Backward-compat (historically used for both AI + admin tools)
      import.meta.env.VITE_AI_BASE_URL
  );

export const getFunctionsBaseUrl = () => readEnvBase() || readRuntimeBase();

export const setFunctionsBaseUrl = (value) => {
  try {
    localStorage.setItem("liras_functions_base_url", normalizeBase(value));
  } catch {
    // ignore
  }
};

