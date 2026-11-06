"use client";

import { useMemo } from "react";
import {
  useLocalRuntime,
  useRemoteThreadListRuntime,
  type ChatModelAdapter,
  type LocalRuntimeOptions
} from "@assistant-ui/react";
import {
  createLocalStorageAdapter,
  createSimpleTitleAdapter,
  type AsyncStorageLike
} from "@assistant-ui/core/react";

export { createLocalStorageAdapter, type AsyncStorageLike } from "@assistant-ui/core/react";

export const browserStorage: AsyncStorageLike = {
  getItem: async (key) => (typeof window === "undefined" ? null : window.localStorage.getItem(key)),
  setItem: async (key, value) => {
    window.localStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    window.localStorage.removeItem(key);
  }
};

export function useXsaiRuntime(
  model: ChatModelAdapter,
  options: LocalRuntimeOptions & {
    prefix: string;
    storage?: AsyncStorageLike;
    threadId?: string;
    onThreadIdChange?: (id: string | undefined) => void;
  }
) {
  const { prefix, storage = browserStorage, threadId, onThreadIdChange, ...local } = options;
  const adapter = useMemo(
    () => createLocalStorageAdapter({ storage, prefix, titleGenerator: createSimpleTitleAdapter() }),
    [storage, prefix]
  );
  return useRemoteThreadListRuntime({
    adapter,
    threadId,
    onThreadIdChange,
    runtimeHook: () => useLocalRuntime(model, local)
  });
}
