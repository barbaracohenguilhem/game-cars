import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  ClientWsMessage,
  MultiplayerClaimedStop,
  MultiplayerOutcome,
  MultiplayerPlayerInfo,
  MultiplayerPlayerTelemetry,
  MultiplayerRoomState,
  MultiplayerRoomStatus,
  MultiplayerRoomSummary,
  MultiplayerStanding,
  MultiplayerWeatherCondition,
  ServerWsMessage,
} from './src/game/multiplayerTypes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MAX_PLAYERS_PER_ROOM = 6;
const START_COUNTDOWN_SEC = 1.6;

const DISTRICT_NAMES = [
  'Winding Canal Harbor',
  'Twin-River Archipelago',
  'Old Town Moat & Spires',
  'Serpentine Port District',
  'Sakura Quay & Bridges',
  'Grand Citadel Canals',
  'Harborfront Labyrinth',
  'Metropolis Island Rush',
];

const COURIER_COLORS = [
  '#ff551e', // Signal Orange
  '#2a9d8f', // Fjord Teal
  '#eab308', // Nordic Amber
  '#3b82f6', // Baltic Blue
  '#ec4899', // Heather Rose
  '#8b5cf6', // Aurora Violet
];

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const DEFAULT_WEATHER_CYCLE: MultiplayerWeatherCondition[] = [
  'morning_mist',
  'light_snow',
  'clear',
  'fjord_drizzle',
];

function getDefaultWeatherForLevelServer(level: number): MultiplayerWeatherCondition {
  const safeLevel = Math.max(1, Math.floor(level || 1));
  return DEFAULT_WEATHER_CYCLE[(safeLevel - 1) % DEFAULT_WEATHER_CYCLE.length];
}

function sanitizeWeather(
  raw: unknown,
  fallbackLevel: number,
): MultiplayerWeatherCondition {
  if (
    raw === 'clear' ||
    raw === 'morning_mist' ||
    raw === 'light_snow' ||
    raw === 'fjord_drizzle'
  ) {
    return raw;
  }
  return getDefaultWeatherForLevelServer(fallbackLevel);
}

function computeDistrictMeta(level: number): {
  safeLevel: number;
  districtName: string;
  stopCount: number;
  timeLimitSec: number;
  defaultWeather: MultiplayerWeatherCondition;
} {
  const safeLevel = Math.max(1, Math.min(20, Math.floor(level || 1)));
  const districtName =
    DISTRICT_NAMES[(safeLevel - 1) % DISTRICT_NAMES.length] ??
    'Winding Canal Harbor';
  const stopCount = Math.min(9, 3 + safeLevel);
  const baseTime = 78 + stopCount * 9 - Math.min(22, (safeLevel - 1) * 3);
  const timeLimitSec = Math.max(60, baseTime);
  const defaultWeather = getDefaultWeatherForLevelServer(safeLevel);
  return { safeLevel, districtName, stopCount, timeLimitSec, defaultWeather };
}

function sanitizeCallsign(raw: unknown): string {
  if (typeof raw !== 'string') return 'NORD-01';
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .slice(0, 12);
  return cleaned.length > 0 ? cleaned.toUpperCase() : 'NORD-01';
}

function sanitizeVehicle(raw: unknown): string {
  const allowed = ['classic_van', 'kei_truck', 'vespa_trike', 'armored_van'];
  return typeof raw === 'string' && allowed.includes(raw) ? raw : 'classic_van';
}

function sanitizeTopper(raw: unknown): string {
  const allowed = [
    'beacon',
    'rubber_duck',
    'espresso_cup',
    'party_balloons',
  ];
  return typeof raw === 'string' && allowed.includes(raw) ? raw : 'beacon';
}

