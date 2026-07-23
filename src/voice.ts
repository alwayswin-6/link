/** In-app Discord-style voice rooms over WebRTC (signaling via chat WebSocket). */

export type VoicePeer = {
  id: string;
  username: string;
  muted: boolean;
  deafened: boolean;
};

export type VoiceSignalPayload =
  | { kind: 'offer'; sdp: RTCSessionDescriptionInit }
  | { kind: 'answer'; sdp: RTCSessionDescriptionInit }
  | { kind: 'ice'; candidate: RTCIceCandidateInit | null };

type SendFn = (obj: Record<string, unknown>) => void;

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export class VoiceRoom {
  roomId: string | null = null;
  muted = false;
  deafened = false;
  peers = new Map<string, VoicePeer>();
  private localStream: MediaStream | null = null;
  private pcs = new Map<string, RTCPeerConnection>();
  private remoteAudio = new Map<string, HTMLAudioElement>();
  private send: SendFn;
  private meId = '';
  private onChange: () => void;

  constructor(send: SendFn, onChange: () => void) {
    this.send = send;
    this.onChange = onChange;
  }

  get connected(): boolean {
    return !!this.roomId;
  }

  setIdentity(id: string, _username: string): void {
    this.meId = id;
  }

  async join(roomId: string): Promise<void> {
    if (this.roomId === roomId) return;
    if (this.roomId) await this.leave();
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch {
      throw new Error('Microphone permission denied');
    }
    this.roomId = roomId;
    this.muted = false;
    this.deafened = false;
    this.applyLocalTracks();
    this.send({ type: 'voice_join', room: roomId });
    this.onChange();
  }

  async leave(): Promise<void> {
    const room = this.roomId;
    this.roomId = null;
    if (room) this.send({ type: 'voice_leave', room });
    for (const id of [...this.pcs.keys()]) this.closePeer(id);
    this.peers.clear();
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.onChange();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.applyLocalTracks();
    if (this.roomId) {
      this.send({ type: 'voice_state', room: this.roomId, muted: this.muted, deafened: this.deafened });
    }
    this.onChange();
  }

  toggleDeafen(): void {
    this.deafened = !this.deafened;
    if (this.deafened && !this.muted) {
      this.muted = true;
      this.applyLocalTracks();
    }
    for (const audio of this.remoteAudio.values()) {
      audio.muted = this.deafened;
    }
    if (this.roomId) {
      this.send({ type: 'voice_state', room: this.roomId, muted: this.muted, deafened: this.deafened });
    }
    this.onChange();
  }

  handleWire(data: {
    type: string;
    room?: string;
    peers?: VoicePeer[];
    peer?: VoicePeer;
    from?: string;
    fromName?: string;
    payload?: VoiceSignalPayload;
    muted?: boolean;
    deafened?: boolean;
  }): void {
    if (!this.roomId) return;
    if (data.room && data.room !== this.roomId) return;

    if (data.type === 'voice_peers' && Array.isArray(data.peers)) {
      this.peers.clear();
      for (const p of data.peers) {
        if (p.id === this.meId) continue;
        this.peers.set(p.id, p);
        // Wait for existing peers to offer; prepare PC without offering
        void this.ensurePeer(p.id, false);
      }
      this.onChange();
    } else if (data.type === 'voice_peer_joined' && data.peer) {
      if (data.peer.id === this.meId) return;
      this.peers.set(data.peer.id, data.peer);
      // Existing members create the offer toward the new joiner
      void this.ensurePeer(data.peer.id, true);
      this.onChange();
    } else if (data.type === 'voice_peer_left' && data.from) {
      this.peers.delete(data.from);
      this.closePeer(data.from);
      this.onChange();
    } else if (data.type === 'voice_state' && data.from) {
      const p = this.peers.get(data.from);
      if (p) {
        p.muted = !!data.muted;
        p.deafened = !!data.deafened;
        this.peers.set(data.from, p);
        this.onChange();
      }
    } else if (data.type === 'voice_signal' && data.from && data.payload) {
      void this.onSignal(data.from, data.fromName || 'Player', data.payload);
    }
  }

  private applyLocalTracks(): void {
    const stream = this.localStream;
    if (!stream) return;
    for (const track of stream.getAudioTracks()) {
      track.enabled = !this.muted;
    }
    for (const pc of this.pcs.values()) {
      for (const sender of pc.getSenders()) {
        if (sender.track?.kind === 'audio') sender.track.enabled = !this.muted;
      }
    }
  }

  private async ensurePeer(peerId: string, createOffer: boolean): Promise<void> {
    if (peerId === this.meId || !this.localStream || !this.roomId) return;
    let pc = this.pcs.get(peerId);
    if (!pc) {
      pc = new RTCPeerConnection(ICE);
      this.pcs.set(peerId, pc);

      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }

      pc.onicecandidate = (ev) => {
        if (!this.roomId) return;
        this.send({
          type: 'voice_signal',
          room: this.roomId,
          to: peerId,
          payload: { kind: 'ice', candidate: ev.candidate ? ev.candidate.toJSON() : null },
        });
      };

      pc.ontrack = (ev) => {
        const stream = ev.streams[0] || new MediaStream([ev.track]);
        let audio = this.remoteAudio.get(peerId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          audio.setAttribute('playsinline', 'true');
          this.remoteAudio.set(peerId, audio);
        }
        audio.srcObject = stream;
        audio.muted = this.deafened;
        void audio.play().catch(() => {
          /* autoplay may require a prior gesture — join button counts */
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc!.connectionState === 'failed' || pc!.connectionState === 'closed') {
          this.closePeer(peerId);
          this.onChange();
        }
      };
    }

    if (!createOffer) return;
    if (pc.signalingState !== 'stable') return;

    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      this.send({
        type: 'voice_signal',
        room: this.roomId,
        to: peerId,
        payload: { kind: 'offer', sdp: pc.localDescription!.toJSON() },
      });
    } catch (err) {
      console.warn('[voice] offer failed', err);
      this.closePeer(peerId);
    }
  }

  private async onSignal(from: string, name: string, payload: VoiceSignalPayload): Promise<void> {
    if (!this.peers.has(from)) {
      this.peers.set(from, { id: from, username: name, muted: false, deafened: false });
    }

    if (payload.kind === 'offer') {
      let pc = this.pcs.get(from);
      if (!pc) {
        await this.ensurePeer(from, false);
        pc = this.pcs.get(from);
      }
      if (!pc) return;
      try {
        await pc.setRemoteDescription(payload.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.send({
          type: 'voice_signal',
          room: this.roomId,
          to: from,
          payload: { kind: 'answer', sdp: pc.localDescription!.toJSON() },
        });
      } catch (err) {
        console.warn('[voice] answer failed', err);
      }
      this.onChange();
      return;
    }

    if (payload.kind === 'answer') {
      const pc = this.pcs.get(from);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(payload.sdp);
      } catch (err) {
        console.warn('[voice] setRemote answer failed', err);
      }
      return;
    }

    if (payload.kind === 'ice') {
      const pc = this.pcs.get(from);
      if (!pc || !payload.candidate) return;
      try {
        await pc.addIceCandidate(payload.candidate);
      } catch {
        /* ignore late candidates */
      }
    }
  }

  private closePeer(peerId: string): void {
    const pc = this.pcs.get(peerId);
    if (pc) {
      try {
        pc.close();
      } catch {
        /* ignore */
      }
      this.pcs.delete(peerId);
    }
    const audio = this.remoteAudio.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      this.remoteAudio.delete(peerId);
    }
  }
}

export function voiceRoomKey(activeId: string, myId: string): string {
  if (activeId === 'global' || activeId.startsWith('group:')) return `voice:${activeId}`;
  const ids = [myId, activeId].sort();
  return `voice:dm:${ids[0]}:${ids[1]}`;
}
