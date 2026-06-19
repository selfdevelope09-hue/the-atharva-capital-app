import PersistentTvChart from './PersistentTvChart';

/** Trade chart — persistent instance; parent route must keep Trade mounted. */
export default function TradeChart({ active = true, ...props }) {
  return <PersistentTvChart active={active} {...props} />;
}
