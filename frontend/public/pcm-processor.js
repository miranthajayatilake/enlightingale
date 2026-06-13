/**
 * AudioWorklet processor: captures mic input, downsamples to 16 kHz PCM Int16,
 * and posts ArrayBuffer chunks back to the main thread.
 *
 * Runs in the AudioWorklet thread — no ES module imports allowed.
 * sampleRate is a global available in the AudioWorklet scope.
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    // Accumulate ~100 ms worth of 16 kHz samples before posting (1600 samples)
    this._buf = []
    this._targetLen = 1600
    // Ratio: browser sample rate → 16 kHz (rounded to nearest integer)
    this._ratio = Math.round(sampleRate / 16000)
  }

  process(inputs) {
    const channel = inputs[0]?.[0]
    if (!channel) return true

    // Decimate by ratio
    for (let i = 0; i < channel.length; i += this._ratio) {
      const s = channel[i]
      // Clamp Float32 → Int16
      this._buf.push(Math.max(-32768, Math.min(32767, Math.round(s * 32767))))
    }

    // Flush when we have a full chunk
    if (this._buf.length >= this._targetLen) {
      const chunk = this._buf.splice(0, this._targetLen)
      const pcm16 = new Int16Array(chunk)
      // Transfer ownership so no copy is needed
      this.port.postMessage(pcm16.buffer, [pcm16.buffer])
    }

    return true
  }
}

registerProcessor('pcm-processor', PCMProcessor)
