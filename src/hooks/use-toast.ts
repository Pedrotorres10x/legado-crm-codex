/**
 * Compatibility shim — delegates all toast calls to Sonner.
 * Existing code can keep importing { useToast, toast } from "@/hooks/use-toast"
 * without any changes. The Radix <Toaster /> is no longer rendered.
 */
import { toast as sonnerToast } from "sonner";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  [key: string]: unknown;
}

function toast(opts: ToastOptions) {
  const { title, description, variant } = opts;
  const msg = title || "";

  if (variant === "destructive") {
    sonnerToast.error(msg, { description });
  } else {
    sonnerToast(msg, { description });
  }
}

function useToast() {
  return { toast, toasts: [] as never[], dismiss: (_id?: string) => {} };
}

export { useToast, toast };
