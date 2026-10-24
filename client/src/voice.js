// Voice calls between browsers (WebRTC). The server only passes connection messages along;
// the sound goes straight from browser to browser. Everyone in a call connects to everyone else,
// which works well for small groups.

// How loud (0–1) someone must be to count as talking, and how long the ring stays after they stop.
const SPEAKING_LEVEL = 0.02;
const SPEAKING_HOLD_MS = 350;

// No STUN/TURN servers: those belong to outside companies. Calls work on the same network.
const RTC_CONFIG = { iceServers: [] };

export class CallClient {
  constructor(socket, request, onChange) {
    this.socket = socket;
    this.request = request;
    this.onChange = onChange;
    this.groupId = null;
    this.joined = false;
    this.local = null;
    this.peers = new Map(); // socketId -> { pc, audio, queue, pending }
    this.meters = new Map(); // socketId -> { analyser, data, loudAt }
    this.speaking = new Set();
    this.muted = false;
    this.deafened = false;
    this.mutedBeforeDeafen = false;
    this.micError = null;
    this.audioContext = null;
    this.timer = null;

    socket.on('call:signal', ({ from, data }) => this.#onSignal(from, data));
    socket.on('call:moved', () => this.#cleanup()); // you joined the call from another tab
    socket.on('disconnect', () => this.#cleanup());
  }

  snapshot() {
    return {
      groupId: this.groupId,
      muted: this.muted,
      deafened: this.deafened,
      speaking: [...this.speaking],
      micError: this.micError,
    };
  }

  async join(groupId) {
    if (this.groupId === groupId) return;
    if (this.groupId) this.leave();

    this.groupId = groupId;
    this.micError = null;
    this.muted = false;
    this.deafened = false;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('insecure');
      this.local = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      // You can still listen, just not talk.
      this.local = null;
      this.muted = true;
      this.micError = window.isSecureContext
        ? 'No microphone access, so you joined muted. Allow the microphone in your browser to talk.'
        : 'Microphones only work on https or localhost, so you joined muted.';
    }
    if (this.groupId !== groupId) return this.#stopLocal(); // left again while waiting for the mic

    this.audioContext ??= new AudioContext();
    this.audioContext.resume().catch(() => {});
    if (this.local) this.#meter(this.socket.id, this.local);
    this.#startMeters();
    this.#emit();

    try {
      const { peers } = await this.request('call:join', { groupId, muted: this.muted });
      this.joined = true;
      for (const socketId of peers) this.#run(socketId, () => this.#offer(socketId));
    } catch (err) {
      this.#cleanup();
      throw err;
    }
  }

  leave() {
    if (!this.groupId) return;
    this.socket.emit('call:leave');
    this.#cleanup();
  }

  setMuted(muted) {
    if (!this.groupId || (!this.local && !muted)) return;
    this.muted = muted;
    if (!muted) this.deafened = false;
    this.#applyAudio();
  }

  // Deafened: you hear nothing, and you're muted too (like Discord).
  setDeafened(deafened) {
    if (!this.groupId) return;
    if (deafened) this.mutedBeforeDeafen = this.muted;
    this.deafened = deafened;
    this.muted = deafened ? true : this.mutedBeforeDeafen || !this.local;
    this.#applyAudio();
  }

  // Closes connections to people who have left the call.
  sync(call) {
    if (call.groupId !== this.groupId || !this.joined) return;
    const present = new Set(call.participants.map((p) => p.socketId));
    if (!present.has(this.socket.id)) return this.#cleanup();
    for (const socketId of this.peers.keys()) if (!present.has(socketId)) this.#closePeer(socketId);
  }

  destroy() {
    this.#cleanup();
    this.audioContext?.close().catch(() => {});
  }

  #emit() {
    this.onChange(this.snapshot());
  }

  #applyAudio() {
    for (const track of this.local?.getAudioTracks() ?? []) track.enabled = !this.muted;
    for (const peer of this.peers.values()) if (peer.audio) peer.audio.muted = this.deafened;
    this.socket.emit('call:update', { muted: this.muted, deafened: this.deafened });
    this.#emit();
  }

