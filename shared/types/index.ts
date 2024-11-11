// shared/types/index.ts

export interface HistoData {
  histoEp: string[];
  histoImg: string[];
  histoLang: string[];
  histoNom: string[];
  histoType: string[];
  histoUrl: string[];
}

export interface SavedProgress {
  [key: string]: string | number;  // savedEpName/... ou savedEpNb/...
}

export interface AnimeProgress {
  histo: HistoData;
  saved: SavedProgress;
  lastUpdate?: number;
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