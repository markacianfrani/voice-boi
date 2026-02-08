 # Voice LLM POC

Terminal-based real-time voice conversation using Bun + TypeScript + pi SDKand voxtral/vllm

## Prerequisites

- [Bun](https://bun.sh) v1.0+
- [ffmpeg](https://ffmpeg.org/) for audio capture
- [vLLM realtime WebSocket server](https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602) running with the Voxtral-Mini-4B-Realtime-2602 model

### Install ffmpeg

**Arch:**
```bash
sudo pacman -S ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

### Setup vLLM Realtime Server


https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602

You need a vLLM server running with the Voxtral-Mini-4B-Realtime-2602 model:

You need the nightly vllm right now for the new /realtime api

```bash
uv pip install -U vllm \
    --torch-backend=auto \
    --extra-index-url https://wheels.vllm.ai/nightly # add variant subdirectory here if needed
```

verify:
```bash
python -c "import mistral_common; print(mistral_common.__version__)"

```
install more deps:

```bash
uv pip install soxr librosa soundfile
````


serve voxtral: 
```bash
VLLM_DISABLE_COMPILE_CACHE=1 vllm serve mistralai/Voxtral-Mini-4B-Realtime-2602 --compilation_config '{"cudagraph_mode": "PIECEWISE"}'
```

## Setup

```bash
cd voice-llm-poc
bun install

# Edit .env with your MiniMax API key and STT server URL
nano .env
```

 ## Environment Variables

See [ENV.md](ENV.md) for complete configuration options.

Quick setup:
 ```bash
 cp .env.example .env
 nano .env
 ```

## Run

```bash
bun start
```

 Speak into your microphone. After a brief pause, your speech will be transcribed and sent to the LLM. Streaming response will appear in the terminal.

Customize the assistant's behavior by editing `.pi/SYSTEM.md`.

## Features

 - **Continuous audio streaming** - Microphone audio captured via ffmpeg (16kHz, mono)
 - **Streaming STT** - WebSocket client to vLLM realtime server with Voxtral-Mini-4B-Realtime-2602 model
 - **Interrupt detection** - Speaking during LLM response interrupts the response
 - **Pause detection** - Smart pause detection (3s timeout or 30 empty deltas)
 - **LLM streaming** - Uses pi SDK with MiniMax for real-time responses
 - **Conversation state** - Maintains message history across turns for context-aware responses
 - **Multi-provider support** - Easy switching between 15+ LLM providers via pi SDK
 - **Customizable system prompt** - Edit `.pi/SYSTEM.md` to customize assistant behavior

## Architecture

```
 [Microphone] → [ffmpeg] → [STT Client] → [vLLM Realtime Server]
                                               ↓
                                          [Streaming Transcription]
                                               ↓
                                       [LLM Client (pi SDK)]
                                               ↓
                                          [Terminal Output]
                                     (with full conversation history)
```

### Components

 - **AudioStreamer** (`src/audio/streamer.ts`) - Captures microphone audio via ffmpeg, streams raw PCM data
 - **STTClient** (`src/stt/client.ts`) - WebSocket client for vLLM realtime API, handles audio buffer management and transcription streaming
 - **LLMClient** (`src/llm/client.ts`) - pi SDK integration with MiniMax, supports interruption and streaming
 - **UI** (`src/ui/display.ts`) - Terminal output formatting

 ## Dependencies

 - `@mariozechner/pi-coding-agent` - pi SDK for streaming LLM responses with multi-provider support
 - `ws` - WebSocket client for vLLM realtime server
 - `dotenv` - Environment variable loading

## Troubleshooting

**Microphone not working**
- Ensure ffmpeg is installed: `which ffmpeg`
- Check microphone is connected and permissions granted
- On Linux, add user to `audio` group: `sudo usermod -a -G audio $USER`

**STT connection fails**
- Verify vLLM server is running: `curl http://192.168.0.11:8000/health`
- Check network connectivity: `ping 192.168.0.11`
- Ensure firewall allows port 8000
- Check vLLM server logs for WebSocket errors

**Transcription not appearing**
- Verify the model is loaded in vLLM: `mistralai/Voxtral-Mini-4B-Realtime-2602`
- Check that audio is being sent to the server (enable debug logging)
- Ensure the vLLM server is running with the realtime API enabled

**Interrupt not working**
- Check that the STT client is detecting new speech during LLM response
- Verify the speech callback is being triggered

**LLM not responding**
- Check MINIMAX_API_KEY is set in `.env`
- Verify API key is valid and has credits
- Check network connectivity to MiniMax API

**STT pause detection issues**
- Adjust `EMPTY_DELTA_THRESHOLD` (default: 30) in `src/stt/client.ts`
- Adjust `PAUSE_TIMEOUT_MS` (default: 3000) in `src/stt/client.ts`
