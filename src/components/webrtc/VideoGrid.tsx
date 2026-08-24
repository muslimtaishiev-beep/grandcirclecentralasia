import React from 'react';
import { CallParticipant } from '../../types/webrtc';
import VideoTile from './VideoTile';

interface Props {
  participants: CallParticipant[];
}

export default function VideoGrid({ participants }: Props) {
  const screenSharer = participants.find(p => p.isScreenSharing);
  
  if (screenSharer) {
    const others = participants.filter(p => p.id !== screenSharer.id);
    return (
      <div className="w-full h-full flex gap-4 p-4">
        <div className="flex-[3] min-w-0 h-full">
          <VideoTile participant={screenSharer} isMainPanel={true} />
        </div>
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto w-64 shrink-0">
          {others.map(p => (
            <div key={p.id} className="aspect-video shrink-0">
              <VideoTile participant={p} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const count = participants.length;
  let gridClasses = 'grid gap-4 p-4 w-full h-full';
  
  if (count === 1) gridClasses += ' grid-cols-1';
  else if (count === 2) gridClasses += ' grid-cols-2';
  else if (count <= 4) gridClasses += ' grid-cols-2 grid-rows-2';
  else gridClasses += ' grid-cols-3 auto-rows-[minmax(0,1fr)]';

  return (
    <div className={gridClasses}>
      {participants.map(p => (
        <VideoTile key={p.id} participant={p} />
      ))}
    </div>
  );
}
