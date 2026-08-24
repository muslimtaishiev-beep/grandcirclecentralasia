import React from 'react';
type DeviceType = 'desktop' | 'tablet' | 'mobile';

interface Props {
  device: DeviceType;
  children: React.ReactNode;
}

export default function CanvasViewportFrame({ device, children }: Props) {
  const getContainerClasses = () => {
    switch (device) {
      case 'desktop': return 'w-full max-w-6xl mx-auto shadow-sm';
      case 'tablet': return 'w-[768px] mx-auto shadow-2xl rounded-xl border border-slate-300 dark:border-slate-700/50 overflow-hidden my-8';
      case 'mobile': return 'w-[375px] mx-auto shadow-2xl rounded-[3rem] border-[14px] border-slate-900 overflow-hidden my-8';
      default: return 'w-full max-w-6xl mx-auto';
    }
  };

  return (
    <div className="w-full h-full flex flex-col pt-4 pb-20">
      <div className={`transition-all duration-500 ease-in-out bg-white dark:bg-[#0B1120] ${getContainerClasses()} relative`}>
        {device === 'mobile' && (
          <div className="absolute top-0 inset-x-0 h-6 bg-slate-900 rounded-b-3xl w-40 mx-auto z-50"></div>
        )}
        <div className="min-h-full">
          {children}
        </div>
      </div>
    </div>
  );
}
