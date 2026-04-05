import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const getPackageName = (id: string) => {
  const normalizedId = id.replaceAll("\\", "/");
  const nodeModulesPath = "/node_modules/";
  const startIndex = normalizedId.lastIndexOf(nodeModulesPath);

  if (startIndex === -1) return undefined;

  const packagePath = normalizedId.slice(startIndex + nodeModulesPath.length);
  const parts = packagePath.split("/");

  if (parts[0]?.startsWith("@") && parts[1]) {
    return `${parts[0]}/${parts[1]}`;
  }

  return parts[0];
};

const manualChunks = (id: string) => {
  const packageName = getPackageName(id);

  if (!packageName) return undefined;

  if (packageName.startsWith("@supabase/")) {
    return "vendor-supabase";
  }

  if (packageName.startsWith("@tanstack/")) {
    return "vendor-query";
  }

  if (["recharts", "victory-vendor"].includes(packageName)) {
    return "vendor-recharts";
  }

  if (["date-fns", "react-day-picker"].includes(packageName)) {
    return "vendor-date";
  }

  if (
    packageName.startsWith("@radix-ui/") ||
    [
      "class-variance-authority",
      "clsx",
      "cmdk",
      "embla-carousel-react",
      "input-otp",
      "lucide-react",
      "next-themes",
      "react-resizable-panels",
      "sonner",
      "tailwind-merge",
      "vaul",
    ].includes(packageName)
  ) {
    return "vendor-ui";
  }

  if (packageName.startsWith("@capacitor/") || packageName === "@capacitor-community/contacts") {
    return "vendor-mobile";
  }

  if (
    packageName === "react-hook-form" ||
    packageName.startsWith("@hookform/") ||
    ["@twilio/voice-sdk", "react-markdown", "tesseract.js", "zod"].includes(packageName)
  ) {
    return "vendor-integrations";
  }

  return "vendor-misc";
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
}));
