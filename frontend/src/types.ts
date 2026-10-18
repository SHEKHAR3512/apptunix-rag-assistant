export type Source = {
  id: string;
  title: string;
  source_url: string;
  last_checked: string;
  passage: string;
  path: string;
  chunks?: number;
  review_status?: string;
};
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  error?: string;
  stopped?: boolean;
};
export type Conversation = {
  id: string;
  title: string;
  updated: number;
  messages: Message[];
};
export type Health = {
  backend: string;
  ollama: string;
  chat_model: string;
  embedding_model: string;
  models: string[];
  index_ready: boolean;
  chunks: number;
  documents: number;
  error: string | null;
};
export type Preferences = {
  theme: "light" | "dark";
  reducedMotion: boolean;
  model: string;
  topK: number;
  strict: boolean;
};
export type StreamEvent = {
  type: "status" | "token" | "replace" | "sources" | "done" | "error";
  text?: string;
  message?: string;
  stage?: string;
  sources?: Source[];
};
export type IndexStatus = {
  state: string;
  completed: number;
  total: number;
  chunks: number;
  skipped: number;
  current: string;
  errors: { file: string; error: string }[];
};
