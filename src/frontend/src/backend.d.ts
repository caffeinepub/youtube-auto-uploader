import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface UploadHistoryEntry {
    id: bigint;
    status: string;
    errorMessage: string;
    fileName: string;
    youtubeVideoId: string;
    uploadedAt: bigint;
    driveFileId: string;
}
export interface QueueItem {
    fileName: string;
    orderIndex: bigint;
    driveFileId: string;
}
export interface SchedulerState {
    lastUploadDate: string;
    lastUploadTime: bigint;
    isEnabled: boolean;
    uploadsToday: bigint;
}
export interface UserProfile {
    name: string;
}
export interface OAuthConfig {
    clientId: string;
    refreshToken: string;
    clientSecret: string;
    driveFolderId: string;
}
export interface ChannelConfig {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    driveFolderId: string;
    title: string;
    caption: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addToQueue(item: QueueItem): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    clearQueue(): Promise<void>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getOAuthConfig(): Promise<OAuthConfig | null>;
    getQueue(): Promise<Array<QueueItem>>;
    getSchedulerState(): Promise<SchedulerState>;
    getUploadHistory(): Promise<Array<UploadHistoryEntry>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    incrementUploadsToday(): Promise<void>;
    isCallerAdmin(): Promise<boolean>;
    recordUpload(entry: UploadHistoryEntry): Promise<bigint>;
    removeFromQueue(driveFileId: string): Promise<void>;
    reorderQueue(newOrder: Array<QueueItem>): Promise<void>;
    resetDailyCount(newDate: string): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    setOAuthConfig(config: OAuthConfig): Promise<void>;
    setSchedulerEnabled(isEnabled: boolean): Promise<void>;
    saveChannelConfig(channelId: string, config: ChannelConfig): Promise<void>;
    getChannelConfig(channelId: string): Promise<ChannelConfig | null>;
    getPendingTrigger(channelId: string): Promise<bigint | null>;
    clearPendingTrigger(channelId: string): Promise<void>;
}
