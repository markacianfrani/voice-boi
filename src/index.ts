import 'dotenv/config';
import { AudioStreamer } from './audio/streamer';
import { STTClient } from './stt/client';
import { LLMClient } from './llm/client';
import { UI } from './ui/display';

const STT_WS_URL = process.env.STT_WS_URL || 'ws://192.168.0.11:8000/v1/realtime';
const LLM_API_KEY = process.env.MINIMAX_API_KEY;

class VoiceLLMPOC {
  private streamer: AudioStreamer;
  private stt: STTClient;
  private llm: LLMClient;
  private ui: UI;

  constructor() {
    this.ui = new UI();
    this.stt = new STTClient(STT_WS_URL);
    this.llm = new LLMClient(LLM_API_KEY);
    this.streamer = new AudioStreamer((chunk) => {
      this.stt.sendAudioChunk(chunk);
    });
  }

  async start(): Promise<void> {
    this.ui.print('🎤 Voice LLM Ready | Press Ctrl+C to exit\n');

    this.stt.connect();
    this.streamer.start();

    this.stt.onSpeech(() => {
      if (this.llm.getIsResponding()) {
        const partialResponse = this.llm.abort();
        if (partialResponse.trim().length > 0) {
          this.ui.print(' [interrupted]\n');
        }
        this.ui.print(`\n── YOU ──\n(speaking...)\n`);
      }
    });

    this.stt.onPause(() => {
      const text = this.stt.getCurrentTranscription();
      if (text.trim().length === 0) return;

      this.ui.print(`\n── YOU ──\n${text}\n`);
      this.ui.print('── LLM ──\n');

      this.llm.streamResponse([{ role: 'user', content: [{ type: 'text', text }] }], (chunk: string) => {
        this.ui.write(chunk);
      }).then((response) => {
        if (response) {
          this.ui.print('\n');
        }
        this.stt.restartListening();
      });

      this.stt.clearTranscription();
    });

    this.setupCleanup();
  }

  private setupCleanup(): void {
    process.on('SIGINT', () => {
      this.ui.print('\n👋 Bye!');
      this.streamer.stop();
      this.stt.close();
      process.exit(0);
    });
  }
}

new VoiceLLMPOC().start();
