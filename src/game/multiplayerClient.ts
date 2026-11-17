import type {
  ClientWsMessage,
  MultiplayerClaimedStop,
  MultiplayerPlayerTelemetry,
  MultiplayerRoomState,
  MultiplayerRoomSummary,
  ServerWsMessage,
} from './multiplayerTypes';

export type WsConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface MultiplayerClientSnapshot {
  connectionStatus: WsConnectionStatus;
  clientId: string;
  callsign: string;
  onlineCount: number;
  publicRooms: MultiplayerRoomSummary[];
  room: MultiplayerRoomState | null;
  errorMessage: string | null;
}

type SnapshotListener = (snap: MultiplayerClientSnapshot) => void;

export interface RealtimeCanvasHandlers {
  onPeerTelemetry?: (
    peers: Array<{
      id: string;
      vehicleId: string;
      topperId: string;
      telemetry: MultiplayerPlayerTelemetry;
    }>,
  ) => void;
  onStopClaimed?: (payload: {
    claim: MultiplayerClaimedStop;
    activeStopIndex: number;
    timeRemainingSec: number;
  }) => void;
  onRemoteHorn?: (payload: {
    playerId: string;
    callsign: string;
    x: number;
    z: number;
  }) => void;
  onRoomClock?: (payload: {
    countdownSec: number;
    timeRemainingSec: number;
  }) => void;
}

const CLIENT_ID_STORAGE_KEY = 'courier_mp_client_id_v1';
const CALLSIGN_STORAGE_KEY = 'courier_mp_callsign_v1';

const CALLSIGN_PREFIXES = ['NORD', 'OSLO', 'SVEA', 'FJRD', 'KBH', 'HELS'];

function loadOrCreateClientId(): string {
  if (typeof window === 'undefined') return 'srv_client';
  try {
    const existing = window.sessionStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (existing && existing.length >= 6) return existing;
    const created =
      'c_' +
      Math.random().toString(36).slice(2, 8) +
      '_' +
      Date.now().toString(36).slice(-4);
    window.sessionStorage.setItem(CLIENT_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return 'c_' + Math.random().toString(36).slice(2, 10);
  }
}

function loadOrCreateCallsign(): string {
  if (typeof window === 'undefined') return 'NORD-01';
  try {
    const existing = window.localStorage.getItem(CALLSIGN_STORAGE_KEY);
    if (existing && existing.trim().length > 0) {
      return existing.trim().slice(0, 12).toUpperCase();
    }
    const prefix =
      CALLSIGN_PREFIXES[Math.floor(Math.random() * CALLSIGN_PREFIXES.length)];
    const num = String(Math.floor(10 + Math.random() * 89));
    const generated = `${prefix}-${num}`;
    window.localStorage.setItem(CALLSIGN_STORAGE_KEY, generated);
    return generated;
  } catch {
    return 'NORD-01';
  }
}

export function readInitialRoomFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('room');
  if (!raw) return null;
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return cleaned.length >= 4 ? cleaned : null;
}

export function syncRoomUrlParam(roomId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (roomId) {
      url.searchParams.set('room', roomId);
    } else {
      url.searchParams.delete('room');
    }
    window.history.replaceState({}, '', url.toString());
  } catch {
    // Ignore history API restrictions in embedded frames
  }
}

class MultiplayerClientManager {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private shouldStayConnected = false;

  private lastVehicleId = 'classic_van';
  private lastTopperId = 'beacon';
  private desiredRoomId: string | null = null;
  private pendingOutboundQueue: ClientWsMessage[] = [];

  private snapshot: MultiplayerClientSnapshot = {
    connectionStatus: 'disconnected',
    clientId: loadOrCreateClientId(),
    callsign: loadOrCreateCallsign(),
    onlineCount: 0,
    publicRooms: [],
    room: null,
    errorMessage: null,
  };

  private listeners = new Set<SnapshotListener>();
  private canvasHandlers: RealtimeCanvasHandlers = {};
  private matchEventListeners = new Set<
    (ev: { type: 'started' | 'finished'; room: MultiplayerRoomState }) => void
  >();

  public getSnapshot(): MultiplayerClientSnapshot {
    return this.snapshot;
  }

  public subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onMatchLifecycle(
    cb: (ev: { type: 'started' | 'finished'; room: MultiplayerRoomState }) => void,
  ): () => void {
    this.matchEventListeners.add(cb);
    return () => {
      this.matchEventListeners.delete(cb);
    };
  }

  public setCanvasHandlers(handlers: RealtimeCanvasHandlers): void {
    this.canvasHandlers = handlers;
  }

  private emitSnapshot(): void {
    const current = { ...this.snapshot };
    this.snapshot = current;
    for (const fn of this.listeners) {
      fn(current);
    }
  }

  public ensureConnected(): void {
    if (typeof window === 'undefined') return;
    this.shouldStayConnected = true;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.snapshot.connectionStatus = 'connecting';
    this.emitSnapshot();

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);
    this.ws = socket;

