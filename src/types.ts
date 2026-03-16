export interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  timestamp: number;
  emotion?: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
