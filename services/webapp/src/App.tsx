import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import { Results } from './pages/Results';
import { Booking } from './pages/Booking';
import CreateRide from './pages/CreateRide';
import { RideDetail } from './pages/RideDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Messages from './pages/Messages';
import AdminAccounts from './pages/AdminAccounts';
import CompanyFleet from './pages/CompanyFleet';
import ProfileSettings from './pages/ProfileSettings';
import PublicProfile from './pages/PublicProfile';
import MyTrips from './pages/MyTrips';
import Cart from './pages/Cart';
import { useApp } from './store';
import { BrandLogo } from './components/BrandLogo';
import { AppFooter } from './components/AppFooter';
import { Menu, X, MessageCircle, LogOut, ShoppingBag } from 'lucide-react';
import { CookieConsent } from './components/CookieConsent';

type AppShellProps = {
  requireAuth?: boolean;
};

function AppShell({ requireAuth = false }: AppShellProps) {
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
      { to: '/results', label: 'Résultats', current: location.pathname.startsWith('/results') },
      { to: '/my-trips', label: 'Mes trajets', current: location.pathname.startsWith('/my-trips') },
      { to: '/cart', label: 'Panier', current: location.pathname.startsWith('/cart') },
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
    if (token) {
      refreshMessageBadge();
    }
  }, [refreshMessageBadge, token]);

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

  const fromState = { from: location.pathname + location.search + location.hash };
  const needsAuthModal = requireAuth && !token;

  const displayName =
    account?.fullName ||
    account?.companyName ||
    account?.email ||
    'Visiteur';
  const avatarUrl = account?.profilePhotoUrl?.trim();
  const displayInitial = displayName?.charAt(0)?.toUpperCase() ?? 'V';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
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
            {primaryLinks
              .filter((link) =>
                token ? true : link.to === '/' || link.to === '/results' || link.to === '/cart')
              .map((link) => {
                const isCart = link.to === '/cart';
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`inline-flex items-center gap-1 transition hover:text-sky-600 ${
                      link.current ? 'text-sky-600 font-semibold' : ''
                    }`}
                    aria-label={isCart ? 'Panier' : undefined}
                  >
                    {isCart ? (
                      <>
                        <ShoppingBag size={18} />
                        <span className="sr-only">Panier</span>
                      </>
                    ) : (
                      link.label
                    )}
                  </Link>
                );
              })}
            {token ? (
              <>
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
                <Link to="/create" className="btn-primary px-4 py-2 whitespace-nowrap">
                  Publier un trajet
                </Link>
                <button
                  onClick={() => clearSession()}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-slate-50"
                >
                  <LogOut size={14} />
                  Déconnexion
                </button>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-sky-200">
                  Connexion
                </Link>
                <Link to="/register" className="btn-primary px-4 py-2 text-xs font-semibold">
                  Créer un compte
                </Link>
              </div>
            )}
          </nav>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur" id="main-navigation">
            <div className="container-wide py-4 space-y-4 text-sm text-slate-700">

              {token ? (
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
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Bienvenue</p>
                  <p className="text-sm text-slate-600">
                    Parcours librement les trajets. Connecte-toi seulement pour réserver.
                  </p>
                </div>
              )}

              <div className="grid gap-2">
                {primaryLinks
                  .filter((link) => (token ? true : link.to === '/' || link.to === '/results' || link.to === '/cart'))
                  .map((link) => {
                    const isCart = link.to === '/cart';
                    return (
                      <Link
                        key={link.to}
                        to={link.to}
                        className={`flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 ${
                          link.current
                            ? 'bg-sky-50 border-sky-200 text-sky-700 font-semibold'
                            : 'bg-white hover:border-sky-200 hover:text-sky-600'
                        }`}
                      >
                        {isCart ? (
                          <>
                            <ShoppingBag size={16} />
                            <span>Panier</span>
                          </>
                        ) : (
                          link.label
                        )}
                      </Link>
                    );
                  })}
                {token ? (
                  <>
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
                    <Link to="/create" className="btn-primary w-full justify-center px-4 py-2">
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
                  </>
                ) : (
                  <div className="grid gap-2">
                    <Link to="/login" className="rounded-xl border border-slate-200 px-3 py-2 text-center font-semibold text-slate-600">
                      Connexion
                    </Link>
                    <Link to="/register" className="btn-primary w-full justify-center px-4 py-2">
                      Créer un compte
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="app-main relative">
        <div className={needsAuthModal ? 'relative blur-sm opacity-70 pointer-events-none select-none transition duration-300' : 'relative'}>
          <Outlet />
        </div>
        {needsAuthModal && (
          <div className="pointer-events-auto absolute inset-0 flex items-center justify-center px-4 py-10">
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" />
            <div className="relative z-10 flex min-h-[60vh] items-center justify-center px-4 py-10">
              <div className="w-full max-w-lg rounded-[28px] border border-white/20 bg-white/95 p-8 text-center shadow-[0_40px_120px_-45px_rgba(15,23,42,0.8)] backdrop-blur">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Authentification requise
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-slate-900">
                  Connecte-toi pour accéder à cette zone
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Cet espace contient des informations privées ou des actions sensibles. Connecte-toi
                  pour poursuivre, ou crée un compte KariGo en quelques secondes.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Link
                    to="/login"
                    state={fromState}
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Se connecter
                  </Link>
                  <Link
                    to="/register"
                    state={fromState}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
                  >
                    Créer un compte
                  </Link>
                </div>
                <div className="mt-4 text-xs text-slate-500">
                  ou{' '}
                  <Link to="/" className="font-semibold text-slate-600 hover:text-sky-600">
                    revenir à l’accueil
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      <AppFooter />
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
      <CookieConsent />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<AppShell requireAuth={false} />}>
          <Route path="/" element={<Home />} />
          <Route path="/results" element={<Results />} />
          <Route path="/ride/:rideId" element={<RideDetail />} />
          <Route path="/cart" element={<Cart />} />
        </Route>
        <Route element={<AppShell requireAuth />}>
          <Route path="/booking/:rideId" element={<Booking />} />
          <Route path="/create" element={<CreateRide />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/profile" element={<ProfileSettings />} />
          <Route path="/profile/:accountId" element={<PublicProfile />} />
          <Route path="/company/fleet" element={<CompanyFleet />} />
          <Route path="/admin/accounts" element={<AdminAccounts />} />
          <Route path="/my-trips" element={<MyTrips />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
