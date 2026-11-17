/**
 * Shared erasable TypeScript protocol types for WebSocket Multiplayer.
 * Uses pure interfaces/types (zero runtime enums) so both Node 22 native strip-types
 * in `server.ts` and Vite client bundles import this module directly.
 */

export type MultiplayerRoomStatus = 'lobby' | 'playing' | 'finished';

export type MultiplayerOutcome = 'none' | 'victory' | 'out_of_time';

export type MultiplayerWeatherCondition =
  | 'clear'
  | 'morning_mist'
  | 'light_snow'
  | 'fjord_drizzle';

export interface MultiplayerPlayerTelemetry {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  speed: number;
  steerAngle: number;
  rollAngle: number;
  pitchAngle: number;
  isBraking: boolean;
  isBoosting: boolean;
  isDrifting: boolean;
  hasBumperShield: boolean;
  distanceTraveled: number;
}

export interface MultiplayerPlayerInfo {
  id: string;
  slotIndex: number;
  callsign: string;
  colorHex: string;
  vehicleId: string;
  topperId: string;
  ready: boolean;
  score: number;
  deliveries: number;
  bullseyes: number;
  tickets: number;
  telemetry: MultiplayerPlayerTelemetry | null;
}

export interface MultiplayerRoomSummary {
  roomId: string;
  isPublic: boolean;
  status: MultiplayerRoomStatus;
  level: number;
  districtName: string;
  weather: MultiplayerWeatherCondition;
  playerCount: number;
  maxPlayers: number;
  hostCallsign: string;
}

export interface MultiplayerClaimedStop {
  stopIndex: number;
  claimedById: string;
  claimedByCallsign: string;
  claimedByColor: string;
  pointsAwarded: number;
  isBullseye: boolean;
  viaExpressToss: boolean;
  fromX: number;
  fromY: number;
  fromZ: number;
}

export interface MultiplayerStanding {
  rank: number;
  id: string;
  callsign: string;
  colorHex: string;
  vehicleId: string;
  score: number;
  deliveries: number;
  bullseyes: number;
  tickets: number;
  coinsEarned: number;
  isWinner: boolean;
}

export interface MultiplayerRoomState {
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
  players: MultiplayerPlayerInfo[];
  outcome: MultiplayerOutcome;
  standings: MultiplayerStanding[];
}

export type ClientWsMessage =
  | { type: 'rooms:list' }
  | {
      type: 'room:quick_join';
      clientId: string;
      callsign: string;
      vehicleId: string;
      topperId: string;
      preferredLevel: number;
    }
  | {
      type: 'room:create';
      clientId: string;
      callsign: string;
      vehicleId: string;
      topperId: string;
      isPublic: boolean;
      level: number;
      weather?: MultiplayerWeatherCondition;
    }
  | {
      type: 'room:join';
      roomId: string;
      clientId: string;
      callsign: string;
      vehicleId: string;
      topperId: string;
    }
  | { type: 'room:leave' }
  | {
      type: 'player:update_profile';
      callsign?: string;
      vehicleId?: string;
      topperId?: string;
      ready?: boolean;
    }
  | { type: 'room:set_level'; level: number; weather?: MultiplayerWeatherCondition }
  | { type: 'room:set_weather'; weather: MultiplayerWeatherCondition }
  | { type: 'match:start'; level?: number; weather?: MultiplayerWeatherCondition }
  | { type: 'match:return_lobby' }
  | {
      type: 'player:telemetry';
      telemetry: MultiplayerPlayerTelemetry;
      ticketsCount?: number;
    }
  | { type: 'player:horn'; x: number; z: number }
  | {
      type: 'stop:claim';
      stopIndex: number;
      viaExpressToss: boolean;
      isBullseye: boolean;
      pointsRequested: number;
      timeBonusSec: number;
      ticketsCount: number;
      fromX: number;
      fromY: number;
      fromZ: number;
    };

export type ServerWsMessage =
  | {
      type: 'rooms:updated';
      rooms: MultiplayerRoomSummary[];
      onlineCount: number;
    }
  | { type: 'room:state'; room: MultiplayerRoomState }
  | { type: 'room:left' }
  | { type: 'room:error'; message: string }
  | { type: 'match:started'; room: MultiplayerRoomState }
  | {
      type: 'room:clock';
      roomId: string;
      countdownSec: number;
      timeRemainingSec: number;
    }
  | {
      type: 'room:telemetry';
      roomId: string;
      peers: Array<{
        id: string;
        vehicleId: string;
        topperId: string;
        telemetry: MultiplayerPlayerTelemetry;
      }>;
    }
  | {
      type: 'player:horned';
      roomId: string;
      playerId: string;
      callsign: string;
      x: number;
      z: number;
    }
  | {
      type: 'stop:claimed';
      roomId: string;
      claim: MultiplayerClaimedStop;
      activeStopIndex: number;
      timeRemainingSec: number;
      players: Array<{
        id: string;
        score: number;
        deliveries: number;
        bullseyes: number;
        tickets: number;
      }>;
    }
  | { type: 'match:finished'; room: MultiplayerRoomState };
