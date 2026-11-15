import { Component, type ErrorInfo, type ReactNode } from "react";

interface TripPageErrorBoundaryProps {
  children: ReactNode;
}

interface TripPageErrorBoundaryState {
  hasError: boolean;
}

export class TripPageErrorBoundary extends Component<TripPageErrorBoundaryProps, TripPageErrorBoundaryState> {
  state: TripPageErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): TripPageErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Trip page render failed", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[24rem] flex-col items-center justify-center gap-3 bg-sand-50 px-6 text-center">
          <div className="max-w-md rounded-2xl bg-white p-6 shadow-lg ring-1 ring-line/70">
            <h1 className="font-display text-xl font-semibold text-lagoon-900">This trip page hit a problem</h1>
            <p className="mt-2 text-sm text-ink-600">Reload the page to try again. The error details were written to the browser console.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-full bg-sea-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sea-700"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
