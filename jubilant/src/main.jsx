import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-white border border-red-200 rounded-2xl p-6 shadow-sm">
          <div className="text-lg font-extrabold text-red-700">Something went wrong</div>
          <div className="text-sm text-slate-700 mt-2 break-words">{message}</div>
          <div className="text-xs text-slate-500 mt-4 leading-relaxed">
            If this started after an update, try clearing this site’s local data and reloading.
          </div>
          <div className="mt-5 flex gap-2">
            <button
              className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 py-2 rounded-lg font-bold"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
            <button
              className="flex-1 bg-slate-900 hover:bg-black text-white py-2 rounded-lg font-bold"
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
