import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { WorkspaceTask } from '../../../../types/tasks';
import { CheckSquare, MessageSquare, Clock } from 'lucide-react';

interface Props {
  task: WorkspaceTask;
  onClick: (task: WorkspaceTask) => void;
}

const priorityColors = {
  low: 'bg-slate-100 text-slate-500',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600'
};

export default function TaskCard({ task, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const completedSubtasks = task.subtasks?.filter(s => s.isCompleted).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--border-color)] shadow-sm cursor-grab active:cursor-grabbing hover:border-[var(--accent)] transition-colors group ${isDragging ? 'opacity-50 z-50 ring-2 ring-[var(--accent)]' : ''}`}
      onClick={(e) => {
        if (!isDragging) onClick(task);
      }}
      {...attributes}
      {...listeners}
    >
      <div className="flex gap-2 mb-3 flex-wrap">
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
        {task.tags?.map(tag => (
          <span key={tag} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            {tag}
          </span>
        ))}
      </div>

      <h4 className="font-bold text-sm text-[var(--text-main)] mb-3 group-hover:text-[var(--accent)] transition line-clamp-2">
        {task.title}
      </h4>
      
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-3 border-t border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          {totalSubtasks > 0 && (
            <div className={`flex items-center gap-1 ${completedSubtasks === totalSubtasks ? 'text-emerald-500' : ''}`}>
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{completedSubtasks}/{totalSubtasks}</span>
            </div>
          )}
          {task.commentsCount > 0 && (
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{task.commentsCount}</span>
            </div>
          )}
          {task.dueDate && (
            <div className="flex items-center gap-1 text-orange-500">
              <Clock className="w-3.5 h-3.5" />
              <span>{new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>
        
        {/* Avatars */}
        {task.assigneeStaffIds && task.assigneeStaffIds.length > 0 && (
          <div className="flex -space-x-2">
            {task.assigneeStaffIds.slice(0, 3).map((id, i) => (
              <div key={id} className="w-6 h-6 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-[10px] font-bold border-2 border-[var(--bg-panel)] z-10">
                {id.substring(0,2).toUpperCase()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
