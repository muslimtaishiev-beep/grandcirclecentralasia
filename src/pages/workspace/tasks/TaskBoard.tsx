import React, { useState } from 'react';
import { useOutletContext, Link, useParams } from 'react-router-dom';
import { Search, Plus, List as ListIcon, Columns, MoreHorizontal, Clock, User, Tag, Loader2 } from 'lucide-react';
import { useTasks, Task } from '../../../lib/useTasks';

export default function TaskBoard() {
  const { activeTenant } = useOutletContext<any>() || {};
  const { orgId } = useParams();
  
  const { tasks, loading, addTask, updateTaskColumn, deleteTask } = useTasks(orgId);

  const [columns] = useState([
    { id: 'todo', title: 'To Do' },
    { id: 'in_progress', title: 'In Progress' },
    { id: 'review', title: 'Review' },
    { id: 'done', title: 'Done' },
  ]);

  const [isAddingTask, setIsAddingTask] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Drag & Drop State
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggingTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetColumn: Task['column']) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId && taskId !== '') {
      await updateTaskColumn(taskId, targetColumn);
    }
    setDraggingTaskId(null);
  };

  const handleAddTask = async (columnId: Task['column']) => {
    if (!newTaskTitle.trim()) {
      setIsAddingTask(null);
      return;
    }
    await addTask({
      title: newTaskTitle,
      description: '',
      column: columnId,
      priority: 'medium',
    });
    setNewTaskTitle('');
    setIsAddingTask(null);
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)]">Задачи и Проекты</h1>
          <p className="text-[var(--text-muted)] mt-1">Управление рабочим процессом {activeTenant?.name}</p>
        </div>
        <button className="bg-[var(--accent)] text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:opacity-90 transition shadow-sm">
          <Plus className="w-4 h-4" /> Создать задачу
        </button>
      </div>

      {/* Toolbar & View Switcher */}
      <div className="flex items-center justify-between">
        <div className="w-64 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input 
            type="text" 
            placeholder="Поиск задач..."
            className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text-main)]"
          />
        </div>

        <div className="flex bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg p-1">
          <Link to={`/workspace/${orgId}/tasks/list`} className="px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-main)]">
            <ListIcon className="w-4 h-4" /> Список
          </Link>
          <div className="px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 bg-[var(--bg-surface)] shadow-sm text-[var(--text-main)]">
            <Columns className="w-4 h-4" /> Канбан
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 flex gap-6 overflow-x-auto pb-4 hide-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center w-full h-full text-[var(--text-muted)]">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          columns.map(col => {
            const colTasks = tasks.filter(t => t.column === col.id);
            
            return (
              <div 
                key={col.id} 
                className="w-80 shrink-0 flex flex-col bg-[var(--bg-app)]/50 rounded-xl border border-[var(--border-color)] overflow-hidden"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id as Task['column'])}
              >
                {/* Column Header */}
                <div className="p-3 bg-[var(--bg-surface)]/80 backdrop-blur border-b border-[var(--border-color)] flex items-center justify-between">
                  <div className="font-bold text-sm uppercase tracking-wider font-mono text-[var(--text-main)]">{col.title}</div>
                  <div className="bg-[var(--bg-app)] text-[var(--text-muted)] text-xs px-2 py-0.5 rounded-full font-bold">{colTasks.length}</div>
                </div>

                {/* Cards */}
                <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                  {colTasks.map(task => (
                    <div 
                      key={task.id} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      className={`bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-lg shadow-sm hover:border-[var(--accent)] transition cursor-grab group ${
                        draggingTaskId === task.id ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-[var(--text-main)] text-sm leading-tight group-hover:text-[var(--accent)] transition">{task.title}</div>
                        <button 
                          onClick={() => deleteTask(task.id)}
                          className="text-[var(--text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                      {task.description && <p className="text-xs text-[var(--text-muted)] mb-4 line-clamp-2">{task.description}</p>}
                      
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-bold uppercase ${
                            task.priority === 'high' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 
                            task.priority === 'medium' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' : 
                            'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                          }`}>
                            {task.priority}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-[var(--text-muted)] text-xs">
                          <Clock className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {isAddingTask === col.id ? (
                    <div className="bg-[var(--bg-surface)] border border-[var(--accent)] p-3 rounded-lg shadow-sm">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Название задачи..."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddTask(col.id as Task['column']);
                          if (e.key === 'Escape') {
                            setIsAddingTask(null);
                            setNewTaskTitle('');
                          }
                        }}
                        className="w-full bg-transparent text-sm focus:outline-none text-[var(--text-main)] mb-2"
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button onClick={() => { setIsAddingTask(null); setNewTaskTitle(''); }} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)]">Отмена</button>
                        <button onClick={() => handleAddTask(col.id as Task['column'])} className="bg-[var(--accent)] text-white text-xs px-2 py-1 rounded">Добавить</button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setIsAddingTask(col.id)}
                      className="w-full py-2 flex items-center justify-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] rounded-lg transition border border-transparent border-dashed hover:border-[var(--border-color)]"
                    >
                      <Plus className="w-3 h-3" /> Добавить задачу
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

    </div>
  );
}
