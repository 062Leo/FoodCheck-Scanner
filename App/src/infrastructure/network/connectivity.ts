import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

/** Offline when there is no connection or the internet is known to be unreachable. */
export function isOnlineState(
  state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>
): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
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
