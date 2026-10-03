import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

/**
 * Offline only when the device has no network at all. NetInfo's reachability probe
 * (a Google endpoint) can fail on networks where Open Food Facts is reachable, so it
 * does not stop requests; they have a timeout instead.
 */
export function isOnlineState(state: Pick<NetInfoState, 'isConnected'>): boolean {
  return state.isConnected !== false;
}

export async function isOnline(): Promise<boolean> {
  try {
    return isOnlineState(await NetInfo.fetch());
  } catch {
    // If the state cannot be determined, try the network; requests have a timeout.
    return true;
  }
}

export function subscribeToConnectivity(listener: (online: boolean) => void): () => void {
  return NetInfo.addEventListener((state) => listener(isOnlineState(state)));
}
