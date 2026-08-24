import React, { createContext, useContext, useState } from 'react';
import { HistoryAction } from '../../../types/siteBuilder';

interface DragDropContextType {
  draggedIndex: number | null;
  setDraggedIndex: (idx: number | null) => void;
  dropTargetIndex: number | null;
  setDropTargetIndex: (idx: number | null) => void;
  handleDrop: (dispatch: React.Dispatch<HistoryAction>) => void;
}

const DragDropContext = createContext<DragDropContextType>({} as any);

export function DragDropProvider({ children }: { children: React.ReactNode }) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const handleDrop = (dispatch: React.Dispatch<HistoryAction>) => {
    if (draggedIndex !== null && dropTargetIndex !== null && draggedIndex !== dropTargetIndex) {
      dispatch({ 
        type: 'MOVE_BLOCK', 
        payload: { sourceIndex: draggedIndex, destinationIndex: dropTargetIndex } 
      });
    }
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  return (
    <DragDropContext.Provider value={{ draggedIndex, setDraggedIndex, dropTargetIndex, setDropTargetIndex, handleDrop }}>
      {children}
    </DragDropContext.Provider>
  );
}

export const useDragDrop = () => useContext(DragDropContext);