function clampFinite(val: unknown, fallback: number, min: number, max: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function sanitizeTelemetry(raw: unknown): MultiplayerPlayerTelemetry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    x: clampFinite(r.x, 0, -200, 200),
    y: clampFinite(r.y, 0, -10, 40),
    z: clampFinite(r.z, 0, -200, 200),
    vx: clampFinite(r.vx, 0, -80, 80),
    vz: clampFinite(r.vz, 0, -80, 80),
    yaw: clampFinite(r.yaw, 0, -Math.PI * 4, Math.PI * 4),
    speed: clampFinite(r.speed, 0, 0, 80),
    steerAngle: clampFinite(r.steerAngle, 0, -1.5, 1.5),
    rollAngle: clampFinite(r.rollAngle, 0, -1.5, 1.5),
    pitchAngle: clampFinite(r.pitchAngle, 0, -1.5, 1.5),
    isBraking: Boolean(r.isBraking),
    isBoosting: Boolean(r.isBoosting),
    isDrifting: Boolean(r.isDrifting),
    hasBumperShield: Boolean(r.hasBumperShield),
    distanceTraveled: clampFinite(r.distanceTraveled, 0, 0, 1_000_000),
  };
}

interface ConnectedSocketMeta {
  ws: WebSocket;
  clientId: string;
  roomId: string | null;
  isAlive: boolean;
}

interface ServerPlayer extends MultiplayerPlayerInfo {
  ws: WebSocket;
  dirtyTelemetry: boolean;
}

interface ServerRoom {
  roomId: string;
  isPublic: boolean;
  hostId: string;
  status: MultiplayerRoomStatus;
  level: number;
  districtName: string;
  weather: MultiplayerWeatherCondition;
  seed: number;
  totalStops: number;
  activeStopIndex: number;
  timeLimitSec: number;
  timeRemainingSec: number;
  countdownSec: number;
  claimedStops: Record<number, MultiplayerClaimedStop>;
  players: Map<string, ServerPlayer>;
  outcome: MultiplayerOutcome;
  standings: MultiplayerStanding[];
  clockBroadcastAccumMs: number;
}

const rooms = new Map<string, ServerRoom>();
const socketMeta = new Map<WebSocket, ConnectedSocketMeta>();

