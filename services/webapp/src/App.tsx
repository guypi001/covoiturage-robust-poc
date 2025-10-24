import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, Outlet } from 'react-router-dom';
import Home from './pages/Home';
import { Results } from './pages/Results';
import { Booking } from './pages/Booking';
import CreateRide from './pages/CreateRide';
import { RideDetail } from './pages/RideDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Messages from './pages/Messages';
import { useApp } from './store';
import { BrandLogo } from './components/BrandLogo';

function ProtectedLayout() {
  const authReady = useApp((state) => state.authReady);
  const authLoading = useApp((state) => state.authLoading);
  const token = useApp((state) => state.token);
  const account = useApp((state) => state.account);
  const clearSession = useApp((state) => state.clearSession);
  const messageBadge = useApp((state) => state.messageBadge);
  const refreshMessageBadge = useApp((state) => state.refreshMessageBadge);

  useEffect(() => {
    refreshMessageBadge();
  }, [refreshMessageBadge]);

  if (!authReady || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Vérification de la session…
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const displayName =
    account?.fullName ||
    account?.companyName ||
    account?.email ||
    'Utilisateur';

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <BrandLogo className="text-lg sm:text-xl" />
          </Link>
          <nav className="flex items-center gap-6 text-sm text-slate-700">
            <Link to="/" className="hover:text-sky-600">
              Rechercher
            </Link>
            <Link to="/messages" className="relative hover:text-sky-600 flex items-center gap-2">
              Messages
              {messageBadge > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 rounded-full bg-sky-500 text-white text-[11px] px-1">
                  {messageBadge > 9 ? '9+' : messageBadge}
                </span>
              )}
            </Link>
            <Link to="/create" className="btn-primary px-4 py-2">
              Publier un trajet
            </Link>
            <span className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{displayName}</span>
            </span>
            <button
              onClick={() => clearSession()}
              className="text-xs px-3 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
            >
              Déconnexion
            </button>
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </>
  );
}

export default function App() {
  const initializeAuth = useApp((state) => state.initializeAuth);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/results" element={<Results />} />
          <Route path="/booking/:rideId" element={<Booking />} />
          <Route path="/ride/:rideId" element={<RideDetail />} />
          <Route path="/create" element={<CreateRide />} />
          <Route path="/messages" element={<Messages />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
