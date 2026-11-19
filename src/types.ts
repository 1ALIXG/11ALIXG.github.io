export interface DrivePermission {
  id: string;
  type: 'user' | 'group' | 'domain' | 'anyone';
  role: 'owner' | 'organizer' | 'fileOrganizer' | 'writer' | 'commenter' | 'reader';
  emailAddress?: string;
  displayName?: string;
}

export interface DriveOwner {
  displayName?: string;
  emailAddress?: string;
  photoLink?: string;
}

export interface DriveFileRaw {
  id: string;
  name: string;
  mimeType: string;
  description?: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  shared?: boolean;
  owners?: DriveOwner[];
  permissions?: DrivePermission[];
  videoMediaMetadata?: {
    width?: number;
    height?: number;
    durationMillis?: string;
  };
}

export interface SubtitleFile {
  id: string;
  name: string;
  baseName: string;
  languageLabel: string;
}

export interface Episode {
  id: string;
  rawName: string;
  title: string;
  episodeNumber: number;
  seasonIndex: number;
  seasonName: string;
  description: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
  width?: number;
  height?: number;
  qualityLabel: string;
  modifiedTime?: string;
  thumbnailUrl?: string;
  webViewLink?: string;
  subtitles: SubtitleFile[];
}

export interface Season {
  id: string;
  name: string;
  index: number;
  episodes: Episode[];
}

export interface CoverOption {
  id: string;
  name: string;
  url: string;
}

export interface SeriesData {
  id: string;
  name: string;
  description: string;
  shared: boolean;
  isPublicLink: boolean;
  permissionsCount: number;
  ownerName: string;
  webViewLink: string;
  modifiedTime?: string;
  coverImageId?: string;
  coverImageUrl?: string;
  coverOptions?: CoverOption[];
  seasons: Season[];
  totalEpisodes: number;
  totalDurationMs: number;
  highestQuality: string;
  isPublicSource?: boolean;
}

export interface SeriesCustomization {
  title?: string;
  description?: string;
  genre?: string;
  year?: string;
  coverUrl?: string;
}

export interface DriveFolderItem {
  id: string;
  name: string;
  modifiedTime?: string;
  shared?: boolean;
  owners?: DriveOwner[];
  description?: string;
}

export interface WatchProgressEntry {
  episodeId: string;
  seriesId: string;
  watched: boolean;
  currentTimeSec: number;
  durationSec: number;
  updatedAt: number;
}

export interface RecentSeriesEntry {
  id: string;
  name: string;
  totalEpisodes: number;
  seasonsCount: number;
  lastOpenedAt: number;
}