function generateRoomCode(): string {
  for (let attempt = 0; attempt < 40; attempt++) {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return 'R' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function generateMatchSeed(): number {
  return Math.floor(100_000 + Math.random() * 899_999_999);
}

function sendJson(ws: WebSocket, payload: ServerWsMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastToRoom(
  room: ServerRoom,
  payload: ServerWsMessage,
  excludeId?: string,
): void {
  const raw = JSON.stringify(payload);
  for (const [pid, player] of room.players.entries()) {
    if (excludeId && pid === excludeId) continue;
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(raw);
    }
  }
}

function serializeRoomState(room: ServerRoom): MultiplayerRoomState {
  const players: MultiplayerPlayerInfo[] = Array.from(
    room.players.values(),
  ).map((p) => ({
    id: p.id,
    slotIndex: p.slotIndex,
    callsign: p.callsign,
    colorHex: p.colorHex,
    vehicleId: p.vehicleId,
    topperId: p.topperId,
    ready: p.ready,
    score: p.score,
    deliveries: p.deliveries,
    bullseyes: p.bullseyes,
    tickets: p.tickets,
    telemetry: p.telemetry,
  }));

  players.sort((a, b) => a.slotIndex - b.slotIndex);

  return {
    roomId: room.roomId,
    isPublic: room.isPublic,
    hostId: room.hostId,
    status: room.status,
    level: room.level,
    districtName: room.districtName,
    weather: room.weather,
    seed: room.seed,
    totalStops: room.totalStops,
    activeStopIndex: room.activeStopIndex,
    timeLimitSec: room.timeLimitSec,
    timeRemainingSec: Math.max(0, Math.ceil(room.timeRemainingSec)),
    countdownSec: Number(Math.max(0, room.countdownSec).toFixed(2)),
    claimedStops: { ...room.claimedStops },
    players,
    outcome: room.outcome,
    standings: room.standings,
  };
}

function getPublicRoomSummaries(): MultiplayerRoomSummary[] {
  const list: MultiplayerRoomSummary[] = [];
  for (const room of rooms.values()) {
    if (!room.isPublic || room.players.size === 0) continue;
    const host = room.players.get(room.hostId);
    list.push({
      roomId: room.roomId,
      isPublic: room.isPublic,
      status: room.status,
      level: room.level,
      districtName: room.districtName,
      weather: room.weather,
      playerCount: room.players.size,
      maxPlayers: MAX_PLAYERS_PER_ROOM,
      hostCallsign: host?.callsign ?? 'DISPATCH',
    });
  }
  list.sort((a, b) => {
    if (a.status === 'lobby' && b.status !== 'lobby') return -1;
    if (a.status !== 'lobby' && b.status === 'lobby') return 1;
    return b.playerCount - a.playerCount;
  });
  return list;
}

function broadcastRoomDirectory(): void {
  const summaries = getPublicRoomSummaries();
  const onlineCount = socketMeta.size;
  const payload: ServerWsMessage = {
    type: 'rooms:updated',
    rooms: summaries,
    onlineCount,
  };
  const raw = JSON.stringify(payload);
  for (const meta of socketMeta.values()) {
    if (meta.ws.readyState === WebSocket.OPEN) {
      meta.ws.send(raw);
    }
  }
}

function pickAvailableSlotAndColor(room: ServerRoom): {
  slotIndex: number;
  colorHex: string;
} {
  const usedSlots = new Set<number>();
  for (const p of room.players.values()) {
    usedSlots.add(p.slotIndex);
  }
  let slotIndex = 0;
  while (usedSlots.has(slotIndex) && slotIndex < MAX_PLAYERS_PER_ROOM) {
    slotIndex += 1;
  }
  const colorHex = COURIER_COLORS[slotIndex % COURIER_COLORS.length];
  return { slotIndex, colorHex };
}

function createServerRoom(
  hostId: string,
  isPublic: boolean,
  level: number,
  requestedWeather?: unknown,
): ServerRoom {
  const meta = computeDistrictMeta(level);
  const roomId = generateRoomCode();
  const room: ServerRoom = {
    roomId,
    isPublic,
    hostId,
    status: 'lobby',
    level: meta.safeLevel,
    districtName: meta.districtName,
    weather:
      requestedWeather !== undefined
        ? sanitizeWeather(requestedWeather, meta.safeLevel)
        : meta.defaultWeather,
    seed: generateMatchSeed(),
    totalStops: meta.stopCount,
    activeStopIndex: 1,
    timeLimitSec: meta.timeLimitSec,
    timeRemainingSec: meta.timeLimitSec,
    countdownSec: 0,
    claimedStops: {},
    players: new Map(),
    outcome: 'none',
    standings: [],
    clockBroadcastAccumMs: 0,
  };
  rooms.set(roomId, room);
  return room;
}

function removeClientFromCurrentRoom(meta: ConnectedSocketMeta): void {
  if (!meta.roomId) return;
  const room = rooms.get(meta.roomId);
  meta.roomId = null;
  if (!room) return;

  const existing = room.players.get(meta.clientId);
  // Guard against removing a player whose clientId reconnected on a newer socket
  if (existing && existing.ws !== meta.ws) {
    return;
  }

  room.players.delete(meta.clientId);

  if (room.players.size === 0) {
    rooms.delete(room.roomId);
    broadcastRoomDirectory();
    return;
  }

  if (room.hostId === meta.clientId) {
    const nextHost = room.players.keys().next().value;
    if (nextHost) {
      room.hostId = nextHost;
    }
  }

  broadcastToRoom(room, {
    type: 'room:state',
    room: serializeRoomState(room),
  });
  broadcastRoomDirectory();
}

function joinRoomWithPlayer(
  room: ServerRoom,
  meta: ConnectedSocketMeta,
  callsignRaw: unknown,
  vehicleRaw: unknown,
  topperRaw: unknown,
): void {
  if (meta.roomId && meta.roomId !== room.roomId) {
    removeClientFromCurrentRoom(meta);
  }

  const existing = room.players.get(meta.clientId);
  if (!existing && room.players.size >= MAX_PLAYERS_PER_ROOM) {
    sendJson(meta.ws, {
      type: 'room:error',
      message: `Room ${room.roomId} is full (${MAX_PLAYERS_PER_ROOM}/${MAX_PLAYERS_PER_ROOM}).`,
    });
    return;
  }

  const callsign = sanitizeCallsign(callsignRaw);
  const vehicleId = sanitizeVehicle(vehicleRaw);
  const topperId = sanitizeTopper(topperRaw);

  if (existing) {
    // Idempotent reconnect / update in place
    existing.ws = meta.ws;
    existing.callsign = callsign;
    existing.vehicleId = vehicleId;
    existing.topperId = topperId;
  } else {
    const { slotIndex, colorHex } = pickAvailableSlotAndColor(room);
    room.players.set(meta.clientId, {
      id: meta.clientId,
      ws: meta.ws,
      slotIndex,
      callsign,
      colorHex,
      vehicleId,
      topperId,
      ready: false,
      score: 0,
      deliveries: 0,
      bullseyes: 0,
      tickets: 0,
      telemetry: null,
      dirtyTelemetry: false,
    });
  }

  meta.roomId = room.roomId;

  const statePayload = serializeRoomState(room);
  broadcastToRoom(room, { type: 'room:state', room: statePayload });
  broadcastRoomDirectory();
}

function launchRoomMatch(
  room: ServerRoom,
  requestedLevel?: number,
  requestedWeather?: unknown,
): void {
  const nextLvl = requestedLevel ?? room.level;
  const meta = computeDistrictMeta(nextLvl);

  room.level = meta.safeLevel;
  room.districtName = meta.districtName;
  if (requestedWeather !== undefined) {
    room.weather = sanitizeWeather(requestedWeather, meta.safeLevel);
  } else if (requestedLevel !== undefined && requestedLevel !== room.level) {
    room.weather = meta.defaultWeather;
  }
  room.seed = generateMatchSeed();
  room.totalStops = meta.stopCount;
  room.activeStopIndex = 1;
  room.timeLimitSec = meta.timeLimitSec;
  room.timeRemainingSec = meta.timeLimitSec;
  room.countdownSec = START_COUNTDOWN_SEC;
  room.claimedStops = {};
  room.outcome = 'none';
  room.standings = [];
  room.status = 'playing';
  room.clockBroadcastAccumMs = 0;

  for (const p of room.players.values()) {
    p.ready = false;
    p.score = 0;
    p.deliveries = 0;
    p.bullseyes = 0;
    p.tickets = 0;
    p.telemetry = null;
    p.dirtyTelemetry = false;
  }

  const serialized = serializeRoomState(room);
  broadcastToRoom(room, { type: 'match:started', room: serialized });
  broadcastRoomDirectory();
}

function finishRoomMatch(room: ServerRoom, outcome: MultiplayerOutcome): void {
  if (room.status === 'finished') return;
  room.status = 'finished';
  room.outcome = outcome;
  room.countdownSec = 0;

  const ceilTimeLeft = Math.max(0, Math.ceil(room.timeRemainingSec));
  const sorted = Array.from(room.players.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.deliveries !== a.deliveries) return b.deliveries - a.deliveries;
    return b.bullseyes - a.bullseyes;
  });

  room.standings = sorted.map((p, idx) => {
    const rank = idx + 1;
    const isWinner = rank === 1 && (p.score > 0 || outcome === 'victory');
    const podiumBonus = rank === 1 ? 65 : rank === 2 ? 35 : 15;
    const victoryBonus =
      outcome === 'victory' ? 40 + Math.round(ceilTimeLeft * 1.2) : 0;
    const coinsEarned = Math.max(
      15,
      p.deliveries * 22 + podiumBonus + victoryBonus,
    );

    return {
      rank,
      id: p.id,
      callsign: p.callsign,
      colorHex: p.colorHex,
      vehicleId: p.vehicleId,
      score: Math.round(p.score),
      deliveries: p.deliveries,
      bullseyes: p.bullseyes,
      tickets: p.tickets,
      coinsEarned,
      isWinner,
    };
  });

  const serialized = serializeRoomState(room);
  broadcastToRoom(room, { type: 'match:finished', room: serialized });
  broadcastRoomDirectory();
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      rooms: rooms.size,
      online: socketMeta.size,
    });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({
      rooms: getPublicRoomSummaries(),
      onlineCount: socketMeta.size,
    });
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const pathname = new URL(
      req.url || '/',
      `http://${req.headers.host || 'localhost'}`,
    ).pathname;
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    const meta: ConnectedSocketMeta = {
      ws,
      clientId: '',
      roomId: null,
      isAlive: true,
    };
    socketMeta.set(ws, meta);

    ws.on('pong', () => {
      meta.isAlive = true;
    });

    // Immediately push initial public room directory
    sendJson(ws, {
      type: 'rooms:updated',
      rooms: getPublicRoomSummaries(),
      onlineCount: socketMeta.size,
    });
    broadcastRoomDirectory();

    ws.on('message', (rawBuf) => {
      let msg: ClientWsMessage;
      try {
        msg = JSON.parse(String(rawBuf)) as ClientWsMessage;
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== 'string') return;

      switch (msg.type) {
        case 'rooms:list': {
          sendJson(ws, {
            type: 'rooms:updated',
            rooms: getPublicRoomSummaries(),
            onlineCount: socketMeta.size,
          });
          break;
        }

        case 'room:quick_join': {
          const cid =
            typeof msg.clientId === 'string' && msg.clientId.length >= 4
              ? msg.clientId.slice(0, 40)
              : 'c_' + Math.random().toString(36).slice(2, 10);
          meta.clientId = cid;

          // Prefer an open public lobby first, then an open public active shift with capacity
          let targetRoom: ServerRoom | null = null;
          for (const r of rooms.values()) {
            if (
              r.isPublic &&
              r.status === 'lobby' &&
              r.players.size < MAX_PLAYERS_PER_ROOM
            ) {
              targetRoom = r;
              break;
            }
          }
          if (!targetRoom) {
            for (const r of rooms.values()) {
              if (
                r.isPublic &&
                r.status === 'playing' &&
                r.players.size < MAX_PLAYERS_PER_ROOM
              ) {
                targetRoom = r;
                break;
              }
            }
          }
          if (!targetRoom) {
            targetRoom = createServerRoom(cid, true, msg.preferredLevel || 1);
          }

          joinRoomWithPlayer(
            targetRoom,
            meta,
            msg.callsign,
            msg.vehicleId,
            msg.topperId,
          );
          break;
        }

        case 'room:create': {
          const cid =
            typeof msg.clientId === 'string' && msg.clientId.length >= 4
              ? msg.clientId.slice(0, 40)
              : 'c_' + Math.random().toString(36).slice(2, 10);
          meta.clientId = cid;
          const room = createServerRoom(
            cid,
            Boolean(msg.isPublic),
            msg.level,
            msg.weather,
          );
          joinRoomWithPlayer(
            room,
            meta,
            msg.callsign,
            msg.vehicleId,
            msg.topperId,
          );
          break;
        }

        case 'room:join': {
          const cid =
            typeof msg.clientId === 'string' && msg.clientId.length >= 4
              ? msg.clientId.slice(0, 40)
              : 'c_' + Math.random().toString(36).slice(2, 10);
          meta.clientId = cid;
          const code = String(msg.roomId || '')
            .trim()
            .toUpperCase()
            .slice(0, 8);
          if (!code) {
            sendJson(ws, {
              type: 'room:error',
              message: 'Please enter a valid 5-character room code.',
            });
            return;
          }
          let room = rooms.get(code);
          // Allow URL-based room codes (?room=CODE) to auto-provision if not yet created
          if (!room && /^[A-Z0-9]{4,8}$/.test(code)) {
            const dMeta = computeDistrictMeta(1);
            room = {
              roomId: code,
              isPublic: false,
              hostId: cid,
              status: 'lobby',
              level: dMeta.safeLevel,
              districtName: dMeta.districtName,
              weather: dMeta.defaultWeather,
              seed: generateMatchSeed(),
              totalStops: dMeta.stopCount,
              activeStopIndex: 1,
              timeLimitSec: dMeta.timeLimitSec,
              timeRemainingSec: dMeta.timeLimitSec,
              countdownSec: 0,
              claimedStops: {},
              players: new Map(),
              outcome: 'none',
              standings: [],
              clockBroadcastAccumMs: 0,
            };
            rooms.set(code, room);
          }
          if (!room) {
            sendJson(ws, {
              type: 'room:error',
              message: `Dispatch room "${code}" was not found.`,
            });
            return;
          }
          joinRoomWithPlayer(
            room,
            meta,
            msg.callsign,
            msg.vehicleId,
            msg.topperId,
          );
          break;
        }

        case 'room:leave': {
          removeClientFromCurrentRoom(meta);
          sendJson(ws, { type: 'room:left' });
          break;
        }

        case 'player:update_profile': {
          if (!meta.roomId) return;
          const room = rooms.get(meta.roomId);
          const player = room?.players.get(meta.clientId);
          if (!room || !player) return;

          if (msg.callsign !== undefined) {
            player.callsign = sanitizeCallsign(msg.callsign);
          }
          if (msg.vehicleId !== undefined) {
            player.vehicleId = sanitizeVehicle(msg.vehicleId);
          }
          if (msg.topperId !== undefined) {
            player.topperId = sanitizeTopper(msg.topperId);
          }
          if (msg.ready !== undefined && room.status === 'lobby') {
            player.ready = Boolean(msg.ready);
          }

          broadcastToRoom(room, {
            type: 'room:state',
            room: serializeRoomState(room),
          });
          broadcastRoomDirectory();

          // Auto-start when 2+ couriers are in lobby and all have marked Ready
          if (room.status === 'lobby' && room.players.size >= 2) {
            const allReady = Array.from(room.players.values()).every(
              (p) => p.ready,
            );
            if (allReady) {
              launchRoomMatch(room);
            }
          }
          break;
        }

        case 'room:set_level': {
          if (!meta.roomId) return;
          const room = rooms.get(meta.roomId);
          if (!room || room.hostId !== meta.clientId || room.status === 'playing') {
            return;
          }
          const dMeta = computeDistrictMeta(msg.level);
          room.level = dMeta.safeLevel;
          room.districtName = dMeta.districtName;
          room.weather =
            msg.weather !== undefined
              ? sanitizeWeather(msg.weather, dMeta.safeLevel)
              : dMeta.defaultWeather;
          room.totalStops = dMeta.stopCount;
          room.timeLimitSec = dMeta.timeLimitSec;
          room.timeRemainingSec = dMeta.timeLimitSec;
          broadcastToRoom(room, {
            type: 'room:state',
            room: serializeRoomState(room),
          });
          broadcastRoomDirectory();
          break;
        }

        case 'room:set_weather': {
          if (!meta.roomId) return;
          const room = rooms.get(meta.roomId);
          if (!room || room.hostId !== meta.clientId || room.status === 'playing') {
            return;
          }
          room.weather = sanitizeWeather(msg.weather, room.level);
          broadcastToRoom(room, {
            type: 'room:state',
            room: serializeRoomState(room),
          });
          broadcastRoomDirectory();
          break;
        }

        case 'match:start': {
          if (!meta.roomId) return;
          const room = rooms.get(meta.roomId);
          if (!room || room.hostId !== meta.clientId) return;
          launchRoomMatch(room, msg.level, msg.weather);
          break;
        }

        case 'match:return_lobby': {
          if (!meta.roomId) return;
          const room = rooms.get(meta.roomId);
          if (!room || room.hostId !== meta.clientId) return;
          room.status = 'lobby';
          room.outcome = 'none';
          room.countdownSec = 0;
          room.claimedStops = {};
          for (const p of room.players.values()) {
            p.ready = false;
          }
          broadcastToRoom(room, {
            type: 'room:state',
            room: serializeRoomState(room),
          });
          broadcastRoomDirectory();
          break;
        }

        case 'player:telemetry': {
          if (!meta.roomId) return;
          const room = rooms.get(meta.roomId);
          const player = room?.players.get(meta.clientId);
          if (!room || !player) return;

          const sanitized = sanitizeTelemetry(msg.telemetry);
          if (sanitized) {
            player.telemetry = sanitized;
            player.dirtyTelemetry = true;
          }
          if (typeof msg.ticketsCount === 'number' && Number.isFinite(msg.ticketsCount)) {
            player.tickets = Math.max(0, Math.min(99, Math.floor(msg.ticketsCount)));
          }
          break;
        }

        case 'player:horn': {
          if (!meta.roomId) return;
          const room = rooms.get(meta.roomId);
          const player = room?.players.get(meta.clientId);
          if (!room || !player) return;
          broadcastToRoom(
            room,
            {
              type: 'player:horned',
              roomId: room.roomId,
              playerId: player.id,
              callsign: player.callsign,
              x: clampFinite(msg.x, 0, -200, 200),
              z: clampFinite(msg.z, 0, -200, 200),
            },
            player.id,
          );
          break;
        }

        case 'stop:claim': {
          if (!meta.roomId) return;
          const room = rooms.get(meta.roomId);
          const player = room?.players.get(meta.clientId);
          if (!room || !player || room.status !== 'playing') return;

          const stopIdx = Math.floor(Number(msg.stopIndex));
          // Server-authoritative idempotency & sequence check: first valid courier claim wins!
          if (
            !Number.isFinite(stopIdx) ||
            stopIdx < 1 ||
            stopIdx > room.totalStops ||
            room.claimedStops[stopIdx] ||
            stopIdx !== room.activeStopIndex
          ) {
            return;
          }

          const pointsAwarded = clampFinite(msg.pointsRequested, 180, 50, 2500);
          const timeBonus = clampFinite(msg.timeBonusSec, 4, 0, 12);
          const isBullseye = Boolean(msg.isBullseye);
          const viaExpressToss = Boolean(msg.viaExpressToss);

          const claim: MultiplayerClaimedStop = {
            stopIndex: stopIdx,
            claimedById: player.id,
            claimedByCallsign: player.callsign,
            claimedByColor: player.colorHex,
            pointsAwarded,
            isBullseye,
            viaExpressToss,
            fromX: clampFinite(msg.fromX, player.telemetry?.x ?? 0, -200, 200),
            fromY: clampFinite(msg.fromY, 1.25, -5, 30),
            fromZ: clampFinite(msg.fromZ, player.telemetry?.z ?? 0, -200, 200),
          };

          room.claimedStops[stopIdx] = claim;
          player.score += pointsAwarded;
          player.deliveries += 1;
          if (isBullseye) {
            player.bullseyes += 1;
          }
          if (typeof msg.ticketsCount === 'number' && Number.isFinite(msg.ticketsCount)) {
            player.tickets = Math.max(0, Math.min(99, Math.floor(msg.ticketsCount)));
          }

          room.timeRemainingSec = Math.min(
            room.timeLimitSec + 24,
            room.timeRemainingSec + timeBonus,
          );

          // Advance to next unclaimed stop
          let nextStop = stopIdx + 1;
          while (nextStop <= room.totalStops && room.claimedStops[nextStop]) {
            nextStop += 1;
          }
          room.activeStopIndex = nextStop;

          broadcastToRoom(room, {
            type: 'stop:claimed',
            roomId: room.roomId,
            claim,
            activeStopIndex: room.activeStopIndex,
            timeRemainingSec: Math.max(0, Math.ceil(room.timeRemainingSec)),
            players: Array.from(room.players.values()).map((p) => ({
              id: p.id,
              score: Math.round(p.score),
              deliveries: p.deliveries,
              bullseyes: p.bullseyes,
              tickets: p.tickets,
            })),
          });

          if (Object.keys(room.claimedStops).length >= room.totalStops) {
            finishRoomMatch(room, 'victory');
          }
          break;
        }
      }
    });

    ws.on('close', () => {
      removeClientFromCurrentRoom(meta);
      socketMeta.delete(ws);
      broadcastRoomDirectory();
    });
  });

  // High-rate 15Hz peer telemetry relay (66ms) — sends only dirty peer updates per room
  setInterval(() => {
    for (const room of rooms.values()) {
      if (room.players.size < 2) continue;
      const dirtyPeers: Array<{
        id: string;
        vehicleId: string;
        topperId: string;
        telemetry: MultiplayerPlayerTelemetry;
      }> = [];

      for (const p of room.players.values()) {
        if (p.dirtyTelemetry && p.telemetry) {
          p.dirtyTelemetry = false;
          dirtyPeers.push({
            id: p.id,
            vehicleId: p.vehicleId,
            topperId: p.topperId,
            telemetry: p.telemetry,
          });
        }
      }

      if (dirtyPeers.length > 0) {
        broadcastToRoom(room, {
          type: 'room:telemetry',
          roomId: room.roomId,
          peers: dirtyPeers,
        });
      }
    }
  }, 66);

  // Authoritative 5Hz (200ms) match clock & countdown simulation
  let lastTickMs = Date.now();
  setInterval(() => {
    const now = Date.now();
    const dtSec = Math.min(0.5, Math.max(0.01, (now - lastTickMs) / 1000));
    lastTickMs = now;

    for (const room of rooms.values()) {
      if (room.status !== 'playing') continue;

      if (room.countdownSec > 0) {
        room.countdownSec = Math.max(0, room.countdownSec - dtSec);
      } else {
        room.timeRemainingSec = Math.max(0, room.timeRemainingSec - dtSec);
      }

      room.clockBroadcastAccumMs += dtSec * 1000;
      if (room.clockBroadcastAccumMs >= 400) {
        room.clockBroadcastAccumMs = 0;
        broadcastToRoom(room, {
          type: 'room:clock',
          roomId: room.roomId,
          countdownSec: Number(room.countdownSec.toFixed(2)),
          timeRemainingSec: Math.max(0, Math.ceil(room.timeRemainingSec)),
        });
      }

      if (room.countdownSec <= 0 && room.timeRemainingSec <= 0) {
        finishRoomMatch(room, 'out_of_time');
      }
    }
  }, 200);

  // Heartbeat ping/pong every 25s to clean up stale connections
  setInterval(() => {
    for (const [ws, meta] of socketMeta.entries()) {
      if (!meta.isAlive) {
        ws.terminate();
        removeClientFromCurrentRoom(meta);
        socketMeta.delete(ws);
        continue;
      }
      meta.isAlive = false;
      ws.ping();
    }
  }, 25_000);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Courier Field server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
