import React, { lazy, Suspense, useEffect } from 'react';
import { runDeferredStartup } from './utils/deferredStartup';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider';
import { PriceProvider } from './context/PriceContext';
import Navbar from './simple/NavbarLite';
import BottomNav, { bottomNavHiddenPathLite as bottomNavHiddenPath } from './simple/BottomNavLite';
import DocumentTitleSync from './simple/DocumentTitleSyncLite';
import ProtectedRoute from './simple/ProtectedRouteLite';
import { T } from './app/theme';
import { LoginScreen } from './screens/LoginScreen.jsx';
const HomeScreen = lazy(() => import('./screens/HomeScreen.jsx'));
const MarketsScreen = lazy(() => import('./screens/MarketsScreen.jsx'));
const TradeScreen = lazy(() => import('./screens/TradeScreen.jsx'));
const DashboardScreen = lazy(() => import('./screens/DashboardScreen.jsx'));
const WalletScreen = lazy(() => import('./screens/WalletScreen.jsx').then((m) => ({ default: m.WalletScreen })));
const LeaderboardScreen = lazy(() => import('./screens/LeaderboardScreen.jsx').then((m) => ({ default: m.LeaderboardScreen })));
const ProfileScreen = lazy(() => import('./screens/ProfileScreen.jsx').then((m) => ({ default: m.ProfileScreen })));
const SignupScreen = lazy(() => import('./screens/SignupScreen.jsx').then((m) => ({ default: m.SignupScreen })));
const EditProfileScreen = lazy(() => import('./screens/EditProfileScreen.jsx').then((m) => ({ default: m.EditProfileScreen })));
const AboutFounderScreen = lazy(() => import('./screens/AboutFounderScreen.jsx'));
const DisclaimerScreen = lazy(() => import('./screens/DisclaimerScreen.jsx'));
const PrivacyPolicyScreen = lazy(() => import('./screens/PrivacyPolicyScreen.jsx'));
const DeleteAccountScreen = lazy(() => import('./screens/DeleteAccountScreen.jsx'));
const ChatScreen = lazy(() => import('./screens/ChatScreen.jsx').then((m) => ({ default: m.ChatScreen })));
const LearnScreen = lazy(() => import('./screens/LearnScreen.jsx'));
const LearnBlogRoute = lazy(() => import('./screens/LearnBlogRoute.jsx'));
const ExpertTipsScreen = lazy(() => import('./stockTips/ExpertTipsScreen.jsx'));
const DeveloperStockTipsPanel = lazy(() => import('./stockTips/DeveloperStockTipsPanel.jsx'));
const RewardsScreen = lazy(() => import('./screens/RewardsScreen.jsx'));
const WinnersScreen = lazy(() => import('./screens/WinnersScreen.jsx'));
const CredsWinnersScreen = lazy(() => import('./screens/CredsWinnersScreen.jsx'));
const CredsScreen = lazy(() => import('./screens/CredsScreen.jsx'));
const DeveloperRewardsPanel = lazy(() => import('./stockTips/DeveloperRewardsPanel.jsx'));
const DeveloperPlatformPanel = lazy(() => import('./stockTips/DeveloperPlatformPanel.jsx'));

/**
 * Remount Trade only when ?symbol changes so URL pair wins over stale state.
 * Do not key on the full query string: we strip `focus=chart` after opening the chart, and a
 * remount would reset `fullscreenChart` to false ΓÇö chart would never stay open from Dashboard.
 */
function TradeScreenRoute() {
  return <TradeScreen />;
}

/** Log render errors without blocking the whole app UI. */
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { errorKey: 0 };
  }

  static getDerivedStateFromError() {
    return null;
  }

  componentDidCatch(error, info) {
    console.error('[AuronX] recoverable render error', error, info?.componentStack);
    this.setState((s) => ({ errorKey: s.errorKey + 1 }));
  }

  render() {
    return <React.Fragment key={this.state.errorKey}>{this.props.children}</React.Fragment>;
  }
}

function AppShell() {
  const { pathname } = useLocation();
  const mainBottomPad = !bottomNavHiddenPath(pathname);

  useEffect(() => {
    runDeferredStartup(pathname);
  }, [pathname]);

  return (
    <div style={{ backgroundColor: T.bg, minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', color: T.white, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <DocumentTitleSync />
      <Navbar />
      <main className={mainBottomPad ? 'app-main-with-bottom-nav' : undefined} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%', overflowY: 'visible' }}>
        <Suspense
          fallback={
            <div
              style={{
                color: T.text,
                textAlign: 'center',
                padding: 48,
                fontSize: 15,
                background: T.bg,
                minHeight: '40vh'
              }}
            >
              LoadingΓÇª
            </div>
          }
        >
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%' }}>
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/markets" element={<MarketsScreen />} />
            <Route path="/trade" element={<TradeScreenRoute />} />
            <Route path="/learn" element={<LearnScreen />} />
            <Route path="/learn/:slug" element={<LearnBlogRoute />} />
            <Route path="/tips" element={<ExpertTipsScreen />} />
            <Route path="/rewards" element={<RewardsScreen />} />
            <Route path="/winners" element={<WinnersScreen />} />
            <Route path="/creds-winners" element={<CredsWinnersScreen />} />
            <Route path="/creds" element={<CredsScreen />} />
            <Route path="/insights" element={<Navigate to="/tips" replace />} />
            <Route path="/about" element={<AboutFounderScreen />} />
            <Route path="/about-founder" element={<AboutFounderScreen />} />
            <Route path="/disclaimer" element={<DisclaimerScreen />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyScreen />} />
            <Route path="/delete-account" element={<DeleteAccountScreen />} />
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/signup" element={<SignupScreen />} />
            <Route path="/profile/:userId" element={<ProfileScreen />} />
            <Route path="/chat" element={<ChatScreen />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/wallet"
              element={
                <ProtectedRoute>
                  <WalletScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leaderboard"
              element={
                <ProtectedRoute>
                  <LeaderboardScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/edit"
              element={
                <ProtectedRoute>
                  <EditProfileScreen />
                </ProtectedRoute>
              }
            />
            <Route path="/developer" element={<Navigate to="/developer/stock-tips" replace />} />
            <Route
              path="/developer/stock-tips"
              element={
                <ProtectedRoute>
                  <DeveloperStockTipsPanel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/developer/rewards"
              element={
                <ProtectedRoute>
                  <DeveloperRewardsPanel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/developer/platform"
              element={
                <ProtectedRoute>
                  <DeveloperPlatformPanel />
                </ProtectedRoute>
              }
            />
            <Route path="/x/learn" element={<Navigate to="/learn" replace />} />
            <Route path="/x/:page" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </div>
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <PriceProvider>
          <Router>
            <AppShell />
          </Router>
        </PriceProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
