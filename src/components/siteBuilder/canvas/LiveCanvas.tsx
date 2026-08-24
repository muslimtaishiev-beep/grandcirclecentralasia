import React from 'react';
import { TenantLandingPage, HistoryAction } from '../../../types/siteBuilder';
import CanvasViewportFrame from './CanvasViewportFrame';
import CanvasBlockWrapper from './CanvasBlockWrapper';
import { DragDropProvider } from './DragDropManager';
import PublicThemeInjector from '../../../pages/public/components/PublicThemeInjector';

interface Props {
  page: TenantLandingPage;
  selectedBlockId: string | null;
  selectedDevice: 'desktop' | 'tablet' | 'mobile';
  dispatch: React.Dispatch<HistoryAction>;
}

export default function LiveCanvas({ page, selectedBlockId, selectedDevice, dispatch }: Props) {
  return (
    <DragDropProvider>
      <div 
        className="w-full h-full overflow-y-auto bg-slate-100 dark:bg-slate-900/50 p-4 md:p-8 relative"
        style={{ backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        onClick={() => dispatch({ type: 'SET_SELECTED_BLOCK', payload: { blockId: null } })}
      >
        <PublicThemeInjector theme={page.theme} />
        
        <CanvasViewportFrame device={selectedDevice}>
          <div className="min-h-[70vh] flex flex-col">
            {page.blocks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center h-full">
                <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 border-2 border-dashed border-slate-300 dark:border-slate-700">
                  <span className="text-2xl font-light">+</span>
                </div>
                <p className="font-medium text-lg text-slate-600 dark:text-slate-300">Пустой холст</p>
                <p className="text-sm mt-1 max-w-xs">Выберите блок на левой панели каталога, чтобы добавить его на страницу</p>
              </div>
            ) : (
              page.blocks.map((block, idx) => (
                <CanvasBlockWrapper 
                  key={block.id} 
                  block={block} 
                  index={idx}
                  totalBlocks={page.blocks.length}
                  isSelected={selectedBlockId === block.id}
                  dispatch={dispatch}
                />
              ))
            )}
          </div>
        </CanvasViewportFrame>
      </div>
    </DragDropProvider>
  );
}
