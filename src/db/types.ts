export interface ChatSummary {
  composerId: string;
  name: string;
  createdAt?: number;
  lastUpdatedAt?: number;
  unifiedMode?: string;
  workspaceId?: string;
  workspacePath?: string;
  workspaceLabel?: string;
}

export interface ChatMessage {
  bubbleId: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt?: number;
}

export interface ConversationHeader {
  bubbleId: string;
  type: number;
}

export interface ComposerData {
  composerId?: string;
  name?: string;
  createdAt?: number;
  lastUpdatedAt?: number;
  unifiedMode?: string;
  fullConversationHeadersOnly?: ConversationHeader[];
  conversationMap?: Record<string, BubblePayload>;
}

export interface BubblePayload {
  text?: string;
  type?: number;
  createdAt?: number;
  richText?: string | Record<string, unknown>;
  thinking?: string | { text?: string };
  allThinkingBlocks?: Array<{ text?: string; content?: string }>;
  toolFormerData?: {
    name?: string;
    rawArgs?: string;
    result?: string;
    status?: string;
  };
  capabilityType?: number;
}

export interface ComposerHeaderEntry {
  composerId: string;
  name?: string;
  subtitle?: string;
  createdAt?: number;
  lastUpdatedAt?: number;
  unifiedMode?: string;
  isArchived?: boolean;
  workspaceIdentifier?: {
    id?: string;
    uri?: {
      fsPath?: string;
      path?: string;
      external?: string;
      authority?: string;
      scheme?: string;
    };
  };
}

export interface WorkspaceComposerIndex {
  allComposers?: ComposerHeaderEntry[];
}

export interface GlobalComposerHeaders {
  allComposers?: ComposerHeaderEntry[];
  headers?: ComposerHeaderEntry[];
  composers?: ComposerHeaderEntry[];
}
