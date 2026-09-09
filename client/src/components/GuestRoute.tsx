import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homePathForUser } from '../lib/authStorage';

/** Sends logged-in users away from login/register to their dashboard. */
export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={homePathForUser(user)} replace />;
  }

  return <>{children}</>;
}
