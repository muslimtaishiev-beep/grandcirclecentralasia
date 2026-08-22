import React, { useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Search, Plus, Filter, MoreHorizontal, DollarSign, Loader2, Link2, MessageSquare, Instagram, Globe, UserCheck, Shield } from 'lucide-react';
import { useCrmDeals, CrmDeal } from '../../../lib/useCrm';
import CrmIntegrationsModal from '../../../components/crm/CrmIntegrationsModal';

export default function CrmDeals() {
  const { activeTenant } = useOutletContext<any>() || {};
  const { orgId } = useParams();
  
  const { deals, loading, addDeal, updateDealColumn, deleteDeal } = useCrmDeals(orgId);

  const [columns] = useState([
    { id: 'new', title: 'Новые Лиды', color: 'border-blue-500' },
    { id: 'contacted', title: 'Переговоры / Взято', color: 'border-yellow-500' },
    { id: 'testing', title: 'Проходят Тест / Договор', color: 'border-purple-500' },
    { id: 'won', title: 'Успешно Зачислены', color: 'border-green-500' },
  ]);

  const [isAddingDeal, setIsAddingDeal] = useState<string | null>(null);
  const [newDealTitle, setNewDealTitle] = useState('');
  const [newDealValue, setNewDealValue] = useState('');
  const [isIntegrationsOpen, setIsIntegrationsOpen] = useState(false);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedManager, setSelectedManager] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');

  // Drag & Drop State
  const [draggingDealId, setDraggingDealId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    setDraggingDealId(dealId);
    e.dataTransfer.setData('text/plain', dealId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetColumn: CrmDeal['column']) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('text/plain');
    if (dealId && dealId !== '') {
      await updateDealColumn(dealId, targetColumn);
    }
    setDraggingDealId(null);
  };

  const handleAddDeal = async (columnId: CrmDeal['column']) => {
    if (!newDealTitle.trim()) {
      setIsAddingDeal(null);
      return;
    }
    await addDeal({
      title: newDealTitle,
      contactId: 'Новый контакт',
      value: Number(newDealValue) || 0,
      column: columnId,
    });
    setNewDealTitle('');
    setNewDealValue('');
    setIsAddingDeal(null);
  };

  const filteredDeals = deals.filter(d => {
    const matchesSearch = d.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesManager = selectedManager === 'all' || (d as any).assignedTo === selectedManager;
    const matchesSource = selectedSource === 'all' || (d as any).source === selectedSource;
    return matchesSearch && matchesManager && matchesSource;
  });

  return (
    <div className="flex flex-col h-full space-y-6 text-[var(--text-main)]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-4">
        <div>
          <h1 className="text-2xl font-bold">Воронка Продаж (Сделки CRM)</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">Управление клиентами, каналами связи и ответственными менеджерами для {activeTenant?.name}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsIntegrationsOpen(true)}
            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition border border-emerald-500/30 cursor-pointer"
          >
            <Link2 className="w-4 h-4" /> Каналы WhatsApp / Insta
          </button>
          
          <button
            onClick={() => setIsAddingDeal('new')}
            className="bg-[var(--accent)] text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:opacity-90 transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Новая Сделка
          </button>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 max-w-xl">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input 
              type="text" 
              placeholder="Поиск сделок..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-main)]"
            />
          </div>

          {/* Responsible Manager Filter */}
          <select
            value={selectedManager}
            onChange={(e) => setSelectedManager(e.target.value)}
            className="bg-[var(--bg-app)] border border-[var(--border-color)] text-[var(--text-main)] px-3 py-1.5 rounded-xl text-xs outline-hidden focus:border-[var(--accent)]"
          >
            <option value="all">Ответственный: Все</option>
            <option value="my">Мои сделки</option>
            <option value="manager_1">Менеджер Асель</option>
            <option value="manager_2">Менеджер Данияр</option>
          </select>

          {/* Source Filter */}
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="bg-[var(--bg-app)] border border-[var(--border-color)] text-[var(--text-main)] px-3 py-1.5 rounded-xl text-xs outline-hidden focus:border-[var(--accent)]"
          >
            <option value="all">Источник: Все</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="web_form">Заявка с сайта</option>
            <option value="manual">Вручную</option>
          </select>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center w-full h-full text-[var(--text-muted)]">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          columns.map(col => {
            const colDeals = filteredDeals.filter(d => d.column === col.id);
            const totalValue = colDeals.reduce((sum, d) => sum + d.value, 0);
            
            return (
              <div 
                key={col.id} 
                className="w-80 shrink-0 flex flex-col bg-[var(--bg-app)]/50 rounded-2xl border border-[var(--border-color)] overflow-hidden"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id as CrmDeal['column'])}
              >
                {/* Column Header */}
                <div className={`p-3.5 border-t-4 ${col.color} bg-[var(--bg-surface)] border-b border-[var(--border-color)] flex items-center justify-between`}>
                  <div className="font-bold text-xs uppercase tracking-wider font-mono text-[var(--text-main)]">{col.title}</div>
                  <div className="bg-[var(--bg-app)] text-[var(--text-muted)] text-xs px-2 py-0.5 rounded-full font-bold">{colDeals.length}</div>
                </div>

                <div className="px-3.5 py-2 text-[11px] text-[var(--text-muted)] border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-surface)]/50">
                  <span>Общая сумма:</span>
                  <span className="font-mono text-[var(--text-main)] font-bold">{totalValue.toLocaleString()} KGS</span>
                </div>

                {/* Cards */}
                <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                  {colDeals.map(deal => {
                    const source = (deal as any).source || 'web_form';
                    return (
                      <div 
                        key={deal.id} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, deal.id)}
                        className={`bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-xl shadow-xs hover:border-[var(--accent)] transition cursor-grab group ${
                          draggingDealId === deal.id ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-bold text-[var(--text-main)] text-sm group-hover:text-[var(--accent)] transition">{deal.title}</div>
                          <button 
                            onClick={() => deleteDeal(deal.id)}
                            className="text-[var(--text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition p-1"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Channel Badge & Manager */}
                        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                          {source === 'whatsapp' && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" /> WhatsApp
                            </span>
                          )}
                          {source === 'instagram' && (
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold flex items-center gap-1">
                              <Instagram className="w-3 h-3" /> Instagram
                            </span>
                          )}
                          {source === 'web_form' && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center gap-1">
                              <Globe className="w-3 h-3" /> Заявка
                            </span>
                          )}

                          <span className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 text-[var(--text-muted)] text-[10px] flex items-center gap-1">
                            <UserCheck className="w-3 h-3" /> {(deal as any).assignedName || 'Менеджер Асель'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]">
                          <div className="text-[11px] text-[var(--text-muted)]">{deal.contactId !== 'Unknown' ? deal.contactId : 'Новый контакт'}</div>
                          <div className="flex items-center text-emerald-600 dark:text-emerald-400 text-xs font-mono font-bold">
                            {deal.value.toLocaleString()} KGS
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {isAddingDeal === col.id ? (
                    <div className="bg-[var(--bg-surface)] border border-[var(--accent)] p-3.5 rounded-xl shadow-sm space-y-2">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Название сделки..."
                        value={newDealTitle}
                        onChange={(e) => setNewDealTitle(e.target.value)}
                        className="w-full bg-transparent text-xs focus:outline-none text-[var(--text-main)] font-semibold"
                      />
                      <input
                        type="number"
                        placeholder="Сумма (KGS)..."
                        value={newDealValue}
                        onChange={(e) => setNewDealValue(e.target.value)}
                        className="w-full bg-transparent text-xs focus:outline-none text-[var(--text-main)] font-mono"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddDeal(col.id as CrmDeal['column']);
                          if (e.key === 'Escape') {
                            setIsAddingDeal(null);
                            setNewDealTitle('');
                            setNewDealValue('');
                          }
                        }}
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <button onClick={() => { setIsAddingDeal(null); setNewDealTitle(''); setNewDealValue(''); }} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)]">Отмена</button>
                        <button onClick={() => handleAddDeal(col.id as CrmDeal['column'])} className="bg-[var(--accent)] text-white text-xs px-3 py-1 rounded-lg font-bold">Добавить</button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setIsAddingDeal(col.id)}
                      className="w-full py-2 flex items-center justify-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] rounded-xl transition border border-transparent border-dashed hover:border-[var(--border-color)] cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Добавить сделку
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <CrmIntegrationsModal
        isOpen={isIntegrationsOpen}
        onClose={() => setIsIntegrationsOpen(false)}
      />

    </div>
  );
}
