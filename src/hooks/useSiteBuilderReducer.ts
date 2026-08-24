import { useReducer } from 'react';
import { TenantLandingPage, HistoryAction, SiteBlock } from '../types/siteBuilder';

export interface BuilderState {
  past: TenantLandingPage[];
  present: TenantLandingPage;
  future: TenantLandingPage[];
  selectedBlockId: string | null;
  selectedDevice: 'desktop' | 'tablet' | 'mobile';
  isDirty: boolean;
  syncStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedHash: string;
}

const HISTORY_LIMIT = 30;

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function builderReducer(state: BuilderState, action: HistoryAction): BuilderState {
  switch (action.type) {
    case 'ADD_BLOCK': {
      const { block, index } = action.payload;
      const newPresent = deepClone(state.present);
      
      const insertIndex = index !== undefined ? index : newPresent.blocks.length;
      newPresent.blocks.splice(insertIndex, 0, block);
      
      // Update order
      newPresent.blocks.forEach((b, i) => b.order = i);

      return {
        ...state,
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: newPresent,
        future: [],
        isDirty: true,
        selectedBlockId: block.id,
      };
    }

    case 'REMOVE_BLOCK': {
      const { blockId } = action.payload;
      const newPresent = deepClone(state.present);
      
      newPresent.blocks = newPresent.blocks
        .filter(b => b.id !== blockId)
        .map((b, i) => ({ ...b, order: i }));

      return {
        ...state,
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: newPresent,
        future: [],
        isDirty: true,
        selectedBlockId: state.selectedBlockId === blockId ? null : state.selectedBlockId,
      };
    }

    case 'MOVE_BLOCK': {
      const { sourceIndex, destinationIndex } = action.payload;
      if (
        sourceIndex < 0 || 
        sourceIndex >= state.present.blocks.length || 
        destinationIndex < 0 || 
        destinationIndex >= state.present.blocks.length
      ) {
        return state;
      }

      const newPresent = deepClone(state.present);
      const [movedBlock] = newPresent.blocks.splice(sourceIndex, 1);
      newPresent.blocks.splice(destinationIndex, 0, movedBlock);
      
      newPresent.blocks.forEach((b, i) => b.order = i);

      return {
        ...state,
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: newPresent,
        future: [],
        isDirty: true,
      };
    }

    case 'UPDATE_BLOCK_CONFIG': {
      const { blockId, updates } = action.payload;
      const newPresent = deepClone(state.present);
      const blockIndex = newPresent.blocks.findIndex(b => b.id === blockId);
      
      if (blockIndex === -1) return state;

      // Type cast here is necessary because TS loses the union context, but the Zod schema ensures correctness at runtime
      newPresent.blocks[blockIndex].config.data = {
        ...newPresent.blocks[blockIndex].config.data,
        ...updates,
      } as any;

      return {
        ...state,
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: newPresent,
        future: [],
        isDirty: true,
      };
    }

    case 'UPDATE_BLOCK_PROPS': {
      const { blockId, updates } = action.payload;
      const newPresent = deepClone(state.present);
      const blockIndex = newPresent.blocks.findIndex(b => b.id === blockId);
      
      if (blockIndex === -1) return state;

      newPresent.blocks[blockIndex] = {
        ...newPresent.blocks[blockIndex],
        ...updates,
      };

      return {
        ...state,
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: newPresent,
        future: [],
        isDirty: true,
      };
    }

    case 'UPDATE_PAGE_META': {
      const { updates } = action.payload;
      const newPresent = { ...deepClone(state.present), ...updates };

      return {
        ...state,
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: newPresent,
        future: [],
        isDirty: true,
      };
    }

    case 'SET_SELECTED_BLOCK': {
      return {
        ...state,
        selectedBlockId: action.payload.blockId,
      };
    }

    case 'SET_SELECTED_DEVICE': {
      return {
        ...state,
        selectedDevice: action.payload.device,
      };
    }

    case 'UNDO': {
      if (state.past.length === 0) return state;

      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, state.past.length - 1);

      return {
        ...state,
        past: newPast,
        present: previous,
        future: [state.present, ...state.future],
        isDirty: true,
        selectedBlockId: null,
      };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;

      const next = state.future[0];
      const newFuture = state.future.slice(1);

      return {
        ...state,
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: newFuture,
        isDirty: true,
        selectedBlockId: null,
      };
    }

    case 'RESET_STATE': {
      return {
        ...state,
        past: [],
        present: action.payload.page,
        future: [],
        isDirty: false,
        syncStatus: 'idle',
      };
    }

    case 'SYNC_SUCCESS': {
      const { newVersion, newHash } = action.payload;
      return {
        ...state,
        present: {
          ...state.present,
          version: newVersion,
        },
        isDirty: false,
        syncStatus: 'saved',
        lastSavedHash: newHash,
      };
    }

    case 'SYNC_ERROR': {
      return {
        ...state,
        syncStatus: 'error',
      };
    }

    default:
      return state;
  }
}

export function useSiteBuilderReducer(initialPage: TenantLandingPage, initialHash: string) {
  const initialState: BuilderState = {
    past: [],
    present: initialPage,
    future: [],
    selectedBlockId: null,
    selectedDevice: 'desktop',
    isDirty: false,
    syncStatus: 'idle',
    lastSavedHash: initialHash,
  };

  return useReducer(builderReducer, initialState);
}
