export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  error?: string;
}

// Represents a single anime entry in history
export interface AnimeEntry {
  url: string;      // Primary identifier
  episode: string;  // Current episode
  image: string;    // Image URL
  language: string; // Language version (VO/VF)
  name: string;     // Anime name
  type: string;     // Season info
  lastWatched: number;
}

// Main history data structure
export interface HistoData {
  entries: AnimeEntry[];
}

// Represents a saved episode
export interface SavedEpisode {
  name: string;   // Episode name
  number: number; // Episode number
}

// Saved progress with strongly typed structure
export interface SavedProgress {
  [animeUrl: string]: SavedEpisode;
}

export interface AnimeProgress {
  histo: HistoData;
  saved: SavedProgress;
  lastUpdate: number;
}

export interface SyncState {
  lastSync: Date | null;
  syncing: boolean;
  error: string | null;
}

export interface UserAuth {
  uid: string;
  email?: string;
  email_verified?: boolean;
}

export type SyncMessageType =
  | 'SYNC_REQUEST'
  | 'LOGIN_REQUEST'
  | 'LOGOUT_REQUEST'
  | 'SYNC_STATE_CHANGED'
  | 'GET_USER';

export interface SyncMessage {
  type: SyncMessageType;
  data?: any;
}

export interface ApiResponse {
  success: boolean;
  error?: string;
  data?: any;
}

export interface GooglePayload {
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  sub: string;
}