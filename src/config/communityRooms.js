/** Community group chat rooms (must match server community_room_config.room_id). */
export const COMMUNITY_ROOMS = {
  community: {
    id: 'community',
    cacheKey: 'community__traders',
    name: 'Aurox trade Community',
    subtitle: 'All traders · group chat',
    emoji: '💬',
    accent: '#00a884'
  },
  roast: {
    id: 'roast',
    cacheKey: 'roast__community',
    name: 'Roast Community',
    subtitle: 'Talk more · earn Roast points · +$1,000 leaderboard per message',
    emoji: '🔥',
    accent: '#f6465d'
  }
};

export const ROAST_PNL_PER_MESSAGE = 1000;

export function communityRoomFromParam(room) {
  const id = String(room || 'community').trim().toLowerCase();
  return COMMUNITY_ROOMS[id] || COMMUNITY_ROOMS.community;
}

export function roastPointsForText(text) {
  const len = String(text || '').trim().length;
  return Math.max(1, 1 + Math.floor(len / 25));
}
