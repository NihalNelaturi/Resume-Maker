import { Component } from "react";

// Catches render-time errors so a single component failure can't white-screen
// the whole app. Reassures the user their data is safe (it lives in this
// browser's localStorage and is untouched by a render error).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surface details in the console for debugging without losing them.
    console.error("Unhandled UI error:", error, info);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-lg border border-red-200 bg-white p-6 shadow-panel">
          <h1 className="text-lg font-bold text-red-800">Something went wrong on screen</h1>
          <p className="mt-2 text-sm text-slate-700">
            The app hit an unexpected error while rendering. <strong>Your data is safe</strong> — it is stored in this
            browser and was not affected. Reloading usually fixes it.
          </p>
          <pre className="mt-3 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-600">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button type="button" className="btn-primary mt-4" onClick={this.handleReload}>
            Reload the app
          </button>
        </div>
      </div>
    );
  }
}
