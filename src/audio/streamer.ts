import { spawn, ChildProcess } from 'child_process';

export class AudioStreamer {
  private childProcess: ChildProcess | null = null;
  private onAudioChunk: (chunk: Buffer) => void;
  private isRunning = false;

  constructor(onAudioChunk: (chunk: Buffer) => void) {
    this.onAudioChunk = onAudioChunk;
  }

  start(): void {
    this.childProcess = spawn('ffmpeg', [
      '-f', 'alsa',
      '-i', 'default',
      '-ar', '16000',
      '-ac', '1',
      '-f', 's16le',
      '-acodec', 'pcm_s16le',
      '-'
    ], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    this.childProcess.stdout?.on('data', (data: Buffer) => {
      this.onAudioChunk(data);
    });

    this.childProcess.on('error', (err) => {
      console.error('FFmpeg error:', err.message);
    });

    this.isRunning = true;
  }

  stop(): void {
    this.isRunning = false;
    if (this.childProcess) {
      this.childProcess.kill('SIGTERM');
      this.childProcess = null;
    }
  }
}
