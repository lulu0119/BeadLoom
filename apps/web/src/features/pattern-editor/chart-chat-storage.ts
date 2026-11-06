import { browserStorage, createLocalStorageAdapter } from "@beadloom/assistant-xsai/react";

export const chartChatPrefix = (patternId: string): string => `beadloom.chatSessions:${patternId}:`;

export async function deleteChartChats(patternId: string): Promise<void> {
  const prefix = chartChatPrefix(patternId);
  const adapter = createLocalStorageAdapter({
    storage: browserStorage,
    prefix
  });
  const { threads } = await adapter.list();
  await Promise.all(threads.map((thread) => adapter.delete(thread.remoteId)));
  await browserStorage.removeItem(prefix + "active");
}
