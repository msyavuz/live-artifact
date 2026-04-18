import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// React must resolve to a single copy — otherwise Sandpack (which brings its
// own React as a transitive dep) sees a different react than the app and
// throws "Invalid hook call".
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
