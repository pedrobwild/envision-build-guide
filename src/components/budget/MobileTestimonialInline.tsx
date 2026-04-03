import { useState, useRef } from "react";
import { Play, Star, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import depoimentoCover from "@/assets/depoimento-cover.jpg";

const VIDEO_URL =
  "https://pieenhgjulsrjlioozsy.supabase.co/storage/v1/object/public/media/videos%2Fdepoimento-bwild.mov";

export function MobileTestimonialInline() {
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="lg:hidden rounded-xl border border-border bg-card overflow-hidden shadow-sm"
      >
        {/* Video thumbnail + play */}
        <button
          onClick={() => setOpen(true)}
          className="relative w-full aspect-[16/9] bg-muted cursor-pointer group overflow-hidden"
        >
          <img
            src={depoimentoCover}
            alt="Depoimento de cliente Bwild"
            className="w-full h-full object-cover pointer-events-none"
          />
          <div className="absolute inset-0 bg-black/30 group-active:bg-black/20 transition-colors flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Play className="h-6 w-6 text-foreground fill-foreground ml-0.5" />
            </div>
          </div>
        </button>

        {/* Quote */}
        <div className="p-4">
          <div className="flex items-center gap-0.5 mb-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <p className="text-sm font-body text-foreground leading-relaxed italic">
            "Tudo pontual, tudo excelente, logo logo tem outro e já é de vocês!"
          </p>
          <p className="text-xs text-muted-foreground font-body mt-2">
            — Anne, Uberlândia/MG
          </p>
        </div>
      </motion.div>

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
