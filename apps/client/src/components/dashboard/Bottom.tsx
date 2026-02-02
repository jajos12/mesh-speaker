import { motion } from "motion/react";
import { Player } from "../room/Player";
import { GlobalVolumeControl } from "./GlobalVolumeControl";

export const Bottom = () => {
  return (
    <motion.div className="flex-shrink-0 border-t border-white/5 glass-darker p-4 pb-safe-plus-4 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] z-10 relative">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex-1 max-w-3xl mx-auto">
          <Player />
        </div>
        <div className="hidden lg:block absolute right-6">
          <GlobalVolumeControl />
        </div>
      </div>
    </motion.div>
  );
};
