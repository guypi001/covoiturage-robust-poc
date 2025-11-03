import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import { Results } from './pages/Results';
import { Booking } from './pages/Booking';
import CreateRide from './pages/CreateRide';
import { RideDetail } from './pages/RideDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Messages from './pages/Messages';
import AdminAccounts from './pages/AdminAccounts';
import CompanyFleet from './pages/CompanyFleet';
import ProfileSettings from './pages/ProfileSettings';
import MyTrips from './pages/MyTrips';
import { useApp } from './store';
import { BrandLogo } from './components/BrandLogo';
import { Menu, X, MessageCircle, LogOut } from 'lucide-react';

function ProtectedLayout() {
  const location = useLocation();
  const authReady = useApp((state) => state.authReady);
  const authLoading = useApp((state) => state.authLoading);
  const token = useApp((state) => state.token);
  const account = useApp((state) => state.account);
  const clearSession = useApp((state) => state.clearSession);
  const messageBadge = useApp((state) => state.messageBadge);
  const refreshMessageBadge = useApp((state) => state.refreshMessageBadge);
  const isAdmin = account?.role === 'ADMIN';
  const isCompany = account?.type === 'COMPANY';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const primaryLinks = useMemo(
    () => [
      { to: '/', label: 'Rechercher', current: location.pathname === '/' },
      { to: '/my-trips', label: 'Mes trajets', current: location.pathname.startsWith('/my-trips') },
      ...(isAdmin
        ? [{ to: '/admin/accounts', label: 'Administration', current: location.pathname.startsWith('/admin') }]
        : []),
      ...(isCompany
        ? [{ to: '/company/fleet', label: 'Ma flotte', current: location.pathname.startsWith('/company') }]
        : []),
    ],
    [isAdmin, isCompany, location.pathname],
  );

  useEffect(() => {
    refreshMessageBadge();
  }, [refreshMessageBadge]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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
  const avatarUrl = account?.profilePhotoUrl?.trim();
  const displayInitial = displayName?.charAt(0)?.toUpperCase() ?? 'U';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="container-wide h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 text-slate-800">
              <BrandLogo className="text-lg sm:text-xl" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-sky-200 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 lg:hidden"
              aria-expanded={mobileMenuOpen}
              aria-controls="main-navigation"
              aria-label="Ouvrir le menu de navigation"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>

          <nav className="hidden lg:flex items-center gap-5 text-sm text-slate-700">
            {primaryLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`transition hover:text-sky-600 ${link.current ? 'text-sky-600 font-semibold' : ''}`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/messages"
              className="relative flex items-center gap-2 rounded-full px-3 py-1.5 transition hover:text-sky-600"
            >
              <MessageCircle size={16} />
              Messages
              {messageBadge > 0 && (
                <span className="inline-flex min-w-[1.5rem] h-5 items-center justify-center rounded-full bg-sky-500 px-1 text-[11px] font-semibold text-white">
                  {messageBadge > 9 ? '9+' : messageBadge}
                </span>
              )}
            </Link>
            <Link
              to="/profile"
              className="relative flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:border-sky-200 hover:text-sky-700"
              title="Mon profil"
            >
              <div className="h-8 w-8 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profil"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
                    {displayInitial}
                  </div>
                )}
              </div>
              <span className="hidden xl:inline">{displayName}</span>
            </Link>
            <Link
              to="/create"
              className="btn-primary px-4 py-2 whitespace-nowrap"
            >
              Publier un trajet
            </Link>
            <button
              onClick={() => clearSession()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-slate-50"
            >
              <LogOut size={14} />
              Déconnexion
            </button>
          </nav>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur" id="main-navigation">
            <div className="container-wide py-4 space-y-4 text-sm text-slate-700">
              <Link
                to="/profile"
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm"
              >
                <div className="h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profil"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-500">
                      {displayInitial}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{displayName}</p>
                  <p className="text-xs text-slate-500">Voir mon profil</p>
                </div>
              </Link>

              <div className="grid gap-2">
                {primaryLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`rounded-xl border border-slate-200 px-3 py-2 ${link.current ? 'bg-sky-50 border-sky-200 text-sky-700 font-semibold' : 'bg-white hover:border-sky-200 hover:text-sky-600'}`}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  to="/messages"
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 hover:border-sky-200 hover:text-sky-600"
                >
                  <span className="flex items-center gap-2">
                    <MessageCircle size={16} />
                    Messages
                  </span>
                  {messageBadge > 0 && (
                    <span className="inline-flex min-w-[1.75rem] h-5 items-center justify-center rounded-full bg-sky-500 px-1 text-[11px] font-semibold text-white">
                      {messageBadge > 9 ? '9+' : messageBadge}
                    </span>
                  )}
                </Link>
                <Link
                  to="/create"
                  className="btn-primary w-full justify-center px-4 py-2"
                >
                  Publier un trajet
                </Link>
                <button
                  type="button"
                  onClick={() => clearSession()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-slate-50"
                >
                  <LogOut size={14} />
                  Déconnexion
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
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
          <Route path="/profile" element={<ProfileSettings />} />
          <Route path="/company/fleet" element={<CompanyFleet />} />
          <Route path="/admin/accounts" element={<AdminAccounts />} />
          <Route path="/my-trips" element={<MyTrips />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
