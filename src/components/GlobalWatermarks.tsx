import React from 'react';
import { motion } from 'framer-motion';

const LEFT_TAGS = [
  "#DREAMBIG", "#HARVARD", "#FOCUS", "#SAT1550", "#IVYLEAGUE", 
  "#EXPERTS", "#FULLRIDE", "#GLOBAL", "#LEADERS", "#VIP",
  "#PASSION", "#HARDWORK", "#VISION"
];

const RIGHT_TAGS = [
  "#SUCCESS", "#STRATEGY", "#NETWORKING", "#IELTS8.0", "#WIN", 
  "#MENTORS", "#INSPIRATION", "#COMMUNITY", "#FUTURE", "#EXCLUSIVE",
  "#TALENT", "#GOALS", "#DEDICATION"
];

const FONTS = [
  "inherit", // Defaults to Inter (the current thick one)
  "'Silkscreen', cursive", // Pixel font
  "'Caveat', cursive", // Handwritten
  "'Space Mono', monospace" // Monospace
];

export default function GlobalWatermarks() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {LEFT_TAGS.map((tag, i) => {
        const top = 5 + (i * (90 / LEFT_TAGS.length));
        const left = 2 + (i % 2 === 0 ? 0 : 6); 
        const rotate = (i % 2 === 0 ? 1 : -1) * (15 + (i * 3) % 20);
        const font = FONTS[i % FONTS.length];
        const duration = 4 + (i % 3);
        const delay = (i % 4) * 0.5;
        
        return (
          <motion.span
            key={`left-${i}`}
            className="absolute font-black text-slate-900/15 text-2xl md:text-3xl uppercase tracking-widest whitespace-nowrap select-none"
            style={{
              top: `${top}%`,
              left: `${left}%`,
              fontFamily: font,
            }}
            initial={{ rotate }}
            animate={{ 
              rotate, // Preserve rotation
              y: [0, -15, 0] // Levitate up and down
            }}
            transition={{
              duration: duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: delay
            }}
          >
            {tag}
          </motion.span>
        );
      })}

      {RIGHT_TAGS.map((tag, i) => {
        const top = 8 + (i * (90 / RIGHT_TAGS.length));
        const right = 2 + (i % 2 === 0 ? 6 : 0); 
        const rotate = (i % 2 === 0 ? -1 : 1) * (15 + (i * 3) % 20);
        // Offset the font index so right side is mixed differently
        const font = FONTS[(i + 2) % FONTS.length];
        const duration = 4 + (i % 3);
        const delay = (i % 4) * 0.5;
        
        return (
          <motion.span
            key={`right-${i}`}
            className="absolute font-black text-slate-900/15 text-2xl md:text-3xl uppercase tracking-widest whitespace-nowrap select-none"
            style={{
              top: `${top}%`,
              right: `${right}%`,
              fontFamily: font,
            }}
            initial={{ rotate }}
            animate={{ 
              rotate, 
              y: [0, -15, 0] 
            }}
            transition={{
              duration: duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: delay
            }}
          >
            {tag}
          </motion.span>
        );
      })}
    </div>
  );
}
