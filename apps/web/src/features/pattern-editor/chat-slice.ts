import type { StateCreator } from "zustand";
import type { AppStoreState } from "./app-store";

export type ChatSlice = {
  cancelChat: (() => void) | null;
  interruptChat: () => void;
};

export function initialChatState(): Pick<ChatSlice, "cancelChat"> {
  return { cancelChat: null };
}

export const createChatSlice: StateCreator<
  AppStoreState,
  [],
  [["zustand/subscribeWithSelector", never]],
  ChatSlice
> = (_set, get) => ({
  ...initialChatState(),
  interruptChat: () => get().cancelChat?.()
});
