import { useRef } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  // Once we have rendered the app for an authenticated user, never swap the
  // whole tree back to a spinner for a background auth refresh — that would
  // unmount every page (and every open form) and lose unsaved input.
  const hasRenderedRef = useRef(false);

  if (user) {
    hasRenderedRef.current = true;
    return <>{children}</>;
  }

  if (loading) {
    if (hasRenderedRef.current) return <>{children}</>;
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <Navigate to="/auth" replace />;
}
