import { Link } from "react-router-dom";

// Shown for any address that does not exist, instead of a blank page.
export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <p className="font-mono text-sm text-gold">404</p>
      <h1 className="font-display text-3xl font-semibold mt-2">This page does not exist</h1>
      <p className="text-ink-dim mt-3">The link may be mistyped or out of date.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link to="/" className="btn-primary">Go to the home page</Link>
        <Link to="/shop" className="btn-outline">Browse phones</Link>
      </div>
    </div>
  );
}