    socket.onopen = () => {
      if (this.ws !== socket) return;
      this.reconnectAttempts = 0;
      this.snapshot.connectionStatus = 'connected';
      this.snapshot.errorMessage = null;
      this.emitSnapshot();

      // Re-sync room automatically on reconnect if user was in a room
      if (this.desiredRoomId && this.pendingOutboundQueue.length === 0) {
        this.sendRaw({
          type: 'room:join',
          roomId: this.desiredRoomId,
          clientId: this.snapshot.clientId,
          callsign: this.snapshot.callsign,
          vehicleId: this.lastVehicleId,
          topperId: this.lastTopperId,
        });
      }

      while (this.pendingOutboundQueue.length > 0) {
        const nextMsg = this.pendingOutboundQueue.shift();
        if (nextMsg) this.sendRaw(nextMsg);
      }
    };

    socket.onmessage = (ev) => {
      if (this.ws !== socket) return;
      let msg: ServerWsMessage;
      try {
        msg = JSON.parse(String(ev.data)) as ServerWsMessage;
      } catch {
        return;
      }
      this.handleServerMessage(msg);
    };

    socket.onclose = () => {
      if (this.ws !== socket) return;
      this.ws = null;
      this.snapshot.connectionStatus = 'disconnected';
      this.emitSnapshot();

      if (this.shouldStayConnected) {
        const delay = Math.min(4000, 450 * Math.pow(1.6, this.reconnectAttempts));
        this.reconnectAttempts += 1;
        this.reconnectTimer = window.setTimeout(() => {
          this.reconnectTimer = null;
          this.ensureConnected();
        }, delay);
      }
    };

