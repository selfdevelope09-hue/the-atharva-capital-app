function dmChannelId(uidA, uidB) {
  const [x, y] = [uidA, uidB].sort();
  return `${x}__${y}`;
}

module.exports = { dmChannelId };
