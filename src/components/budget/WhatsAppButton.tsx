import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";

interface WhatsAppButtonProps {
  projectName: string;
  publicId: string;
  phone?: string;
}

export function WhatsAppButton({ projectName, publicId, phone = "5511911906183" }: WhatsAppButtonProps) {
  const message = encodeURIComponent(
    `Olá! Estou analisando o orçamento "${projectName}" e gostaria de tirar algumas dúvidas.\n\n🔗 ${getPublicBudgetUrl(publicId)}`
  );
  const url = `https://wa.me/${phone}?text=${message}`;

  return (
    <motion.a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1.5, type: "spring", stiffness: 200 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className="budget-focus-cta fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-40 flex items-center gap-2 rounded-full bg-[#25D366] text-white p-3 lg:px-5 lg:py-3 shadow-lg hover:shadow-xl hover:bg-[#22c55e] active:bg-[#1faa57] font-body font-semibold text-sm focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      data-pdf-hide
    >
      <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
      <span className="hidden sm:inline">Falar no WhatsApp</span>
    </motion.a>
  );
}
