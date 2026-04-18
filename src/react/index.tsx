import { Sandpack, type SandpackProps } from "@codesandbox/sandpack-react";
import { useEffect, useState } from "react";
import type { ArtifactStore, FilesMap } from "../store";

export function useAppFiles(
  store: ArtifactStore,
  appId: string | null,
): FilesMap {
  const [files, setFiles] = useState<FilesMap>({});

  useEffect(() => {
    setFiles({});
    if (!appId) return;

    let cancelled = false;
    store.getFiles(appId).then((initial) => {
      if (!cancelled) setFiles(initial);
    });

    const unsubscribe = store.subscribe((event) => {
      if (event.type !== "file_written" || event.appId !== appId) return;
      setFiles((prev) => ({ ...prev, [`/${event.path}`]: event.content }));
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [store, appId]);

  return files;
}

export interface LiveAppProps {
  files: FilesMap;
  template?: SandpackProps["template"];
  theme?: SandpackProps["theme"];
  height?: number;
  options?: SandpackProps["options"];
}

export function LiveApp({
  files,
  template = "react-ts",
  theme = "dark",
  height = 360,
  options,
}: LiveAppProps) {
  return (
    <Sandpack
      template={template}
      theme={theme}
      files={files}
      options={{
        showNavigator: false,
        showTabs: false,
        showLineNumbers: false,
        editorHeight: height,
        editorWidthPercentage: 0,
        ...options,
      }}
    />
  );
}
