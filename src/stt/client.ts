import WebSocket from 'ws';

type TranscriptionCallback = (text: string, isComplete: boolean) => void;
type PauseCallback = () => void;
type SpeechCallback = () => void;

export class STTClient {
  private url: string;
  private ws: WebSocket | null = null;
  private currentTranscription = '';
  private sessionCreated = false;
  private transcriptionCallback: TranscriptionCallback | null = null;
  private pauseCallback: PauseCallback | null = null;
  private speechCallback: SpeechCallback | null = null;
  private emptyDeltaCount = 0;
  private readonly EMPTY_DELTA_THRESHOLD = 30;
  private readonly PAUSE_TIMEOUT_MS = 3000;
  private pauseTimer: NodeJS.Timeout | null = null;
  private isCommitting = false;
  private wasEmptyBefore = true;

  constructor(url: string) {
    this.url = url;
  }

  onSpeech(callback: SpeechCallback): void {
    this.speechCallback = callback;
  }

  onPause(callback: PauseCallback): void {
    this.pauseCallback = callback;
  }

  onTranscription(callback: TranscriptionCallback): void {
    this.transcriptionCallback = callback;
  }

  connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      console.log('📡 STT connected');
    });

    this.ws.on('message', (data: Buffer) => {
      this.handleMessage(data);
    });

    this.ws.on('error', (err) => {
      console.error('STT WebSocket error:', err.message);
    });

    this.ws.on('close', () => {
      console.log('📡 STT disconnected');
      this.sessionCreated = false;
    });
  }

  private handleMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'session.created') {
        this.sessionCreated = true;
        this.sendSessionUpdate();
        this.commitAudioBuffer();
      } else if (message.type === 'transcription.delta') {
        const delta = message.delta || '';
        if (delta.length > 0) {
          if (this.wasEmptyBefore && this.speechCallback) {
            this.speechCallback();
          }
          this.wasEmptyBefore = false;
          this.currentTranscription += delta;
          this.emptyDeltaCount = 0;
          this.resetPauseTimer();
        } else {
          this.wasEmptyBefore = true;
          this.emptyDeltaCount++;
          if (this.emptyDeltaCount >= this.EMPTY_DELTA_THRESHOLD && this.currentTranscription.trim().length > 0) {
            this.commitWithPause();
          }
        }
      } else if (message.type === 'transcription.done') {
        this.currentTranscription = message.text || this.currentTranscription;
        if (this.transcriptionCallback) {
          this.transcriptionCallback(this.currentTranscription, true);
        }
        this.isCommitting = false;
      } else if (message.type === 'error') {
        if (message.error?.message) {
          console.error('STT error:', message.error.message);
        }
      }
    } catch (err) {
      console.error('Failed to parse STT message:', err);
    }
  }

  private resetPauseTimer(): void {
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
    }
    this.pauseTimer = setTimeout(() => {
      if (this.currentTranscription.trim().length > 0 && !this.isCommitting) {
        this.commitWithPause();
      }
    }, this.PAUSE_TIMEOUT_MS);
  }

  private commitWithPause(): void {
    if (this.isCommitting || this.currentTranscription.trim().length === 0) return;
    this.isCommitting = true;
    this.emptyDeltaCount = 0;

    if (this.pauseCallback) {
      this.pauseCallback();
    }
    this.commitAudioBuffer();
  }

  restartListening(): void {
    this.isCommitting = false;
    this.commitAudioBuffer();
  }

  private sendSessionUpdate(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'session.update',
      model: 'mistralai/Voxtral-Mini-4B-Realtime-2602'
    }));
  }

  sendAudioChunk(audioBuffer: Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const base64Audio = audioBuffer.toString('base64');

    this.ws.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: base64Audio
    }));
  }

  commitAudioBuffer(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'input_audio_buffer.commit'
    }));
  }

  getCurrentTranscription(): string {
    return this.currentTranscription;
  }

  resetTranscription(): void {
    this.currentTranscription = '';
  }

  clearTranscription(): void {
    this.currentTranscription = '';

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'input_audio_buffer.clear'
      }));
    }
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
