import { useState, useRef } from "react";
import { Play, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import depoimentoCover from "@/assets/depoimento-cover.jpg";

const VIDEO_URL =
  "https://pieenhgjulsrjlioozsy.supabase.co/storage/v1/object/public/media/videos%2Fdepoimento-bwild.mov";

interface TestimonialVideoPreviewProps {
  label?: string;
}

export function TestimonialVideoPreview({
  label = "Confira o depoimento de quem já reformou com a Bwild",
}: TestimonialVideoPreviewProps) {
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <>
      {/* Thumbnail / CTA */}
      <button
        onClick={() => setOpen(true)}
        className="group flex items-center gap-3 text-left max-w-[260px] cursor-pointer"
      >
        <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-white/20 bg-white/5">
          <img
            src={depoimentoCover}
            alt="Depoimento de cliente Bwild"
            className="w-full h-full object-cover pointer-events-none"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
            <div className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center">
              <Play className="h-3.5 w-3.5 text-charcoal fill-charcoal ml-0.5" />
            </div>
          </div>
        </div>
        <span className="text-xs leading-snug text-white/80 font-body group-hover:text-white transition-colors">
          {label}
        </span>
      </button>

      {/* Fullscreen modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-[85vw] max-w-[380px] aspect-[9/16] rounded-xl overflow-hidden shadow-2xl bg-black"
              onClick={(e) => e.stopPropagation()}
            >
              <video
                ref={videoRef}
                src={VIDEO_URL}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setOpen(false)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors z-10"
                aria-label="Fechar vídeo"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
