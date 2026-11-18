import React from "react";

/** Значок Telegram (самолётик в круге). */
export function TelegramIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#229ED9" />
      <path fill="#fff" d="M5.4 11.8 16.9 7.3c.5-.2 1 .1.8.9l-2 9.3c-.1.6-.5.8-1 .5l-2.8-2.1-1.4 1.3c-.2.2-.3.3-.6.3l.2-2.9 5.3-4.8c.2-.2 0-.3-.3-.1L8.6 13.9l-2.8-.9c-.6-.2-.6-.6.1-.9Z" />
    </svg>
  );
}
