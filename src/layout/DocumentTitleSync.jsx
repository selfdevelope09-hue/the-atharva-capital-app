import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { BRAND_NAME, BRAND_TAGLINE } from '../app/theme';

export default function DocumentTitleSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    const founder = 'Atharva Darshanwar';
    const brand = BRAND_NAME;
    const titles = {
      '/': `${brand} | Virtual trading · ${founder}`,
      '/about': `About ${brand} — ${BRAND_TAGLINE} · ${founder}`,
      '/privacy-policy': `Privacy Policy – AuronX Trade | ${brand}`,
      '/delete-account': `Account Deletion – AuronX Trade | ${brand}`,
      '/markets': `Markets | ${brand}`,
      '/tips': `Learn | ${brand}`,
      '/insights': `Market insights | ${brand}`,
      '/developer/stock-tips': `Dev — learn & insights | ${brand}`,
      '/trade': `Trade | ${brand}`,
      '/dashboard': `Dashboard | ${brand}`,
      '/wallet': `Wallet | ${brand}`,
      '/leaderboard': `Leaderboard | ${brand}`,
      '/chat': `Chat | ${brand}`,
      '/login': `Login | ${brand}`,
      '/signup': `Sign up | ${brand}`,
      '/profile/edit': `Edit profile | ${brand}`
    };
    if (pathname.startsWith('/profile/')) {
      document.title =
        pathname === '/profile/edit' ? `Edit profile | ${brand}` : `Trader profile | ${brand}`;
      return;
    }
    if (pathname.startsWith('/x/')) {
      const map = {
        '/x/home': 'Home',
        '/x/markets': 'Markets',
        '/x/trade': 'Trading',
        '/x/learn': 'Learn',
        '/x/profile': 'Profile',
        '/x/portfolio': 'Portfolio',
        '/x/leaderboard': 'Leaderboard',
        '/x/notifications': 'Notifications',
        '/x/order-history': 'Order History',
        '/x/insights': 'Insights',
        '/x/settings': 'Settings',
        '/x/achievements': 'Achievements',
        '/x/community': 'Community',
        '/x/ai-prediction': 'AI Prediction',
        '/x/screener': 'Screener',
        '/x/wallet-pro': 'Wallet',
        '/x/news': 'News'
      };
      document.title = `${map[pathname] || 'AuronX Super App'} | ${brand}`;
      return;
    }
    if (
      pathname === '/watchlist' ||
      pathname === '/market-heatmap' ||
      pathname === '/price-alerts' ||
      pathname === '/portfolio-performance' ||
      pathname === '/trade-simulator' ||
      pathname === '/market-sentiment' ||
      pathname === '/trading-journal' ||
      pathname === '/strategies' ||
      pathname === '/risk-management' ||
      pathname === '/economic-calendar' ||
      pathname === '/learning-courses' ||
      pathname === '/streaks-challenges' ||
      pathname === '/notifications' ||
      pathname === '/order-history' ||
      pathname === '/insights-tips' ||
      pathname === '/settings-pro' ||
      pathname === '/achievements' ||
      pathname === '/community' ||
      pathname === '/ai-prediction' ||
      pathname === '/screener' ||
      pathname === '/wallet-pro' ||
      pathname === '/news'
    ) {
      document.title = `AuronX Super App | ${brand}`;
      return;
    }
    document.title = titles[pathname] || `${brand} | ${founder}`;
  }, [pathname]);
  return null;
}
