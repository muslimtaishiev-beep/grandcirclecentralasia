import React, { useState } from 'react';
import { SiteBlock, HistoryAction } from '../../../types/siteBuilder';
import BlockPreviewRenderer from './BlockPreviewRenderer';
import { ArrowUp, ArrowDown, Copy, Trash2 } from 'lucide-react';
import { useDragDrop } from './DragDropManager';

interface Props {
  block: SiteBlock;
  index: number;
  totalBlocks: number;
  isSelected: boolean;
  dispatch: React.Dispatch<HistoryAction>;
}

export default function CanvasBlockWrapper({ block, index, totalBlocks, isSelected, dispatch }: Props) {
  const [isHovered, setIsHovered] = useState(false);
  const { draggedIndex, setDraggedIndex, dropTargetIndex, setDropTargetIndex, handleDrop } = useDragDrop();

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'SET_SELECTED_BLOCK', payload: { blockId: block.id } });
  };

  const moveUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (index > 0) {
      dispatch({ type: 'MOVE_BLOCK', payload: { sourceIndex: index, destinationIndex: index - 1 } });
    }
  };

  const moveDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (index < totalBlocks - 1) {
      dispatch({ type: 'MOVE_BLOCK', payload: { sourceIndex: index, destinationIndex: index + 1 } });
    }
  };

  const duplicateBlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newBlock = { ...JSON.parse(JSON.stringify(block)), id: crypto.randomUUID(), order: totalBlocks };
    dispatch({ type: 'ADD_BLOCK', payload: { block: newBlock } });
    // Move the newly added block (at totalBlocks index) to immediately after the current block (index + 1)
    setTimeout(() => {
      dispatch({ type: 'MOVE_BLOCK', payload: { sourceIndex: totalBlocks, destinationIndex: index + 1 } });
    }, 0);
  };

  const deleteBlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'REMOVE_BLOCK', payload: { blockId: block.id } });
    dispatch({ type: 'SET_SELECTED_BLOCK', payload: { blockId: null } });
  };

  const isDragged = draggedIndex === index;
  const isDropTarget = dropTargetIndex === index;

  return (
    <div 
      draggable
      onDragStart={(e) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDropTargetIndex(index);
      }}
      onDragEnd={() => {
        setDraggedIndex(null);
        setDropTargetIndex(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        handleDrop(dispatch);
      }}
      className={`relative group cursor-pointer transition-all duration-200 ${
        isSelected 
          ? 'ring-2 ring-emerald-500 shadow-sm z-20' 
          : isHovered ? 'ring-1 ring-emerald-400/60 z-10' : 'ring-1 ring-transparent hover:ring-slate-300'
      } ${isDragged ? 'opacity-50' : ''}`}
      onClick={handleSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Drop Indicators */}
      {isDropTarget && draggedIndex !== null && draggedIndex > index && (
        <div className="absolute -top-1 left-0 right-0 h-1 bg-emerald-500 z-40 rounded shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
      )}
      {isDropTarget && draggedIndex !== null && draggedIndex < index && (
        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-emerald-500 z-40 rounded shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
      )}

      {(isHovered || isSelected) && !isDragged && (
        <div className="absolute top-2 left-2 z-30 px-2 py-1 bg-slate-900/90 text-white text-[10px] font-bold uppercase rounded shadow-lg backdrop-blur-md">
          {block.type}
        </div>
      )}

      {isSelected && !isDragged && (
        <div className="absolute -top-12 right-4 z-40 flex items-center gap-1 bg-slate-900 p-1.5 rounded-xl shadow-xl border border-slate-700">
          <button onClick={moveUp} disabled={index === 0} className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-800 transition">
            <ArrowUp className="w-4 h-4" />
          </button>
          <button onClick={moveDown} disabled={index === totalBlocks - 1} className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-800 transition">
            <ArrowDown className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-slate-700 mx-1"></div>
          <button onClick={duplicateBlock} className="p-1.5 text-slate-300 hover:text-emerald-400 rounded-lg hover:bg-slate-800 transition">
            <Copy className="w-4 h-4" />
          </button>
          <button onClick={deleteBlock} className="p-1.5 text-slate-300 hover:text-red-400 rounded-lg hover:bg-slate-800 transition">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="relative z-0">
        <BlockPreviewRenderer block={block} />
      </div>
    </div>
  );
}
