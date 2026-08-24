import React, { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { DndContext, DragOverlay, closestCorners, DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useTaskManager } from '../../../hooks/useTaskManager';
import { WorkspaceTask, TaskStatus } from '../../../types/tasks';
import TaskCard from './components/TaskCard';
import TaskModal from './components/TaskModal';
import TaskFiltersToolbar from './components/TaskFiltersToolbar';
import { Plus, List, LayoutGrid } from 'lucide-react';

const STATUSES: { id: TaskStatus; title: string }[] = [
  { id: 'backlog', title: 'Бэклог' },
  { id: 'todo', title: 'К выполнению' },
  { id: 'in_progress', title: 'В работе' },
  { id: 'review', title: 'Проверка' },
  { id: 'done', title: 'Готово' }
];

function KanbanColumn({ status, tasks, onTaskClick }: { status: {id: TaskStatus, title: string}, tasks: WorkspaceTask[], onTaskClick: (t: WorkspaceTask) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id, data: { type: 'Column' } });
  
  return (
    <div className="flex flex-col h-full w-80 shrink-0 bg-[var(--bg-app)] rounded-2xl overflow-hidden border border-[var(--border-color)]">
      <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex items-center justify-between">
        <h3 className="font-bold text-[var(--text-main)]">{status.title}</h3>
        <span className="bg-slate-100 dark:bg-slate-800 text-[var(--text-muted)] text-xs font-bold px-2 py-1 rounded-full">
          {tasks.length}
        </span>
      </div>
      <div 
        ref={setNodeRef} 
        className={`flex-1 p-3 overflow-y-auto flex flex-col gap-3 transition-colors ${
          isOver ? 'bg-[var(--accent)]/5 border-2 border-dashed border-[var(--accent)] rounded-xl m-1' : ''
        }`}
      >
        {tasks.map(t => <TaskCard key={t.id} task={t} onClick={onTaskClick} />)}
      </div>
    </div>
  );
}

export default function TasksBoardPage() {
  const { activeTenant } = useOutletContext<any>();
  const { tasks, filters, setFilters, moveTask } = useTaskManager(activeTenant?.id);
  const [activeDragTask, setActiveDragTask] = useState<WorkspaceTask | null>(null);
  const [selectedTask, setSelectedTask] = useState<WorkspaceTask | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'Task') {
      setActiveDragTask(event.active.data.current.task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragTask(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (active.data.current?.type === 'Task' && over.data.current?.type === 'Column') {
      moveTask(active.id as string, over.id as TaskStatus);
    }
  };

  return (
    <div className="h-full flex flex-col -m-4 md:-m-6 relative">
      {/* Header Toolbar */}
      <div className="bg-[var(--bg-panel)] p-4 border-b border-[var(--border-color)] flex flex-col md:flex-row items-start md:items-center justify-between z-10 shrink-0 gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex p-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg">
            <div className="p-1.5 bg-[var(--accent)] text-white rounded shadow-sm"><LayoutGrid className="w-4 h-4" /></div>
            <Link to={`/workspace/${activeTenant?.id}/tasks/list`} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded transition">
              <List className="w-4 h-4" />
            </Link>
          </div>
          <div className="h-6 w-px bg-[var(--border-color)] hidden md:block"></div>
          <TaskFiltersToolbar filters={filters} onFilterChange={setFilters} />
        </div>
        
        <button className="flex items-center gap-2 bg-[var(--accent)] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:brightness-110 transition shrink-0">
          <Plus className="w-4 h-4" /> Новая задача
        </button>
      </div>

      <div className="flex-1 overflow-x-auto p-6 bg-[var(--bg-app)]">
        <DndContext collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-6 h-full min-w-max pb-4 items-start">
            {STATUSES.map(status => (
              <KanbanColumn 
                key={status.id} 
                status={status} 
                tasks={tasks.filter(t => t.status === status.id)} 
                onTaskClick={t => setSelectedTask(t)} 
              />
            ))}
          </div>
          <DragOverlay>
            {activeDragTask ? (
              <div className="w-80 shadow-2xl scale-105 rotate-2 opacity-90 cursor-grabbing">
                <TaskCard task={activeDragTask} onClick={() => {}} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <TaskModal isOpen={!!selectedTask} onClose={() => setSelectedTask(null)} task={selectedTask || undefined} />
    </div>
  );
}
