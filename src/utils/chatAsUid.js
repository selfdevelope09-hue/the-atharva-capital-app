/** Query/body helper when dev acts as a showcase profile in chat. */
export function showcaseChatAsUid(actingAsUid, realUserUid) {
  if (
    actingAsUid &&
    realUserUid &&
    actingAsUid !== realUserUid &&
    String(actingAsUid).startsWith('showcase__')
  ) {
    return actingAsUid;
  }
  return '';
}

export function withChatAsPath(path, actingAsUid, realUserUid) {
  const as = showcaseChatAsUid(actingAsUid, realUserUid);
  if (!as) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}asUid=${encodeURIComponent(as)}`;
}

export function withChatAsBody(body, actingAsUid, realUserUid) {
  const as = showcaseChatAsUid(actingAsUid, realUserUid);
  if (!as) return body;
  return { ...body, asUid: as };
}

export function withTradeAsBody(body, actingAsUid, isActingAsShowcase) {
  if (isActingAsShowcase && actingAsUid) {
    return { ...body, asUid: actingAsUid };
  }
  return body;
}