    socket.onerror = () => {
      // Handled cleanly in onclose auto-reconnect
    };
  }

  private sendRaw(msg: ClientWsMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.ensureConnected();
      // Only queue control actions, never high-frequency telemetry
      if (msg.type !== 'player:telemetry') {
        this.pendingOutboundQueue.push(msg);
      }
    }
  }

  private handleServerMessage(msg: ServerWsMessage): void {
    switch (msg.type) {
      case 'rooms:updated': {
        this.snapshot.publicRooms = msg.rooms;
        this.snapshot.onlineCount = msg.onlineCount;
        this.emitSnapshot();
        break;
      }

      case 'room:state': {
        this.desiredRoomId = msg.room.roomId;
        this.snapshot.room = msg.room;
        this.snapshot.errorMessage = null;
        syncRoomUrlParam(msg.room.roomId);
        this.emitSnapshot();
        break;
      }

      case 'room:left': {
        this.desiredRoomId = null;
        this.snapshot.room = null;
        syncRoomUrlParam(null);
        this.emitSnapshot();
        break;
      }

      case 'room:error': {
        this.snapshot.errorMessage = msg.message;
        this.emitSnapshot();
        break;
      }

      case 'match:started': {
        this.desiredRoomId = msg.room.roomId;
        this.snapshot.room = msg.room;
        this.snapshot.errorMessage = null;
        syncRoomUrlParam(msg.room.roomId);
        this.emitSnapshot();
        for (const fn of this.matchEventListeners) {
          fn({ type: 'started', room: msg.room });
        }
        break;
      }

      case 'match:finished': {
        this.snapshot.room = msg.room;
        this.emitSnapshot();
        for (const fn of this.matchEventListeners) {
          fn({ type: 'finished', room: msg.room });
        }
        break;
      }

      case 'room:clock': {
        if (this.snapshot.room && this.snapshot.room.roomId === msg.roomId) {
          this.canvasHandlers.onRoomClock?.({
            countdownSec: msg.countdownSec,
            timeRemainingSec: msg.timeRemainingSec,
          });
        }
        break;
      }

      case 'room:telemetry': {
        if (this.snapshot.room && this.snapshot.room.roomId === msg.roomId) {
          const remoteOnly = msg.peers.filter(
            (p) => p.id !== this.snapshot.clientId,
          );
          if (remoteOnly.length > 0) {
            this.canvasHandlers.onPeerTelemetry?.(remoteOnly);
          }
        }
        break;
      }

      case 'player:horned': {
        if (
          this.snapshot.room &&
          this.snapshot.room.roomId === msg.roomId &&
          msg.playerId !== this.snapshot.clientId
        ) {
          this.canvasHandlers.onRemoteHorn?.({
            playerId: msg.playerId,
            callsign: msg.callsign,
            x: msg.x,
            z: msg.z,
          });
        }
        break;
      }

      case 'stop:claimed': {
        if (this.snapshot.room && this.snapshot.room.roomId === msg.roomId) {
          const scoreMap = new Map(msg.players.map((p) => [p.id, p]));
          this.snapshot.room = {
            ...this.snapshot.room,
            activeStopIndex: msg.activeStopIndex,
            timeRemainingSec: msg.timeRemainingSec,
            claimedStops: {
              ...this.snapshot.room.claimedStops,
              [msg.claim.stopIndex]: msg.claim,
            },
            players: this.snapshot.room.players.map((pl) => {
              const updated = scoreMap.get(pl.id);
              return updated
                ? {
                    ...pl,
                    score: updated.score,
                    deliveries: updated.deliveries,
                    bullseyes: updated.bullseyes,
                    tickets: updated.tickets,
                  }
                : pl;
            }),
          };
          this.emitSnapshot();
          this.canvasHandlers.onStopClaimed?.({
            claim: msg.claim,
            activeStopIndex: msg.activeStopIndex,
            timeRemainingSec: msg.timeRemainingSec,
          });
        }
        break;
      }
    }
  }

  public setCallsign(raw: string): void {
    const cleaned = raw
      .trim()
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .slice(0, 12)
      .toUpperCase();
    const finalCallsign = cleaned || 'NORD-01';
    this.snapshot.callsign = finalCallsign;
    try {
      window.localStorage.setItem(CALLSIGN_STORAGE_KEY, finalCallsign);
    } catch {
      // Ignore storage quota errors
    }
    this.emitSnapshot();

    if (this.snapshot.room) {
      this.sendRaw({
        type: 'player:update_profile',
        callsign: finalCallsign,
      });
    }
  }

  public syncCosmetics(vehicleId: string, topperId: string): void {
    this.lastVehicleId = vehicleId;
    this.lastTopperId = topperId;
    if (this.snapshot.room) {
      this.sendRaw({
        type: 'player:update_profile',
        vehicleId,
        topperId,
      });
    }
  }

  public clearError(): void {
    if (this.snapshot.errorMessage) {
      this.snapshot.errorMessage = null;
      this.emitSnapshot();
    }
  }

  public quickJoin(
    vehicleId: string,
    topperId: string,
    preferredLevel: number,
  ): void {
    this.lastVehicleId = vehicleId;
    this.lastTopperId = topperId;
    this.sendRaw({
      type: 'room:quick_join',
      clientId: this.snapshot.clientId,
      callsign: this.snapshot.callsign,
      vehicleId,
      topperId,
      preferredLevel,
    });
  }

  public createRoom(
    isPublic: boolean,
    level: number,
    vehicleId: string,
    topperId: string,
  ): void {
    this.lastVehicleId = vehicleId;
    this.lastTopperId = topperId;
    this.sendRaw({
      type: 'room:create',
      clientId: this.snapshot.clientId,
      callsign: this.snapshot.callsign,
      vehicleId,
      topperId,
      isPublic,
      level,
    });
  }

  public joinRoom(roomId: string, vehicleId: string, topperId: string): void {
    const cleanCode = roomId.trim().toUpperCase().slice(0, 8);
    if (!cleanCode) return;
    this.lastVehicleId = vehicleId;
    this.lastTopperId = topperId;
    this.desiredRoomId = cleanCode;
    this.sendRaw({
      type: 'room:join',
      roomId: cleanCode,
      clientId: this.snapshot.clientId,
      callsign: this.snapshot.callsign,
      vehicleId,
      topperId,
    });
  }

  public leaveRoom(): void {
    this.desiredRoomId = null;
    this.snapshot.room = null;
    syncRoomUrlParam(null);
    this.emitSnapshot();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'room:leave' }));
    }
  }

  public toggleReady(ready: boolean): void {
    if (!this.snapshot.room) return;
    this.sendRaw({
      type: 'player:update_profile',
      ready,
    });
  }

  public setRoomLevel(level: number): void {
    if (!this.snapshot.room) return;
    this.sendRaw({
      type: 'room:set_level',
      level,
    });
  }

  public startMatch(level?: number): void {
    if (!this.snapshot.room) return;
    this.sendRaw({
      type: 'match:start',
      level,
    });
  }

  public returnRoomToLobby(): void {
    if (!this.snapshot.room) return;
    this.sendRaw({
      type: 'match:return_lobby',
    });
  }

  public sendTelemetry(
    telemetry: MultiplayerPlayerTelemetry,
    ticketsCount?: number,
  ): void {
    if (
      !this.snapshot.room ||
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    this.ws.send(
      JSON.stringify({
        type: 'player:telemetry',
        telemetry,
        ticketsCount,
      } satisfies ClientWsMessage),
    );
  }

  public sendHorn(x: number, z: number): void {
    if (
      !this.snapshot.room ||
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    this.ws.send(
      JSON.stringify({
        type: 'player:horn',
        x,
        z,
      } satisfies ClientWsMessage),
    );
  }

  public sendStopClaim(payload: {
    stopIndex: number;
    viaExpressToss: boolean;
    isBullseye: boolean;
    pointsRequested: number;
    timeBonusSec: number;
    ticketsCount: number;
    fromX: number;
    fromY: number;
    fromZ: number;
  }): void {
    if (!this.snapshot.room) return;
    this.sendRaw({
      type: 'stop:claim',
      ...payload,
    });
  }
}

export const multiplayerClient = new MultiplayerClientManager();
