import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const webPath = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = `http://127.0.0.1:${process.env.PORT ?? env.PORT ?? 3000}`;

  return {
    root: webPath("."),
    define: { "import.meta.env.API_KEY": JSON.stringify(env.API_KEY ?? "") },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": webPath("./src"),
        "@components": webPath("./src/shared/components"),
        "@lib": webPath("./src/shared/lib"),
        "@utils": webPath("./src/shared/utils"),
      },
    },
    build: { outDir: webPath("../public"), emptyOutDir: true },
    server: {
      proxy: {
        "/api": { target, changeOrigin: false },
        "^/admin/auth$": { target, changeOrigin: false },
      },
    },
  };
});
