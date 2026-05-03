import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center gap-4">
      <p className="text-6xl font-bold text-primary">404</p>
      <h1 className="text-xl font-semibold text-foreground">Page not found</h1>
      <p className="text-muted-foreground text-sm">That route doesn't exist in the passenger app.</p>
      <Link to="/" className="mt-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm">
        Back to Home
      </Link>
    </div>
  );
}
