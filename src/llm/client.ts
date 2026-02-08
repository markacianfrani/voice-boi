import { createAgentSession, AuthStorage, ModelRegistry, SessionManager, SettingsManager, type AgentSession, type AgentSessionEvent } from '@mariozechner/pi-coding-agent';

export class LLMClient {
  private session: AgentSession | null = null;
  private unsubscribe: (() => void) | null = null;
  private currentResponse = '';
  private isResponding = false;
  private abortController: AbortController | null = null;

  constructor(apiKey: string | undefined) {
    this.initialize(apiKey);
  }

  private async initialize(apiKey: string | undefined): Promise<void> {
    const authStorage = new AuthStorage();
    const modelRegistry = new ModelRegistry(authStorage);

    if (apiKey) {
      authStorage.setRuntimeApiKey('minimax', apiKey);
    }

    const settingsManager = SettingsManager.inMemory({
      compaction: { enabled: false },
      retry: { enabled: false },
    });

    const { session } = await createAgentSession({
      authStorage,
      modelRegistry,
      sessionManager: SessionManager.inMemory(),
      settingsManager,
    });

    this.session = session;
  }

  async streamResponse(messages: any[], onChunk: (chunk: string) => void): Promise<string> {
    if (!this.session) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!this.session) {
        onChunk('[Session not initialized]');
        return '';
      }
    }

    this.isResponding = true;
    this.currentResponse = '';

    if (this.unsubscribe) {
      this.unsubscribe();
    }

    this.unsubscribe = this.session.subscribe((event: AgentSessionEvent) => {
      if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
        this.currentResponse += event.assistantMessageEvent.delta;
        onChunk(event.assistantMessageEvent.delta);
      }
    });

    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const prompt = lastUserMessage?.content?.[0]?.text || '';

    try {
      await this.session!.prompt(prompt);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('LLM Error:', err);
        onChunk('[Error getting response]');
      }
    } finally {
      this.isResponding = false;
    }

    return this.currentResponse;
  }

  abort(): string {
    if (this.session) {
      this.session.abort();
    }
    this.isResponding = false;
    return this.currentResponse;
  }

  getIsResponding(): boolean {
    return this.isResponding;
  }

  getCurrentResponse(): string {
    return this.currentResponse;
  }
}
