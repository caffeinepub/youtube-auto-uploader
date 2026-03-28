export interface Channel {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  driveFolderId: string;
  caption: string;
  title: string;
  createdAt: number;
}

export interface QueueItemLocal {
  driveFileId: string;
  fileName: string;
  orderIndex: number;
}

export interface ChannelQueue {
  items: QueueItemLocal[];
}

export interface HistoryEntry {
  id: number;
  driveFileId: string;
  fileName: string;
  youtubeVideoId: string;
  uploadedAt: number;
  status: string;
  errorMessage: string;
}

export interface ChannelHistory {
  entries: HistoryEntry[];
  nextId: number;
}

export interface ChannelScheduler {
  isEnabled: boolean;
  uploadsToday: number;
  lastUploadDate: string;
  lastUploadTime: number;
}

const CHANNELS_KEY = "yt_channels";
const ACTIVE_KEY = "yt_active_channel";

export function getChannels(): Channel[] {
  try {
    return JSON.parse(localStorage.getItem(CHANNELS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveChannels(channels: Channel[]): void {
  localStorage.setItem(CHANNELS_KEY, JSON.stringify(channels));
}

export function getChannel(id: string): Channel | null {
  return getChannels().find((c) => c.id === id) ?? null;
}

export function createChannel(name: string): Channel {
  const channel: Channel = {
    id: `ch_${Date.now()}`,
    name,
    clientId: "",
    clientSecret: "",
    refreshToken: "",
    driveFolderId: "",
    caption: "",
    title: "",
    createdAt: Date.now(),
  };
  const channels = getChannels();
  channels.push(channel);
  saveChannels(channels);
  return channel;
}

export function updateChannel(id: string, updates: Partial<Channel>): void {
  const channels = getChannels().map((c) =>
    c.id === id ? { ...c, ...updates } : c,
  );
  saveChannels(channels);
}

export function deleteChannel(id: string): void {
  saveChannels(getChannels().filter((c) => c.id !== id));
  localStorage.removeItem(`yt_queue_${id}`);
  localStorage.removeItem(`yt_history_${id}`);
  localStorage.removeItem(`yt_scheduler_${id}`);
}

export function getActiveChannelId(): string {
  return localStorage.getItem(ACTIVE_KEY) || "";
}

export function setActiveChannelId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

// Queue helpers
export function getQueue(channelId: string): ChannelQueue {
  try {
    return JSON.parse(
      localStorage.getItem(`yt_queue_${channelId}`) || '{"items":[]}',
    );
  } catch {
    return { items: [] };
  }
}

export function saveQueue(channelId: string, queue: ChannelQueue): void {
  localStorage.setItem(`yt_queue_${channelId}`, JSON.stringify(queue));
}

export function addToQueue(channelId: string, item: QueueItemLocal): void {
  const q = getQueue(channelId);
  if (!q.items.find((i) => i.driveFileId === item.driveFileId)) {
    q.items.push(item);
    saveQueue(channelId, q);
  }
}

export function removeFromQueue(channelId: string, driveFileId: string): void {
  const q = getQueue(channelId);
  q.items = q.items.filter((i) => i.driveFileId !== driveFileId);
  saveQueue(channelId, q);
}

export function clearQueue(channelId: string): void {
  saveQueue(channelId, { items: [] });
}

// History helpers
export function getHistory(channelId: string): ChannelHistory {
  try {
    return JSON.parse(
      localStorage.getItem(`yt_history_${channelId}`) ||
        '{"entries":[],"nextId":1}',
    );
  } catch {
    return { entries: [], nextId: 1 };
  }
}

export function saveHistory(channelId: string, history: ChannelHistory): void {
  localStorage.setItem(`yt_history_${channelId}`, JSON.stringify(history));
}

export function addHistoryEntry(
  channelId: string,
  entry: Omit<HistoryEntry, "id">,
): void {
  const h = getHistory(channelId);
  h.entries.push({ ...entry, id: h.nextId });
  h.nextId += 1;
  saveHistory(channelId, h);
}

// Scheduler helpers
export function getScheduler(channelId: string): ChannelScheduler {
  try {
    return JSON.parse(
      localStorage.getItem(`yt_scheduler_${channelId}`) ||
        '{"isEnabled":true,"uploadsToday":0,"lastUploadDate":"","lastUploadTime":0}',
    );
  } catch {
    return {
      isEnabled: true,
      uploadsToday: 0,
      lastUploadDate: "",
      lastUploadTime: 0,
    };
  }
}

export function saveScheduler(
  channelId: string,
  scheduler: ChannelScheduler,
): void {
  localStorage.setItem(`yt_scheduler_${channelId}`, JSON.stringify(scheduler));
}

export function ensureDefaultChannel(): string {
  let channels = getChannels();
  if (channels.length === 0) {
    const ch = createChannel("Channel 1");
    channels = [ch];
  }
  let activeId = getActiveChannelId();
  if (!activeId || !channels.find((c) => c.id === activeId)) {
    activeId = channels[0].id;
    setActiveChannelId(activeId);
  }
  return activeId;
}
