import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    react: "src/react/index.tsx",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: false,
  target: "es2022",
  external: [
    "react",
    "react-dom",
    "@codesandbox/sandpack-react",
    "@zenfs/core",
  ],
});
