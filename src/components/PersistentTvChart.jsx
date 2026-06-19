import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../authContext';
import { isChartingLibraryAvailable } from '../utils/chartingLibraryProbe';
import { fetchTvChartUserId } from '../utils/tvChartStorage';
import TvChartingLibraryEmbed from './TvChartingLibraryEmbed';
import TvWidgetPageEmbed from './TvWidgetPageEmbed';

/** Trade chart — swaps symbol with the active pair chip / URL. */
export default function PersistentTvChart({ symbol, minHeight = 380, fillParent = false, active = true }) {
  const { user } = useContext(AuthContext);
  const [mode, setMode] = useState('tvjs');
  const [chartUserId, setChartUserId] = useState(null);

  useEffect(() => {
    if (process.env.REACT_APP_HAS_CHARTING_LIBRARY !== 'true') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const hasCl = await isChartingLibraryAvailable();
        if (!cancelled) setMode(hasCl ? 'cl' : 'tvjs');
      } catch {
        if (!cancelled) setMode('tvjs');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user?.uid || mode !== 'cl') {
      setChartUserId(null);
      return undefined;
    }
    let cancelled = false;
    fetchTvChartUserId()
      .then((r) => {
        if (!cancelled) setChartUserId(r?.chartUserId || null);
      })
      .catch(() => {
        if (!cancelled) setChartUserId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid, mode]);

  const minH = Math.max(240, Number(minHeight) > 0 ? Number(minHeight) : 380);

  const boxStyle = fillParent
    ? {
        position: 'relative',
        width: '100%',
        height: '100%',
        flex: 1,
        minHeight: minH,
        display: 'flex',
        flexDirection: 'column'
      }
    : {
        position: 'relative',
        width: '100%',
        height: minH,
        minHeight: minH,
        flex: '0 0 auto'
      };

  if (!active) {
    return (
      <div
        className="trade-tv-wrap trade-tv-wrap--persistent trade-tv-wrap--paused"
        style={{ ...boxStyle, background: '#0b0e11' }}
        aria-hidden
      />
    );
  }

  return (
    <div className="trade-tv-wrap trade-tv-wrap--persistent" style={boxStyle}>
      {mode === 'cl' ? (
        <TvChartingLibraryEmbed
          symbol={symbol}
          minHeight={minH}
          chartUserId={chartUserId}
          firebaseUid={user?.uid}
          fillParent={fillParent}
          onMissingLibrary={() => setMode('tvjs')}
        />
      ) : (
        <TvWidgetPageEmbed
          symbol={symbol}
          minHeight={minH}
          firebaseUid={user?.uid}
          fillParent={fillParent}
        />
      )}
    </div>
  );
}
