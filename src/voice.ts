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
    { urls: 'stun:stun2.l.google.com:19302' },
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
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();
  private makingOffer = new Map<string, boolean>();
  private ignoreOffer = new Map<string, boolean>();
  private send: SendFn;
  private meId = '';
  private onChange: () => void;
  private audioRoot: HTMLDivElement | null = null;

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

  /** Higher id is the offerer — avoids glare when both join at once. */
  private isOfferer(peerId: string): boolean {
    return this.meId.localeCompare(peerId) > 0;
  }

  private isPolite(peerId: string): boolean {
    return !this.isOfferer(peerId);
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

    // Unlock autoplay using the same user gesture that started the call.
    this.ensureAudioRoot();
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        const ctx = new AC();
        await ctx.resume();
        void ctx.close();
      }
    } catch {
      /* ignore */
    }
    const unlock = new Audio();
    unlock.src =
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
    unlock.volume = 0.01;
    void unlock.play().catch(() => undefined);

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
    this.pendingIce.clear();
    this.makingOffer.clear();
    this.ignoreOffer.clear();
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.audioRoot?.remove();
    this.audioRoot = null;
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
      audio.volume = this.deafened ? 0 : 1;
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
        void this.ensurePeer(p.id);
      }
      this.onChange();
    } else if (data.type === 'voice_peer_joined' && data.peer) {
      if (data.peer.id === this.meId) return;
      this.peers.set(data.peer.id, data.peer);
      void this.ensurePeer(data.peer.id);
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

  private ensureAudioRoot(): HTMLDivElement {
    if (this.audioRoot?.isConnected) return this.audioRoot;
    const el = document.createElement('div');
    el.id = 'link-voice-audio-root';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;';
    document.body.appendChild(el);
    this.audioRoot = el;
    return el;
  }

  private attachRemoteAudio(peerId: string, stream: MediaStream): void {
    const root = this.ensureAudioRoot();
    let audio = this.remoteAudio.get(peerId);
    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      root.appendChild(audio);
      this.remoteAudio.set(peerId, audio);
    }
    if (audio.srcObject !== stream) audio.srcObject = stream;
    audio.muted = this.deafened;
    audio.volume = this.deafened ? 0 : 1;
    const tryPlay = () => {
      void audio!.play().catch((err) => {
        console.warn('[voice] remote play blocked', peerId, err);
        window.setTimeout(() => void audio!.play().catch(() => undefined), 300);
      });
    };
    tryPlay();
    stream.getAudioTracks().forEach((t) => {
      t.enabled = true;
      t.onunmute = () => tryPlay();
    });
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

  private async ensurePeer(peerId: string): Promise<void> {
    if (!peerId || peerId === this.meId || !this.localStream || !this.roomId) return;

    let pc = this.pcs.get(peerId);
    if (!pc) {
      pc = new RTCPeerConnection(ICE);
      this.pcs.set(peerId, pc);

      // addTrack (with stream) so remote ontrack gets a proper MediaStream + MSID.
      for (const track of this.localStream.getAudioTracks()) {
        pc.addTrack(track, this.localStream);
      }

      pc.onicecandidate = (ev) => {
        if (!this.roomId) return;
        this.send({
          type: 'voice_signal',
          room: this.roomId,
          to: peerId,
          payload: {
            kind: 'ice',
            candidate: ev.candidate ? ev.candidate.toJSON() : null,
          },
        });
      };

      pc.ontrack = (ev) => {
        const stream = ev.streams[0] || new MediaStream([ev.track]);
        ev.track.enabled = true;
        this.attachRemoteAudio(peerId, stream);
        this.onChange();
      };

      pc.onconnectionstatechange = () => {
        const state = pc!.connectionState;
        if (state === 'failed') {
          try {
            pc!.restartIce();
          } catch {
            /* ignore */
          }
        }
        if (state === 'closed' || state === 'failed') {
          // Keep peer listed; ICE restart may recover. Only tear down on leave/peer_left.
        }
      };
    } else {
      // Re-attach mic if a sender lost its track.
      const localAudio = this.localStream.getAudioTracks()[0];
      if (localAudio) {
        const audioSender = pc.getSenders().find((s) => !s.track || s.track.kind === 'audio');
        if (audioSender && audioSender.track !== localAudio) {
          try {
            await audioSender.replaceTrack(localAudio);
          } catch {
            /* ignore */
          }
        } else if (!audioSender) {
          pc.addTrack(localAudio, this.localStream);
        }
      }
    }

    if (!this.isOfferer(peerId)) return;
    if (this.makingOffer.get(peerId)) return;
    if (pc.signalingState !== 'stable') return;

    this.makingOffer.set(peerId, true);
    try {
      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable' || !this.roomId) return;
      await pc.setLocalDescription(offer);
      this.send({
        type: 'voice_signal',
        room: this.roomId,
        to: peerId,
        payload: {
          kind: 'offer',
          sdp: { type: pc.localDescription!.type, sdp: pc.localDescription!.sdp },
        },
      });
    } catch (err) {
      console.warn('[voice] offer failed', err);
    } finally {
      this.makingOffer.set(peerId, false);
    }
  }

  private async flushIce(peerId: string): Promise<void> {
    const pc = this.pcs.get(peerId);
    const queued = this.pendingIce.get(peerId);
    if (!pc || !queued?.length || !pc.remoteDescription) return;
    this.pendingIce.set(peerId, []);
    for (const c of queued) {
      try {
        await pc.addIceCandidate(c);
      } catch (err) {
        console.warn('[voice] flush ice failed', err);
      }
    }
  }

  private async onSignal(from: string, name: string, payload: VoiceSignalPayload): Promise<void> {
    if (!this.peers.has(from)) {
      this.peers.set(from, { id: from, username: name, muted: false, deafened: false });
    }

    if (payload.kind === 'offer') {
      await this.ensurePeer(from);
      const pc = this.pcs.get(from);
      if (!pc) return;

      const polite = this.isPolite(from);
      const offerCollision = !!this.makingOffer.get(from) || pc.signalingState !== 'stable';
      this.ignoreOffer.set(from, !polite && offerCollision);
      if (this.ignoreOffer.get(from)) return;

      try {
        if (offerCollision) {
          await pc.setLocalDescription({ type: 'rollback' });
        }
        await pc.setRemoteDescription(payload.sdp);
        await this.flushIce(from);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.send({
          type: 'voice_signal',
          room: this.roomId,
          to: from,
          payload: {
            kind: 'answer',
            sdp: { type: pc.localDescription!.type, sdp: pc.localDescription!.sdp },
          },
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
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(payload.sdp);
          await this.flushIce(from);
        }
      } catch (err) {
        console.warn('[voice] setRemote answer failed', err);
      }
      return;
    }

    if (payload.kind === 'ice') {
      if (this.ignoreOffer.get(from)) return;
      const pc = this.pcs.get(from);
      if (!payload.candidate) {
        if (pc?.remoteDescription) {
          try {
            await pc.addIceCandidate(null);
          } catch {
            /* ignore */
          }
        }
        return;
      }
      if (!pc || !pc.remoteDescription) {
        const q = this.pendingIce.get(from) ?? [];
        q.push(payload.candidate);
        this.pendingIce.set(from, q);
        return;
      }
      try {
        await pc.addIceCandidate(payload.candidate);
      } catch (err) {
        console.warn('[voice] addIce failed', err);
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
    this.pendingIce.delete(peerId);
    this.makingOffer.delete(peerId);
    this.ignoreOffer.delete(peerId);
    const audio = this.remoteAudio.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      this.remoteAudio.delete(peerId);
    }
  }
}

export function voiceRoomKey(activeId: string, myId: string): string {
  if (activeId === 'global' || activeId.startsWith('group:')) return `voice:${activeId}`;
  const ids = [myId, activeId].sort();
  return `voice:dm:${ids[0]}:${ids[1]}`;
}