  #peer(socketId) {
    let peer = this.peers.get(socketId);
    if (peer) return peer;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peer = { pc, audio: null, queue: Promise.resolve(), pending: [] };
    this.peers.set(socketId, peer);

    if (this.local) for (const track of this.local.getTracks()) pc.addTrack(track, this.local);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.socket.emit('call:signal', { to: socketId, data: { candidate: candidate.toJSON() } });
    };
    pc.ontrack = ({ streams: [stream] }) => {
      if (!stream || peer.audio) return;
      const audio = new Audio();
      audio.autoplay = true;
      audio.srcObject = stream;
      audio.muted = this.deafened;
      audio.play().catch(() => {});
      peer.audio = audio;
      this.#meter(socketId, stream);
    };
    return peer;
  }

  // Messages from one person are handled one at a time, in order.
  #run(socketId, task) {
    const peer = this.#peer(socketId);
    peer.queue = peer.queue.then(task).catch((err) => console.warn('Call connection problem:', err));
  }

  async #offer(socketId) {
    const { pc } = this.#peer(socketId);
    if (!this.local) pc.addTransceiver('audio', { direction: 'recvonly' });
    await pc.setLocalDescription(await pc.createOffer());
    this.#sendDescription(socketId, pc);
  }

  #sendDescription(socketId, pc) {
    const { type, sdp } = pc.localDescription;
    this.socket.emit('call:signal', { to: socketId, data: { description: { type, sdp } } });
  }

  #onSignal(from, { description, candidate } = {}) {
    if (!this.groupId) return;
    this.#run(from, async () => {
      const peer = this.#peer(from);
      if (description) {
        await peer.pc.setRemoteDescription(description);
        for (const waiting of peer.pending.splice(0)) await peer.pc.addIceCandidate(waiting);
        if (description.type === 'offer') {
          await peer.pc.setLocalDescription(await peer.pc.createAnswer());
          this.#sendDescription(from, peer.pc);
        }
      } else if (candidate) {
        if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(candidate);
        else peer.pending.push(candidate);
      }
    });
  }

  #meter(id, stream) {
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 512;
    this.audioContext.createMediaStreamSource(stream).connect(analyser);
    this.meters.set(id, { analyser, data: new Float32Array(analyser.fftSize), loudAt: 0 });
  }

  // Checks everyone's volume a few times a second to light up who is talking.
  #startMeters() {
    this.timer ??= setInterval(() => {
      const now = performance.now();
      const speaking = new Set();
      for (const [id, meter] of this.meters) {
        if (id === this.socket.id && this.muted) continue;
        meter.analyser.getFloatTimeDomainData(meter.data);
        let sum = 0;
        for (const value of meter.data) sum += value * value;
        if (Math.sqrt(sum / meter.data.length) > SPEAKING_LEVEL) meter.loudAt = now;
        if (now - meter.loudAt < SPEAKING_HOLD_MS) speaking.add(id);
      }
      const changed = speaking.size !== this.speaking.size || [...speaking].some((id) => !this.speaking.has(id));
      if (changed) {
        this.speaking = speaking;
        this.#emit();
      }
    }, 100);
  }

  #closePeer(socketId) {
    const peer = this.peers.get(socketId);
    if (!peer) return;
    peer.pc.close();
    if (peer.audio) peer.audio.srcObject = null;
    this.peers.delete(socketId);
    this.meters.delete(socketId);
  }

  #stopLocal() {
    for (const track of this.local?.getTracks() ?? []) track.stop();
    this.local = null;
  }

  #cleanup() {
    if (!this.groupId && !this.local) return;
    for (const socketId of [...this.peers.keys()]) this.#closePeer(socketId);
    this.#stopLocal();
    this.meters.clear();
    clearInterval(this.timer);
    this.timer = null;
    this.speaking = new Set();
    this.groupId = null;
    this.joined = false;
    this.muted = false;
    this.deafened = false;
    this.#emit();
  }
}
