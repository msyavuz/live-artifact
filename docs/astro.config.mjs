import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightRosePine from "starlight-theme-rose-pine";

export default defineConfig({
  site: "https://msyavuz.github.io",
  base: process.env.NODE_ENV === "production" ? "/live-artifact" : undefined,
  integrations: [
    starlight({
      plugins: [starlightRosePine()],
      title: "live-artifact",
      description:
        "Virtual filesystem + live Sandpack preview for LLM-generated React apps.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/msyavuz/live-artifact",
        },
      ],
      editLink: {
        baseUrl: "https://github.com/msyavuz/live-artifact/edit/main/docs/",
      },
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Introduction", slug: "introduction" },
            { label: "Install", slug: "install" },
            { label: "Quickstart", slug: "quickstart" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Backends", slug: "guides/backends" },
            { label: "Tool dispatch", slug: "guides/tool-dispatch" },
            { label: "Security", slug: "guides/security" },
          ],
        },
        {
          label: "API reference",
          items: [
            { label: "createArtifactStore", slug: "api/create-artifact-store" },
            { label: "useAppFiles", slug: "api/use-app-files" },
            { label: "<LiveApp />", slug: "api/live-app" },
            { label: "Dependency helpers", slug: "api/dependency-helpers" },
            { label: "Tool specs & system prompt", slug: "api/tools" },
          ],
        },
      ],
    }),
  ],
});
