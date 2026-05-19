import type {
  ChatDetailResponse,
  ChatsPayload,
  CursorSnapshot,
  SendResponse,
  StoreStatus,
} from './types';

export interface CrApi {
  snapshot(composerId?: string): Promise<CursorSnapshot>;
  chat(composerId: string, fresh?: boolean): Promise<ChatDetailResponse>;
  send(text: string, composerId?: string, windowTitle?: string): Promise<SendResponse>;
  refreshDb(): Promise<StoreStatus>;
  listChats(): Promise<ChatsPayload>;
  status(): Promise<StoreStatus>;
}
