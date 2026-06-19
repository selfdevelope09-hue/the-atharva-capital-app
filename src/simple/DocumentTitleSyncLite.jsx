import { useEffect, useContext, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { getLearnBlogBySlug } from '../content/learnBlogs';
import { AuthContext } from '../authContext';

export default function DocumentTitleSyncLite() {
  const { pathname } = useLocation();
  const auth = useContext(AuthContext);
  const chatBadge = useMemo(() => {
    const uid = auth?.user?.uid;
    if (!uid) return '';
    const dm = (auth.dmThreads || []).reduce(
      (n, t) => n + Number((t.unreadByUser || {})[uid] || 0),
      0
    );
    const total = dm + (Number(auth.communityUnread) || 0);
    if (total <= 0) return '';
    return ` (${total > 99 ? '99+' : total})`;
  }, [auth?.user?.uid, auth?.dmThreads, auth?.communityUnread]);

  useEffect(() => {
    const map = {
      '/': 'AuronX Trade',
      '/markets': 'AuronX Trade Markets',
      '/trade': 'AuronX Trade',
      '/dashboard': 'AuronX Trade Dashboard',
      '/wallet': 'AuronX Trade Wallet',
      '/leaderboard': 'AuronX Trade Leaderboard',
      '/winners': 'Winners — AuronX Trade',
      '/creds': 'Creds & Ratings — AuronX Trade',
      '/learn': 'Learn — AuronX Trade',
      '/tips': 'AuronX Trade Insights'
    };
    if (pathname.startsWith('/learn/')) {
      const slug = pathname.replace(/^\/learn\//, '');
      const blog = getLearnBlogBySlug(slug);
      document.title = blog ? `${blog.title} | AuronX Learn` : 'Learn — AuronX Trade';
      return;
    }
    const base = map[pathname] || 'AuronX Trade';
    document.title = `${base}${chatBadge}`;
  }, [pathname, chatBadge]);
  return null;
}
