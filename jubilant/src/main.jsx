import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Android-only styling hook (no Capacitor import; uses global injected by native runtime)
try {
  const cap = globalThis?.Capacitor;
  if (cap?.isNativePlatform?.() && cap?.getPlatform?.() === "android") {
    document.documentElement.dataset.platform = "android";
  }
} catch {
  // ignore
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("App crashed:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error?.message || String(this.state.error);
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-xl surface p-7 border-red-200">
          <div className="text-lg font-extrabold text-red-700">Something went wrong</div>
          <div className="text-sm text-slate-700 mt-2 break-words">{message}</div>
          <div className="text-xs text-slate-500 mt-4 leading-relaxed">
            If this started after an update, try clearing this site’s local data and reloading.
          </div>
          <div className="mt-5 flex gap-2">
            <button
              className="flex-1 btn-secondary py-2"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
            <button
              className="flex-1 btn-primary py-2"
              onClick={() => {
                try {
                  localStorage.clear();
                } catch {
                  // ignore
                }
                window.location.reload();
              }}
            >
              Clear data & Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
