import { create } from 'zustand';
import type { Recall } from '../domain/recalls/recall';
import {
  isRecallSourceVisible,
  recallService,
  type RecallService,
  type RecallState,
} from '../services/RecallService';

interface RecallStoreState {
  /** False while nothing is known or the source is unavailable: the UI shows nothing. */
  visible: boolean;
  recalls: Recall[];
  /** Shows the cache at once, then refreshes it when due. Never throws. */
  load: (service?: RecallService) => Promise<void>;
}

function toStore(state: RecallState): Pick<RecallStoreState, 'visible' | 'recalls'> {
  const visible = isRecallSourceVisible(state, Date.now());
  return { visible, recalls: visible ? state.recalls : [] };
}

export const useRecallStore = create<RecallStoreState>((set) => ({
  visible: false,
  recalls: [],

  load: async (service = recallService) => {
    try {
      set(toStore(await service.getState()));
      set(toStore(await service.refreshIfDue()));
    } catch {
      set({ visible: false, recalls: [] });
    }
  },
}));
