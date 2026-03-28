const CAPTION_KEY = "yt_uploader_caption";
const TITLE_KEY = "yt_uploader_title";
const CHANNELS_KEY = "yt_uploader_channels";
const ACTIVE_CHANNEL_KEY = "yt_uploader_active_channel";

export interface ChannelConfig {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  driveFolderId: string;
}

export const getCaption = () => localStorage.getItem(CAPTION_KEY) || "";
export const setCaption = (v: string) => localStorage.setItem(CAPTION_KEY, v);
export const getTitle = () => localStorage.getItem(TITLE_KEY) || "";
export const setTitle = (v: string) => localStorage.setItem(TITLE_KEY, v);
export const getChannels = (): ChannelConfig[] => {
  try {
    return JSON.parse(localStorage.getItem(CHANNELS_KEY) || "[]");
  } catch {
    return [];
  }
};
export const saveChannels = (channels: ChannelConfig[]) =>
  localStorage.setItem(CHANNELS_KEY, JSON.stringify(channels));
export const getActiveChannelId = () =>
  localStorage.getItem(ACTIVE_CHANNEL_KEY) || "";
export const setActiveChannelId = (id: string) =>
  localStorage.setItem(ACTIVE_CHANNEL_KEY, id);
