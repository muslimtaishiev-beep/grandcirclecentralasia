import { motion } from "framer-motion";

export function UniversityMarquee({ universities = [] }: { universities?: any[] }) {
  // If the user hasn't added any universities yet, just hide the marquee.
  if (!universities || universities.length === 0) {
    return null;
  }

  // Multiply the array so that it's extremely wide, allowing a seamless -50% loop.
  // Ensure the block is wide enough to cover any screen even if there's only 1 logo
  const MARQUEE_BLOCK = Array.from({ length: 20 }).flatMap(() => universities);

  return (
    <div className="w-full overflow-hidden mt-8 mb-4 py-6 relative flex items-center">
      <div className="flex w-max">
        {/* Block 1 */}
        <motion.div
          className="flex w-max space-x-12 sm:space-x-16 pr-12 sm:pr-16"
          animate={{
            x: ["0%", "-100%"],
          }}
          transition={{
            duration: 150,
            ease: "linear",
            repeat: Infinity,
          }}
        >
          {MARQUEE_BLOCK.map((uni, idx) => (
            <div
              key={`b1-${idx}`}
              className="flex items-center space-x-4 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
            >
              <img
                src={uni.logoBase64}
                alt={`${uni.name} logo`}
                className="h-10 sm:h-12 w-auto max-w-[150px] object-contain bg-transparent"
                style={{ transform: `scale(${uni.logoScale || 1})`, transformOrigin: "center" }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          ))}
        </motion.div>

        {/* Block 2 */}
        <motion.div
          className="flex w-max space-x-12 sm:space-x-16 pr-12 sm:pr-16"
          animate={{
            x: ["0%", "-100%"],
          }}
          transition={{
            duration: 150,
            ease: "linear",
            repeat: Infinity,
          }}
        >
          {MARQUEE_BLOCK.map((uni, idx) => (
            <div
              key={`b2-${idx}`}
              className="flex items-center space-x-4 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
            >
              <img
                src={uni.logoBase64}
                alt={`${uni.name} logo`}
                className="h-10 sm:h-12 w-auto max-w-[150px] object-contain bg-transparent"
                style={{ transform: `scale(${uni.logoScale || 1})`, transformOrigin: "center" }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
