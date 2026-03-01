import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, AlertTriangle } from "lucide-react";

interface ValidityCountdownProps {
  date: string;
  validityDays: number;
}

export function ValidityCountdown({ date, validityDays }: ValidityCountdownProps) {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    const expiresAt = new Date(new Date(date).getTime() + validityDays * 86400000);
    const now = new Date();
    const diff = Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000);
    setDaysLeft(diff);
  }, [date, validityDays]);

  if (daysLeft === null) return null;

  const expired = daysLeft <= 0;
  const urgent = daysLeft > 0 && daysLeft <= 5;

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.6 }}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body font-semibold ${
        expired
          ? "bg-destructive/15 text-destructive"
          : urgent
            ? "bg-warning/15 text-warning"
            : "bg-success/15 text-success"
      }`}
    >
      {expired ? (
        <>
          <AlertTriangle className="h-3.5 w-3.5" />
          Expirado
        </>
      ) : urgent ? (
        <>
          <Clock className="h-3.5 w-3.5 animate-pulse" />
          {daysLeft} {daysLeft === 1 ? "dia restante" : "dias restantes"}
        </>
      ) : (
        <>
          <Clock className="h-3.5 w-3.5" />
          {daysLeft} dias restantes
        </>
      )}
    </motion.div>
  );
}
