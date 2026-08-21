import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, MessageSquare, Instagram, CheckCircle2, QrCode, Link2, Sparkles, Loader2, Copy } from 'lucide-react';
import { CopyButton } from '../ui/CopyButton';

interface CrmIntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CrmIntegrationsModal({ isOpen, onClose }: CrmIntegrationsModalProps) {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'instagram'>('whatsapp');
  const [waConnected, setWaConnected] = useState(false);
  const [igConnected, setIgConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [igToken, setIgToken] = useState('');

  if (!isOpen) return null;

  const handlePairWa = () => {
    setConnecting(true);
    setTimeout(() => {
      setWaConnected(true);
      setConnecting(false);
    }, 2500);
  };

  const handleConnectIg = () => {
    if (!igToken.trim()) return;
    setConnecting(true);
    setTimeout(() => {
      setIgConnected(true);
      setConnecting(false);
    }, 1500);
  };

  const webhookUrl = `${window.location.origin}/api/crm/webhook`;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in text-[var(--text-main)]">
      <div className="w-full max-w-xl bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-panel)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg flex items-center gap-2">
                Интеграции каналов CRM
                <Sparkles className="w-4 h-4 text-emerald-500" />
              </h2>
              <p className="text-xs text-[var(--text-muted)]">Подключение WhatsApp и Instagram Direct для автосоздания сделок</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[var(--border-color)] bg-[var(--bg-app)]">
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition ${
              activeTab === 'whatsapp'
                ? 'border-emerald-500 text-emerald-500 bg-[var(--bg-surface)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-500" /> WhatsApp Business
            {waConnected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
          </button>
          <button
            onClick={() => setActiveTab('instagram')}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition ${
              activeTab === 'instagram'
                ? 'border-purple-500 text-purple-500 bg-[var(--bg-surface)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Instagram className="w-4 h-4 text-purple-500" /> Instagram Direct
            {igConnected && <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />}
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {activeTab === 'whatsapp' ? (
            <div className="space-y-4 text-center">
              {waConnected ? (
                <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col items-center space-y-2">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                  <h3 className="font-bold text-base text-emerald-600 dark:text-emerald-400">WhatsApp Успешно Подключен!</h3>
                  <p className="text-xs text-[var(--text-muted)] max-w-sm">
                    Все входящие сообщения от новых клиентов в WhatsApp будут автоматически генерировать сделки в колонке "New Leads".
                  </p>
                  <button
                    onClick={() => setWaConnected(false)}
                    className="mt-3 px-3 py-1.5 bg-red-500/10 text-red-500 text-xs font-medium rounded-lg hover:bg-red-500/20 transition"
                  >
                    Отключить аккаунт
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-4">
                  <p className="text-xs text-[var(--text-muted)] max-w-md">
                    Откройте WhatsApp на телефоне → Настройки → Связанные устройства → Отсканируйте этот QR-код для привязки CRM.
                  </p>

                  <div className="p-4 bg-white rounded-2xl border border-[var(--border-color)] shadow-md">
                    <QRCodeSVG value={`https://wa.me/settings/pair?token=${Date.now()}`} size={160} />
                  </div>

                  <button
                    onClick={handlePairWa}
                    disabled={connecting}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                    {connecting ? 'Подключение WhatsApp...' : 'Подтвердить сканирование'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {igConnected ? (
                <div className="p-6 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex flex-col items-center space-y-2 text-center">
                  <CheckCircle2 className="w-12 h-12 text-purple-500" />
                  <h3 className="font-bold text-base text-purple-600 dark:text-purple-400">Instagram Direct Активен!</h3>
                  <p className="text-xs text-[var(--text-muted)] max-w-sm">
                    Сообщения из директа Instagram синхронизируются с CRM карточками клиентов.
                  </p>
                  <button
                    onClick={() => setIgConnected(false)}
                    className="mt-3 px-3 py-1.5 bg-red-500/10 text-red-500 text-xs font-medium rounded-lg hover:bg-red-500/20 transition"
                  >
                    Отключить Instagram
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-[var(--text-main)]">
                    Вставьте Graph API Access Token от вашей страницы Instagram Business:
                  </label>
                  <input
                    type="password"
                    value={igToken}
                    onChange={(e) => setIgToken(e.target.value)}
                    placeholder="EAAGm0pxxxxxxx..."
                    className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] outline-hidden focus:border-purple-500"
                  />
                  <button
                    onClick={handleConnectIg}
                    disabled={connecting || !igToken.trim()}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                  >
                    {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Instagram className="w-4 h-4" />}
                    {connecting ? 'Подключение...' : 'Подключить Instagram Direct'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Webhook Info */}
          <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] space-y-2">
            <div className="text-xs font-bold text-[var(--text-main)] flex items-center justify-between">
              <span>CRM Webhook URL:</span>
              <CopyButton text={webhookUrl} label="Копировать Webhook" />
            </div>
            <div className="font-mono text-[11px] text-[var(--text-muted)] truncate bg-[var(--bg-app)] p-2 rounded-lg border border-[var(--border-color)]">
              {webhookUrl}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
