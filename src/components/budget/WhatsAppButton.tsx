import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";

interface WhatsAppButtonProps {
  projectName: string;
  publicId: string;
  phone?: string;
}

export function WhatsAppButton({ projectName, publicId, phone = "5500000000000" }: WhatsAppButtonProps) {
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
      className="fixed bottom-20 lg:bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-[#25D366] text-white px-5 py-3 shadow-lg hover:shadow-xl transition-shadow font-body font-semibold text-sm"
      data-pdf-hide
    >
      <MessageCircle className="h-5 w-5" />
      <span className="hidden sm:inline">Falar no WhatsApp</span>
    </motion.a>
  );
}
