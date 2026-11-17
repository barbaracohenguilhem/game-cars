import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  ClipboardCheck,
  Clock,
  Navigation,
  Package,
  Pause,
  RotateCcw,
  Shield,
  Timer,
  Users,
  Volume2,
  VolumeX,
  Warehouse,
  Zap,
} from 'lucide-react';
import type { MultiplayerRoomState } from '../game/multiplayerTypes';
import { resetTouchControls, touchControls } from '../game/touchControls';
import {
  GeneratedCity,
  HazardKind,
  HudState,
  ParcelKind,
  PersonAppearance,
  SignalAxisState,
  TILE_SIZE,
  TileType,
} from '../game/types';

export interface MinimapRemotePlayer {
  id: string;
  x: number;
  z: number;
  yaw: number;
  colorHex: string;
  callsign: string;
}

export interface MinimapSnapshot {
  city: GeneratedCity | null;
  truckX: number;
  truckZ: number;
  truckYaw: number;
  activeStopIndex: number;
  remotePlayers?: MinimapRemotePlayer[];
}

interface GameHudProps {
  hud: HudState;
  minimapRef: React.RefObject<MinimapSnapshot>;
  muted: boolean;
  hasClaimableQuest: boolean;
  hasFreeSpin: boolean;
  multiplayerRoom?: MultiplayerRoomState | null;
  localClientId?: string;
  onToggleMute: () => void;
  onPause: () => void;
  onOpenQuests: () => void;
  onOpenShop: () => void;
  onOpenMultiplayer?: () => void;
  onRestart: () => void;
}

function toHexColor(num: number): string {
  return '#' + num.toString(16).padStart(6, '0');
}

function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, Math.ceil(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function triggerWindowKeyPulse(code: string): void {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }),
  );
  window.setTimeout(() => {
    window.dispatchEvent(
      new KeyboardEvent('keyup', { code, bubbles: true, cancelable: true }),
    );
  }, 65);
}

const CustomerPortraitSvg: React.FC<{ appearance: PersonAppearance | null }> = ({
  appearance,
}) => {
  const skin = appearance ? toHexColor(appearance.skinColor) : '#f2d3be';
  const hair = appearance ? toHexColor(appearance.hairColor) : '#46372d';
  const top = appearance ? toHexColor(appearance.topColor) : '#3b5b7e';
  const accent = appearance ? toHexColor(appearance.accentColor) : '#c84b31';
  const isHat =
    appearance?.hairStyle === 'cap' || appearance?.hairStyle === 'sunhat';

  return (
    <svg
      viewBox="0 0 40 40"
      className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg bg-[#eae6dd] border border-white/20"
      aria-hidden="true"
    >
      <path
        d="M8 39c1-7 5.5-10.5 12-10.5S31 32 32 39"
        fill={top}
        stroke="#181d23"
        strokeWidth="1.5"
      />
      <path
        d="M16.5 29.2l3.5 3 3.5-3"
        stroke="#f5f3ee"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle
        cx="20"
        cy="19"
        r="8.2"
        fill={skin}
        stroke="#181d23"
        strokeWidth="1.5"
      />
      {isHat ? (
        <>
          <path
            d="M11.5 16c0-5.2 3.8-8.6 8.5-8.6s8.5 3.4 8.5 8.6h-17z"
            fill={accent}
            stroke="#181d23"
            strokeWidth="1.5"
          />
          <rect
            x="9"
            y="14.5"
            width="22"
            height="2.6"
            rx="1.3"
            fill={appearance?.hairStyle === 'sunhat' ? '#e2cb9c' : accent}
            stroke="#181d23"
            strokeWidth="1.4"
          />
        </>
      ) : (
        <path
          d="M11.8 18c0-5.8 3.7-9.2 8.2-9.2s8.2 3.4 8.2 9.2c-1.9-2.1-4.8-3-8.2-3s-6.3.9-8.2 3z"
          fill={hair}
          stroke="#181d23"
          strokeWidth="1.5"
        />
      )}
      <circle cx="17.2" cy="19.5" r="1.2" fill="#181d23" />
      <circle cx="22.8" cy="19.5" r="1.2" fill="#181d23" />
      <path
        d="M18 23.2q2 1.4 4 0"
        stroke="#6b3e2e"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
};

/** Crisp static Signal Orange indicator dot (zero pulsing slop) */
const SignalDot: React.FC = () => (
  <span
    className="w-2.5 h-2.5 rounded-full bg-[#ff551e] border border-[#181d23] absolute -top-1 -right-1 pointer-events-none"
    aria-hidden="true"
  />
);

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  minimapRef,
  muted,
  hasClaimableQuest,
  hasFreeSpin,
  multiplayerRoom = null,
  localClientId = '',
  onToggleMute,
  onPause,
  onOpenQuests,
  onOpenShop,
  onOpenMultiplayer,
  onRestart,
}) => {
  const mapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const steerRockerRef = useRef<HTMLDivElement | null>(null);
  const steerPointerIdRef = useRef<number | null>(null);
  const gasPointerIdRef = useRef<number | null>(null);
  const brakePointerIdRef = useRef<number | null>(null);

  const [steerUiSide, setSteerUiSide] = useState<'none' | 'left' | 'right'>(
    'none',
  );
  const [gasPressed, setGasPressed] = useState(false);
  const [brakePressed, setBrakePressed] = useState(false);

  useEffect(() => {
    return () => {
      resetTouchControls();
    };
  }, []);

  const updateSteerFromClientX = (clientX: number) => {
    const el = steerRockerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const norm = ((clientX - rect.left) / rect.width) * 2 - 1;
    if (Math.abs(norm) < 0.08) {
      touchControls.steerAnalog = 0;
      touchControls.steerLeft = false;
      touchControls.steerRight = false;
      setSteerUiSide('none');
    } else if (norm < 0) {
      const mag = Math.min(1, Math.max(0.45, Math.abs(norm) * 1.25));
      touchControls.steerAnalog = -mag;
      touchControls.steerLeft = true;
      touchControls.steerRight = false;
      setSteerUiSide('left');
    } else {
      const mag = Math.min(1, Math.max(0.45, Math.abs(norm) * 1.25));
      touchControls.steerAnalog = mag;
      touchControls.steerLeft = false;
      touchControls.steerRight = true;
      setSteerUiSide('right');
    }
  };

  const releaseSteerRocker = () => {
    steerPointerIdRef.current = null;
    touchControls.steerTouchActive = false;
    touchControls.steerAnalog = 0;
    touchControls.steerLeft = false;
    touchControls.steerRight = false;
    setSteerUiSide('none');
  };

  const isLowTime = hud.timeRemainingSec <= 12;
  const isCriticalHealth = hud.health === 1;
  const deliveryPct = Math.round(
    (hud.deliveredCount / Math.max(1, hud.totalStops)) * 100,
  );
  const boostPct = Math.round(Math.max(0, Math.min(1, hud.boostCharge)) * 100);
  const streakMultiplier = Math.max(1, hud.combo + 1);
  const compassDeg = (hud.bearingToStopRad * 180) / Math.PI;
  const isPreGoCountdown =
    hud.countdownStage !== null &&
    hud.countdownStage !== undefined &&
    hud.countdownStage > 0;
  const showMobileBanner =
    Boolean(hud.bannerEvent) &&
    hud.countdownStage === null &&
    hud.bannerEvent?.label !== 'Rocket Start!';

  const activeRewardPoints =
    hud.nextParcelKind === ParcelKind.Large
      ? 260
      : hud.nextParcelKind === ParcelKind.HotExpress
        ? hud.thermalPct > 0
          ? 320
          : 210
        : hud.nextParcelKind === ParcelKind.Fragile
          ? hud.fragileIntact
            ? 275
            : 185
          : 150;

  // Lightweight 10Hz 2D Canvas Heading-Up Architectural GPS Radar
  useEffect(() => {
    let pulseTick = 0;
    const drawMap = () => {
      const cvs = mapCanvasRef.current;
      const snap = minimapRef.current;
      if (!cvs || !snap || !snap.city) return;
      const ctx = cvs.getContext('2d');
      if (!ctx) return;

      pulseTick += 1;
      const city = snap.city;
      const N = city.totalGridSize;
      const size = cvs.width;
      const cell = 5.2;

      const worldToMap = (wx: number, wz: number) => {
        const half = (N - 1) * 0.5;
        const gc = wx / TILE_SIZE + half;
        const gr = wz / TILE_SIZE + half;
        return {
          mx: (gc + 0.5) * cell,
          my: (gr + 0.5) * cell,
        };
      };

      const vanPt = worldToMap(snap.truckX, snap.truckZ);
      const vanScreenX = size * 0.5;
      const vanScreenY = size * 0.62;

      // Deep Nordic Fjord Slate Water
      ctx.fillStyle = '#243442';
      ctx.fillRect(0, 0, size, size);

      ctx.save();
      ctx.translate(vanScreenX, vanScreenY);
      ctx.rotate(snap.truckYaw + Math.PI);
      ctx.translate(-vanPt.mx, -vanPt.my);

      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const t = city.tiles[r][c];
          if (t === TileType.Water) continue;
          if (t === TileType.InnerRoad || t === TileType.OuterRoad) {
            ctx.fillStyle = '#efede8';
          } else if (t === TileType.Bridge) {
            ctx.fillStyle = '#d4c3a9';
          } else if (t === TileType.Building) {
            ctx.fillStyle = '#8c969e';
          } else {
            ctx.fillStyle = '#697d64';
          }
          ctx.fillRect(
            c * cell,
            r * cell,
            Math.ceil(cell) + 0.4,
            Math.ceil(cell) + 0.4,
          );
        }
      }

      for (const sig of city.trafficSignals) {
        const { mx, my } = worldToMap(sig.x, sig.z);
        const ewGo =
          sig.state === SignalAxisState.EWGreen ||
          sig.state === SignalAxisState.EWYellow;
        ctx.fillStyle = ewGo ? '#16a34a' : '#dc2626';
        ctx.fillRect(mx - 2.0, my - 2.0, 4.0, 4.0);
      }

      for (const kiosk of city.coffeeKiosks) {
        if (kiosk.cooldown > 0) continue;
        const { mx, my } = worldToMap(kiosk.roadX, kiosk.roadZ);
        ctx.fillStyle = '#2a9d8f';
        ctx.strokeStyle = '#181d23';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.arc(mx, my, 2.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      for (const gar of city.mechanicGarages) {
        if (gar.cooldown > 0) continue;
        const { mx, my } = worldToMap(gar.roadX, gar.roadZ);
        ctx.fillStyle = '#3b82f6';
        ctx.strokeStyle = '#181d23';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.arc(mx, my, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      if (
        city.rivalCourier &&
        !city.rivalCourier.bonusClaimed &&
        !city.rivalCourier.rivalWonBonus
      ) {
        const bp = worldToMap(
          city.rivalCourier.bonusDropPos.x,
          city.rivalCourier.bonusDropPos.z,
        );
        ctx.fillStyle = '#eab308';
        ctx.strokeStyle = '#181d23';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(bp.mx, bp.my, 2.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const rv = worldToMap(city.rivalCourier.x, city.rivalCourier.z);
        ctx.fillStyle = '#c84b31';
        ctx.beginPath();
        ctx.arc(rv.mx, rv.my, 2.3, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const h of city.hazards) {
        const { mx, my } = worldToMap(h.x, h.z);
        ctx.fillStyle =
          h.kind === HazardKind.BridgeGate ? '#eab308' : '#dc2626';
        ctx.beginPath();
        ctx.arc(mx, my, 2.0, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const stop of city.stops) {
        const mx = (stop.roadCoord.col + 0.5) * cell;
        const my = (stop.roadCoord.row + 0.5) * cell;
        if (stop.delivered) {
          ctx.fillStyle = '#16a34a';
          ctx.beginPath();
          ctx.arc(mx, my, 2.7, 0, Math.PI * 2);
          ctx.fill();
        } else if (stop.index === snap.activeStopIndex) {
          const ringR = 5.4 + Math.sin(pulseTick * 0.5) * 1.6;
          ctx.strokeStyle = '#ff551e';
          ctx.lineWidth = 1.9;
          ctx.beginPath();
          ctx.arc(mx, my, ringR, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#ff551e';
          ctx.strokeStyle = '#181d23';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(mx, my, 3.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillStyle = '#f5f3ee';
          ctx.strokeStyle = '#181d23';
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      // Remote Multiplayer Courier Chevrons in world space
      if (snap.remotePlayers && snap.remotePlayers.length > 0) {
        for (const rp of snap.remotePlayers) {
          const rpt = worldToMap(rp.x, rp.z);
          ctx.save();
          ctx.translate(rpt.mx, rpt.my);
          ctx.rotate(-rp.yaw + Math.PI);
          ctx.fillStyle = rp.colorHex || '#2a9d8f';
          ctx.strokeStyle = '#181d23';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(0, -4.8);
          ctx.lineTo(-3.4, 3.6);
          ctx.lineTo(0, 1.7);
          ctx.lineTo(3.4, 3.6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.restore();

      // Heading-Up Courier Van Chevron
      ctx.save();
      ctx.translate(vanScreenX, vanScreenY);
      ctx.fillStyle = '#ff551e';
      ctx.strokeStyle = '#f5f3ee';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -5.8);
      ctx.lineTo(-4.2, 4.2);
      ctx.lineTo(0, 2.0);
      ctx.lineTo(4.2, 4.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    drawMap();
    const id = window.setInterval(drawMap, 100);
    return () => window.clearInterval(id);
  }, [minimapRef]);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 select-none">
      {/* Subtle critical hull frame cue */}
      {isCriticalHealth && (
        <div
          className="fixed inset-0 pointer-events-none border-4 border-[#dc2626]/55"
          aria-hidden="true"
        />
      )}

      {/* TOP TELEMETRY BAR (Hidden on mobile during 3-2-1 countdown) */}
      <div
        className={`${
          isPreGoCountdown ? 'hidden md:flex' : 'flex'
        } flex-col gap-1.5`}
      >
        <div className="flex items-start justify-between gap-2">
          {/* LEFT CLUSTER: Stage/Stops + Coins + Hull + Pause + Tactical Quick Actions */}
          <div className="flex flex-col items-start gap-1.5 md:gap-2 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Stage & Delivery Progress Instrument */}
              <div
                className="tactical-panel rounded-xl h-9 md:h-10 px-2.5 md:px-3.5 flex items-center gap-2 md:gap-3"
                aria-label={`Stage ${hud.level}, Deliveries ${hud.deliveredCount} of ${hud.totalStops}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 md:w-6 md:h-6 rounded-md bg-[#ff551e] text-white font-mono-num font-semibold text-xs md:text-sm flex items-center justify-center leading-none">
                    {hud.level}
                  </span>
                  <span className="hidden sm:inline font-mono-num text-[10px] uppercase tracking-wider text-[#9ba3ae]">
                    Drops
                  </span>
                </div>

                <div className="w-12 sm:w-16 md:w-22 h-1.5 bg-white/15 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#ff551e] transition-all duration-200"
                    style={{ width: `${deliveryPct}%` }}
                  />
                </div>

                <span className="font-mono-num text-xs md:text-sm font-semibold text-[#f4f3ef] leading-none">
                  {hud.deliveredCount}/{hud.totalStops}
                </span>
              </div>

              {/* Coins Instrument */}
              <div
                className="tactical-panel rounded-xl h-9 md:h-10 px-2.5 md:px-3.5 flex items-center gap-2"
                aria-label={`Coins ${hud.coins}, Score ${hud.score}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full bg-[#eab308] shrink-0"
                  aria-hidden="true"
                />
                <span className="font-mono-num text-xs sm:text-sm md:text-base font-semibold text-[#f4f3ef] leading-none">
                  {hud.coins.toLocaleString()}
                </span>
              </div>

              {/* Hull Integrity + Pause Control */}
              <div className="flex items-center gap-1.5">
                <div
                  className="tactical-panel rounded-xl h-9 md:h-10 px-2.5 md:px-3.5 flex items-center gap-1.5 md:gap-2"
                  aria-label={`Van integrity ${hud.health} of ${hud.maxHealth}${
                    hud.hasBumperShield ? ', bumper shield active' : ''
                  }`}
                >
                  <Shield
                    className={`w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 ${
                      hud.hasBumperShield
                        ? 'text-[#38bdf8]'
                        : isCriticalHealth
                          ? 'text-[#ff551e]'
                          : 'text-[#9ba3ae]'
                    }`}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span
                    className={`font-mono-num text-xs sm:text-sm md:text-base font-semibold leading-none ${
                      isCriticalHealth ? 'text-[#ff551e]' : 'text-[#f4f3ef]'
                    }`}
                  >
                    {hud.health}/{hud.maxHealth}
                  </span>
                  {hud.hasBumperShield && (
                    <span
                      className="w-2 h-2 rounded-full bg-[#38bdf8] shrink-0"
                      title="Bumper Shield Active"
                    />
                  )}
                </div>

                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Pause game [P]"
                  title="Pause [P]"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onPause();
                  }}
                  className="pointer-events-auto tactical-btn w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center cursor-pointer"
                >
                  <Pause
                    className="w-4 h-4 text-[#f4f3ef]"
                    strokeWidth={2.2}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>

            {/* Tactical Quick-Action Strip */}
            <div className="pointer-events-auto flex items-center gap-1.5">
              {/* Desktop Turbo Trigger */}
              <button
                type="button"
                tabIndex={-1}
                aria-label="Trigger turbo boost [Shift]"
                title="Turbo Boost [Shift]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  touchControls.boostPulse = true;
                  triggerWindowKeyPulse('ShiftLeft');
                }}
                className="hidden md:flex tactical-btn rounded-lg px-2.5 py-1.5 items-center gap-1.5 relative cursor-pointer"
              >
                {hud.boostReady && <SignalDot />}
                <Zap
                  className={`w-3.5 h-3.5 ${
                    hud.isBoosting
                      ? 'text-[#4ade80]'
                      : hud.boostReady
                        ? 'text-[#ff551e]'
                        : 'text-[#9ba3ae]'
                  }`}
                  strokeWidth={2.1}
                  aria-hidden="true"
                />
                <span className="font-mono-num text-[11px] font-semibold uppercase tracking-wider text-[#f4f3ef]">
                  {hud.isBoosting ? 'Active' : 'Boost'}
                </span>
              </button>

              {/* Retry Stage */}
              <button
                type="button"
                tabIndex={-1}
                aria-label="Restart level [R]"
                title="Restart Stage [R]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onRestart();
                }}
                className="tactical-btn rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw
                  className="w-3.5 h-3.5 text-[#9ba3ae]"
                  strokeWidth={2.1}
                  aria-hidden="true"
                />
                <span className="font-mono-num text-[11px] font-semibold uppercase tracking-wider text-[#f4f3ef]">
                  Retry
                </span>
              </button>

              {/* Shift Manifest & Bounties */}
              <button
                type="button"
                tabIndex={-1}
                aria-label="Open shift quests and rules [J]"
                title="Shift Manifest & Field Guide [J]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenQuests();
                }}
                className="tactical-btn rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 relative cursor-pointer"
              >
                {(hasClaimableQuest || hud.ticketsCount > 0) && <SignalDot />}
                <ClipboardCheck
                  className="w-3.5 h-3.5 text-[#9ba3ae]"
                  strokeWidth={2.1}
                  aria-hidden="true"
                />
                <span className="font-mono-num text-[11px] font-semibold uppercase tracking-wider text-[#f4f3ef]">
                  Manifest
                </span>
              </button>

              {/* Multiplayer Dispatch Button */}
              {onOpenMultiplayer && (
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="hud-multiplayer-btn"
                  aria-label="Open multiplayer dispatch [L]"
                  title="Multiplayer Dispatch [L]"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenMultiplayer();
                  }}
                  className="tactical-btn rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 relative cursor-pointer"
                >
                  {multiplayerRoom && (
                    <span
                      className="w-2 h-2 rounded-full bg-[#16a34a]"
                      aria-hidden="true"
                    />
                  )}
                  <Users
                    className={`w-3.5 h-3.5 ${
                      multiplayerRoom ? 'text-[#4ade80]' : 'text-[#9ba3ae]'
                    }`}
                    strokeWidth={2.1}
                    aria-hidden="true"
                  />
                  <span className="font-mono-num text-[11px] font-semibold uppercase tracking-wider text-[#f4f3ef]">
                    {multiplayerRoom ? multiplayerRoom.roomId : 'Multi'}
                  </span>
                </button>
              )}
            </div>

            {/* Live Multiplayer Standings Card */}
            {multiplayerRoom && multiplayerRoom.players.length > 0 && (
              <div className="tactical-panel rounded-xl px-3 py-2 flex flex-col gap-1 min-w-[188px] max-w-[235px]">
                <div className="flex items-center justify-between gap-2 font-mono-num text-[10px] uppercase tracking-wider text-[#9ba3ae]">
                  <span>Room {multiplayerRoom.roomId}</span>
                  <span>{multiplayerRoom.players.length}/6 Live</span>
                </div>
                {[...multiplayerRoom.players]
                  .sort((a, b) =>
                    b.score !== a.score
                      ? b.score - a.score
                      : b.deliveries - a.deliveries,
                  )
                  .slice(0, 4)
                  .map((pl) => {
                    const isMe = pl.id === localClientId;
                    return (
                      <div
                        key={pl.id}
                        className="flex items-center justify-between gap-2 font-mono-num text-[11px] leading-tight"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: pl.colorHex }}
                            aria-hidden="true"
                          />
                          <span
                            className={`truncate ${
                              isMe
                                ? 'font-bold text-white'
                                : 'font-medium text-[#f4f3ef]/85'
                            }`}
                          >
                            {pl.callsign}
                          </span>
                        </div>
                        <span className="text-[#9ba3ae] shrink-0">
                          <strong className="text-[#f4f3ef]">
                            {pl.deliveries}
                          </strong>{' '}
                          · {pl.score}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* CENTER EPHEMERAL CALLOUTS ON DESKTOP (md+) */}
          <div className="hidden md:flex flex-col items-center gap-1.5">
            {hud.isWrongWay && (
              <div className="tactical-panel rounded-xl px-3.5 py-1.5 flex items-center gap-3 border-[#dc2626]/65 whitespace-nowrap">
                <span className="font-mono-num text-xs font-semibold uppercase tracking-wider text-[#f87171]">
                  Wrong Lane · Keep Right
                </span>
                <span className="w-16 h-1.5 bg-white/15 rounded-full overflow-hidden">
                  <span
                    className="block h-full bg-[#ff551e] transition-all duration-75"
                    style={{
                      width: `${Math.round(
                        Math.min(100, hud.wrongWayProgress * 100),
                      )}%`,
                    }}
                  />
                </span>
              </div>
            )}

            {hud.bannerEvent && (
              <div
                key={hud.bannerEvent.id}
                className="tactical-panel rounded-xl px-3.5 py-1.5 flex items-center gap-2.5 whitespace-nowrap"
              >
                <span
                  className={`font-display text-xs sm:text-sm font-semibold ${
                    hud.bannerEvent.tone === 'emerald'
                      ? 'text-[#4ade80]'
                      : hud.bannerEvent.tone === 'amber'
                        ? 'text-[#facc15]'
                        : 'text-[#fb7185]'
                  }`}
                >
                  {hud.bannerEvent.label}
                </span>
                <span className="font-mono-num text-xs text-[#f4f3ef]/85">
                  {hud.bannerEvent.detail}
                </span>
              </div>
            )}
          </div>

          {/* TOP-RIGHT: Boost/Fever Telemetry + Shift Clock + Score/Wave/Citations */}
          <div className="flex flex-col items-end shrink-0 gap-1.5">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Desktop Boost & Multiplier Meter */}
              <button
                type="button"
                tabIndex={-1}
                aria-label="Activate turbo boost [Shift]"
                title="Turbo Boost [Shift]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  touchControls.boostPulse = true;
                  triggerWindowKeyPulse('ShiftLeft');
                }}
                className="hidden md:flex pointer-events-auto tactical-btn rounded-xl h-10 px-3.5 relative overflow-hidden items-center gap-2.5 cursor-pointer"
              >
                <div
                  role="progressbar"
                  aria-label="Turbo boost charge"
                  aria-valuenow={boostPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="flex items-center gap-2"
                >
                  <span className="font-mono-num text-xs font-semibold text-[#9ba3ae]">
                    x{streakMultiplier}
                  </span>
                  <span
                    className={`font-display text-sm font-bold tracking-wide uppercase ${
                      hud.isFever
                        ? 'text-[#ff551e]'
                        : hud.isBoosting
                          ? 'text-[#4ade80]'
                          : hud.boostReady
                            ? 'text-[#facc15]'
                            : 'text-[#f4f3ef]/75'
                    }`}
                  >
                    {hud.isFever ? 'Fever' : 'Boost'}
                  </span>
                </div>
                <span className="absolute left-0 right-0 bottom-0 h-[3px] bg-white/10">
                  <span
                    className={`block h-full transition-all duration-100 ${
                      hud.isFever || hud.boostReady
                        ? 'bg-[#ff551e]'
                        : hud.isBoosting
                          ? 'bg-[#4ade80]'
                          : 'bg-[#eab308]'
                    }`}
                    style={{
                      width: `${hud.boostReady || hud.isBoosting ? 100 : boostPct}%`,
                    }}
                  />
                </span>
              </button>

              {/* Shift Countdown Clock */}
              <div className="tactical-panel rounded-xl h-9 md:h-10 px-2.5 md:px-3.5 flex items-center gap-1.5 md:gap-2">
                <Clock
                  className={`w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 ${
                    isLowTime ? 'text-[#ff551e]' : 'text-[#9ba3ae]'
                  }`}
                  strokeWidth={2.1}
                  aria-hidden="true"
                />
                <span
                  className={`font-mono-num text-sm sm:text-base md:text-lg font-semibold leading-none ${
                    isLowTime ? 'text-[#ff551e]' : 'text-[#f4f3ef]'
                  }`}
                  aria-label={`${hud.timeRemainingSec} seconds left`}
                >
                  {formatClock(hud.timeRemainingSec)}
                </span>
              </div>
            </div>

            {/* Tabular Score · Wave · Citation Readout */}
            <div className="tactical-panel rounded-lg px-2.5 py-1 flex items-center gap-1.5 font-mono-num text-[10px] md:text-[11px] leading-none">
              <span className="font-semibold text-[#f4f3ef]">
                {hud.score.toLocaleString()} PTS
              </span>
              {hud.greenWaveTimer > 0 && (
                <span className="font-semibold text-[#4ade80]">· WAVE</span>
              )}
              {hud.ticketsCount > 0 && (
                <span className="font-semibold text-[#f87171]">
                  · {hud.ticketsCount} TKT
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CENTER TACTICAL 3 - 2 - 1 - GO LAUNCH MODULE */}
      {hud.countdownStage !== null && hud.countdownStage !== undefined && (
        <div
          key={`cd-${hud.countdownStage}`}
          data-testid="hud-countdown-badge"
          className={`pointer-events-none fixed inset-0 flex flex-col items-center z-30 px-4 ${
            hud.countdownStage > 0
              ? 'justify-center pb-6 md:pb-0 md:justify-start md:pt-20'
              : 'justify-start pt-14 md:pt-20'
          }`}
        >
          <div
            className={`tactical-panel rounded-2xl px-8 py-4 sm:px-11 sm:py-5 min-w-[180px] sm:min-w-[240px] flex flex-col items-center border ${
              hud.countdownStage === 0
                ? 'border-[#16a34a]/80'
                : hud.rocketStartStatus === 'primed'
                  ? 'border-[#ff551e]/80'
                  : 'border-white/15'
            }`}
          >
            <span className="font-mono-num text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.16em] text-[#9ba3ae] mb-1">
              {hud.countdownStage === 0
                ? hud.rocketStartStatus === 'launched'
                  ? 'Rocket Launch Engaged'
                  : 'Shift Active'
                : `Stage ${String(hud.level).padStart(2, '0')} · ${hud.districtName}`}
            </span>

            <span
              className={`font-display font-bold tracking-tight leading-none ${
                hud.countdownStage === 0
                  ? 'text-[#4ade80] text-4xl sm:text-6xl'
                  : hud.countdownStage === 1
                    ? 'text-[#ff551e] text-5xl sm:text-6xl'
                    : 'text-[#f4f3ef] text-5xl sm:text-6xl'
              }`}
            >
              {hud.countdownStage === 0 ? 'GO' : hud.countdownStage}
            </span>
          </div>

          {hud.countdownStage > 0 && (
            <div className="mt-2.5 tactical-panel rounded-lg px-3.5 py-1.5">
              <span
                className={`font-mono-num text-[11px] sm:text-xs font-medium uppercase tracking-wider ${
                  hud.rocketStartStatus === 'primed'
                    ? 'text-[#4ade80]'
                    : hud.rocketStartStatus === 'sputter'
                      ? 'text-[#f87171]'
                      : hud.countdownStage === 1
                        ? 'text-[#ff551e]'
                        : 'text-[#f4f3ef]'
                }`}
              >
                {hud.rocketStartStatus === 'primed' ? (
                  'Launch Primed · Hold Throttle'
                ) : hud.rocketStartStatus === 'sputter' ? (
                  'Early Input · Release & Hold on 1'
                ) : hud.countdownStage === 1 ? (
                  <>
                    <span className="md:hidden">
                      Hold Screen Now for Rocket Start
                    </span>
                    <span className="hidden md:inline">
                      Hold Drive [W / ↑] Now for Rocket Start
                    </span>
                  </>
                ) : (
                  'Scan Route · Engage Throttle on 1'
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {/* BOTTOM PERIMETER: Desktop Tactical Console (md+) + Mobile Dual-Thumb Deck (<md) + GPS Radar */}
      <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-2 md:gap-3">
        {/* Left spacer on desktop to center the primary dispatch console */}
        <div className="hidden lg:block w-[122px] shrink-0" aria-hidden="true" />

        {/* DESKTOP BOTTOM CONSOLE (md+) */}
        <div className="hidden md:flex pointer-events-auto items-end gap-3 mx-auto">
          {/* 45s Autonomous Demo Reel Toggle */}
          <button
            type="button"
            tabIndex={-1}
            data-testid="hud-demo-timer-btn"
            aria-label={
              hud.demoActive
                ? 'Stop 45s demo reel [T]'
                : 'Start 45s demo reel [T]'
            }
            title={
              hud.demoActive
                ? 'Stop Demo Reel [T / Esc]'
                : '45s Autonomous Demo Reel [T]'
            }
            onClick={(e) => {
              e.currentTarget.blur();
              touchControls.demoTogglePulse = true;
            }}
            className={`tactical-btn h-13 px-3.5 rounded-xl flex flex-col items-center justify-center gap-0.5 shrink-0 cursor-pointer ${
              hud.demoActive ? 'ring-2 ring-[#16a34a]' : ''
            }`}
          >
            <Timer
              className={`w-4 h-4 ${
                hud.demoActive ? 'text-[#4ade80]' : 'text-[#9ba3ae]'
              }`}
              strokeWidth={2}
              aria-hidden="true"
            />
            <span className="font-mono-num text-[11px] font-semibold text-[#f4f3ef] leading-none">
              {hud.demoActive ? `${hud.demoRemainingSec ?? 45}s` : '45s'}
            </span>
          </button>

          {/* Audio Mute Toggle */}
          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? 'Unmute audio [M]' : 'Mute audio [M]'}
            title="Mute / Unmute [M]"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="tactical-btn w-13 h-13 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
          >
            {muted ? (
              <VolumeX
                className="w-5 h-5 text-[#ff551e]"
                strokeWidth={2}
                aria-hidden="true"
              />
            ) : (
              <Volume2
                className="w-5 h-5 text-[#f4f3ef]"
                strokeWidth={2}
                aria-hidden="true"
              />
            )}
          </button>

          {/* Courtesy Bell */}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Ring courtesy bell [Q]"
            title="Courtesy Bell [Q] — Calms Scooters & Clears Crossings"
            onClick={(e) => {
              e.currentTarget.blur();
              touchControls.hornPulse = true;
              triggerWindowKeyPulse('KeyQ');
            }}
            className="tactical-btn w-13 h-13 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Bell
              className="w-5 h-5 text-[#f4f3ef]"
              strokeWidth={2}
              aria-hidden="true"
            />
          </button>

          {/* Central Curbside Dispatch Console */}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Deliver parcel to active stop [Space]"
            onClick={(e) => {
              e.currentTarget.blur();
              touchControls.deliverPulse = true;
              triggerWindowKeyPulse('Space');
            }}
            className={`${
              hud.canBullseyeToss
                ? 'btn-signal'
                : hud.canExpressToss
                  ? 'btn-pine'
                  : 'tactical-btn'
            } rounded-xl px-4 py-2.5 min-w-[368px] flex flex-col gap-1.5 cursor-pointer`}
          >
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-2.5 min-w-0">
                <CustomerPortraitSvg appearance={hud.nextStopAppearance} />
                <div className="text-left min-w-0">
                  <div className="font-display text-sm sm:text-[15px] font-semibold text-white leading-tight truncate">
                    #{hud.nextStopIndex} {hud.nextCustomerName}
                    {hud.nextVipRole !== 'none' ? ' · VIP' : ''}
                  </div>
                  <div className="font-mono-num text-[11px] text-white/80 truncate mt-0.5 max-w-[195px]">
                    {hud.nextParcelKind === ParcelKind.HotExpress
                      ? `THERMAL ${Math.round(hud.thermalPct * 100)}% · ${hud.nextParcelLabel}`
                      : hud.nextParcelLabel}
                  </div>
                </div>
              </div>

              {hud.deliveredCount < hud.totalStops && (
                <div className="flex items-center gap-1.5 bg-black/30 border border-white/15 rounded-lg px-2.5 py-1 shrink-0">
                  <Navigation
                    className="w-3.5 h-3.5 text-[#ff551e] transition-transform duration-100"
                    style={{
                      transform: `rotate(${Math.round(compassDeg)}deg)`,
                    }}
                    strokeWidth={2.3}
                    aria-hidden="true"
                  />
                  <span className="font-mono-num text-xs font-semibold text-white leading-none">
                    {hud.distanceToStopMeters}m
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/12 w-full">
              <div className="flex items-center gap-1.5 font-mono-num text-[11px] uppercase tracking-wider text-white/90">
                <Package
                  className="w-3.5 h-3.5 shrink-0 opacity-90"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <span>
                  {hud.needsBrakeForLarge
                    ? 'Brake [S/↓] to Unload Crate'
                    : hud.canBullseyeToss
                      ? 'Bullseye Lock [Space]'
                      : hud.canExpressToss
                        ? 'Drop Zone Active [Space]'
                        : hud.nextParcelKind === ParcelKind.Large
                          ? 'Large Crate · Stop Required'
                          : hud.nextParcelKind === ParcelKind.HotExpress
                            ? 'Hot Express · Priority'
                            : hud.nextParcelKind === ParcelKind.Fragile
                              ? hud.fragileIntact
                                ? 'Fragile · Intact'
                                : 'Fragile · Bumped'
                              : 'Curbside Drop [Space]'}
                </span>
              </div>

              <span className="font-mono-num text-xs font-semibold text-white shrink-0">
                +
                {hud.canBullseyeToss
                  ? activeRewardPoints + 85
                  : activeRewardPoints}
              </span>
            </div>
          </button>

          {/* Fleet Depot Button */}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Open fleet depot and dispatch wheel [G]"
            title="Courier Depot & Dispatch Wheel [G]"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenShop();
            }}
            className="tactical-btn h-13 px-3.5 rounded-xl flex flex-col items-center justify-center gap-0.5 shrink-0 cursor-pointer relative"
          >
            {hasFreeSpin && <SignalDot />}
            <Warehouse
              className="w-4 h-4 text-[#f4f3ef]"
              strokeWidth={2}
              aria-hidden="true"
            />
            <span className="font-mono-num text-[10px] font-semibold uppercase tracking-wider text-[#f4f3ef] leading-none">
              Depot
            </span>
          </button>
        </div>

        {/* MOBILE DUAL-THUMB TACTICAL TOUCH DECK (< md) */}
        <div
          className={`${
            isPreGoCountdown ? 'hidden' : 'flex md:hidden'
          } pointer-events-auto flex-col gap-1.5 w-full touch-none`}
        >
          {/* Compact Status Callout */}
          {(hud.isWrongWay || (showMobileBanner && hud.bannerEvent)) && (
            <div className="pointer-events-none self-center max-w-[92%]">
              {hud.isWrongWay ? (
                <div className="tactical-panel rounded-lg px-2.5 py-1 flex items-center gap-2 border-[#dc2626]/65 whitespace-nowrap">
                  <span className="font-mono-num text-[10px] font-semibold uppercase tracking-wider text-[#f87171] leading-none">
                    Wrong Lane · Keep Right
                  </span>
                  <span className="w-10 h-1.5 bg-white/15 rounded-full overflow-hidden">
                    <span
                      className="block h-full bg-[#ff551e] transition-all duration-75"
                      style={{
                        width: `${Math.round(
                          Math.min(100, hud.wrongWayProgress * 100),
                        )}%`,
                      }}
                    />
                  </span>
                </div>
              ) : hud.bannerEvent ? (
                <div
                  key={hud.bannerEvent.id}
                  className="tactical-panel rounded-lg px-2.5 py-1 flex items-center gap-1.5 truncate"
                >
                  <span
                    className={`font-display text-[11px] font-semibold leading-none shrink-0 ${
                      hud.bannerEvent.tone === 'emerald'
                        ? 'text-[#4ade80]'
                        : hud.bannerEvent.tone === 'amber'
                          ? 'text-[#facc15]'
                          : 'text-[#fb7185]'
                    }`}
                  >
                    {hud.bannerEvent.label}
                  </span>
                </div>
              ) : null}
            </div>
          )}

          {/* Upper Mobile Strip: [Mute] + [Bell] + [Tap-to-Deliver Console] + [Depot] */}
          <div className="flex items-center gap-1.5 w-full">
            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="tactical-btn w-11 h-11 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-[#ff551e]" strokeWidth={2} />
              ) : (
                <Volume2 className="w-4 h-4 text-[#f4f3ef]" strokeWidth={2} />
              )}
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Ring courtesy bell"
              onPointerDown={(e) => {
                e.preventDefault();
                touchControls.hornPulse = true;
              }}
              className="tactical-btn w-11 h-11 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Bell
                className="w-4 h-4 text-[#f4f3ef]"
                strokeWidth={2}
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Tap to deliver parcel to active stop"
              onPointerDown={(e) => {
                e.preventDefault();
                touchControls.deliverPulse = true;
              }}
              className={`${
                hud.canBullseyeToss
                  ? 'btn-signal'
                  : hud.canExpressToss
                    ? 'btn-pine'
                    : 'tactical-btn'
              } flex-1 min-w-0 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2 cursor-pointer`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <CustomerPortraitSvg appearance={hud.nextStopAppearance} />
                <div className="text-left min-w-0">
                  <div className="font-display text-xs font-semibold text-white leading-tight truncate">
                    #{hud.nextStopIndex} {hud.nextCustomerName}
                    {hud.nextVipRole !== 'none' ? ' · VIP' : ''}
                  </div>
                  <div className="font-mono-num text-[10px] text-white/85 leading-tight truncate mt-0.5">
                    {hud.needsBrakeForLarge
                      ? `HOLD BRAKE · +${activeRewardPoints}`
                      : hud.canBullseyeToss
                        ? `BULLSEYE TAP · +${activeRewardPoints + 85}`
                        : hud.canExpressToss
                          ? `TAP TO DROP · +${activeRewardPoints}`
                          : `${
                              hud.nextParcelKind === ParcelKind.Large
                                ? 'CRATE'
                                : hud.nextParcelKind === ParcelKind.HotExpress
                                  ? `HOT ${Math.round(hud.thermalPct * 100)}%`
                                  : hud.nextParcelKind === ParcelKind.Fragile
                                    ? hud.fragileIntact
                                      ? 'FRAGILE'
                                      : 'BUMPED'
                                    : 'PARCEL'
                            } · +${activeRewardPoints}`}
                  </div>
                </div>
              </div>

              {hud.deliveredCount < hud.totalStops && (
                <div className="flex items-center gap-1 bg-black/30 border border-white/15 rounded-lg px-2 py-1 shrink-0">
                  <Navigation
                    className="w-3 h-3 text-[#ff551e] transition-transform duration-100"
                    style={{
                      transform: `rotate(${Math.round(compassDeg)}deg)`,
                    }}
                    strokeWidth={2.3}
                    aria-hidden="true"
                  />
                  <span className="font-mono-num text-[11px] font-semibold text-white leading-none">
                    {hud.distanceToStopMeters}m
                  </span>
                </div>
              )}
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Open fleet depot"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenShop();
              }}
              className="tactical-btn w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer relative shrink-0"
            >
              {hasFreeSpin && <SignalDot />}
              <Warehouse
                className="w-4 h-4 text-[#f4f3ef]"
                strokeWidth={2}
                aria-hidden="true"
              />
            </button>
          </div>

          {/* Lower Dual-Thumb Driving Controls */}
          <div className="flex items-stretch gap-1.5 w-full">
            {/* Left Thumb Slide-Capable Steering Rocker */}
            <div
              ref={steerRockerRef}
              role="group"
              aria-label="Steering controls"
              onPointerDown={(e) => {
                e.preventDefault();
                steerPointerIdRef.current = e.pointerId;
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // Ignore synthetic pointer events without active pointerId
                }
                touchControls.steerTouchActive = true;
                updateSteerFromClientX(e.clientX);
              }}
              onPointerMove={(e) => {
                if (steerPointerIdRef.current !== e.pointerId) return;
                updateSteerFromClientX(e.clientX);
              }}
              onPointerUp={(e) => {
                if (steerPointerIdRef.current !== e.pointerId) return;
                releaseSteerRocker();
              }}
              onPointerCancel={(e) => {
                if (steerPointerIdRef.current !== e.pointerId) return;
                releaseSteerRocker();
              }}
              className="flex-[1.2] grid grid-cols-2 gap-1.5 touch-none"
            >
              <button
                type="button"
                tabIndex={-1}
                aria-label="Steer left"
                className={`tactical-btn h-[54px] rounded-xl flex items-center justify-center cursor-pointer ${
                  steerUiSide === 'left'
                    ? 'bg-[#2a323c] border-white/35 translate-y-0.5'
                    : ''
                }`}
              >
                <span className="font-mono-num text-xs font-semibold tracking-wider text-[#f4f3ef]">
                  ◀ LEFT
                </span>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Steer right"
                className={`tactical-btn h-[54px] rounded-xl flex items-center justify-center cursor-pointer ${
                  steerUiSide === 'right'
                    ? 'bg-[#2a323c] border-white/35 translate-y-0.5'
                    : ''
                }`}
              >
                <span className="font-mono-num text-xs font-semibold tracking-wider text-[#f4f3ef]">
                  RIGHT ▶
                </span>
              </button>
            </div>

            {/* Center Thumb Boost Pad */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Activate mobile turbo boost"
              onPointerDown={(e) => {
                e.preventDefault();
                touchControls.boostPulse = true;
              }}
              className="tactical-btn rounded-xl min-w-[76px] h-[54px] px-2 relative overflow-hidden flex flex-col items-center justify-center cursor-pointer shrink-0"
            >
              {!hud.boostReady && !hud.isBoosting && (
                <div
                  className="absolute left-0 top-0 bottom-0 bg-[#ff551e]/25 transition-all duration-100"
                  style={{ width: `${boostPct}%` }}
                />
              )}
              <span className="relative z-10 font-mono-num text-[10px] text-[#9ba3ae] leading-none">
                x{streakMultiplier}
              </span>
              <span
                className={`relative z-10 font-display text-xs font-bold uppercase leading-tight mt-0.5 ${
                  hud.isFever
                    ? 'text-[#ff551e]'
                    : hud.isBoosting
                      ? 'text-[#4ade80]'
                      : hud.boostReady
                        ? 'text-[#facc15]'
                        : 'text-[#f4f3ef]/75'
                }`}
              >
                {hud.isFever ? 'Fever' : 'Boost'}
              </span>
            </button>

            {/* Right Thumb Brake & Drive Pedals */}
            <div className="flex-[1.2] grid grid-cols-2 gap-1.5 touch-none">
              <button
                type="button"
                tabIndex={-1}
                aria-label="Hold brake"
                onPointerDown={(e) => {
                  e.preventDefault();
                  brakePointerIdRef.current = e.pointerId;
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    // Ignore synthetic pointer events
                  }
                  touchControls.brake = true;
                  setBrakePressed(true);
                }}
                onPointerUp={(e) => {
                  if (brakePointerIdRef.current !== e.pointerId) return;
                  brakePointerIdRef.current = null;
                  touchControls.brake = false;
                  setBrakePressed(false);
                }}
                onPointerCancel={(e) => {
                  if (brakePointerIdRef.current !== e.pointerId) return;
                  brakePointerIdRef.current = null;
                  touchControls.brake = false;
                  setBrakePressed(false);
                }}
                className={`tactical-btn h-[54px] rounded-xl flex flex-col items-center justify-center cursor-pointer ${
                  brakePressed ? 'bg-[#362226] border-[#f87171]/45 translate-y-0.5' : ''
                }`}
              >
                <span className="font-mono-num text-xs font-semibold text-[#f87171] leading-none">
                  BRAKE
                </span>
                <span className="font-mono-num text-[9px] text-[#9ba3ae] leading-tight mt-0.5">
                  STOP
                </span>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Hold gas pedal to drive"
                onPointerDown={(e) => {
                  e.preventDefault();
                  gasPointerIdRef.current = e.pointerId;
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    // Ignore synthetic pointer events
                  }
                  touchControls.gas = true;
                  setGasPressed(true);
                }}
                onPointerUp={(e) => {
                  if (gasPointerIdRef.current !== e.pointerId) return;
                  gasPointerIdRef.current = null;
                  touchControls.gas = false;
                  setGasPressed(false);
                }}
                onPointerCancel={(e) => {
                  if (gasPointerIdRef.current !== e.pointerId) return;
                  gasPointerIdRef.current = null;
                  touchControls.gas = false;
                  setGasPressed(false);
                }}
                className={`btn-pine h-[54px] rounded-xl flex flex-col items-center justify-center cursor-pointer ${
                  gasPressed ? 'translate-y-0.5 brightness-105' : ''
                }`}
              >
                <span className="font-mono-num text-xs font-semibold text-white leading-none">
                  DRIVE
                </span>
                <span className="font-mono-num text-[9px] text-white/85 leading-tight mt-0.5">
                  GO ▲
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Heading-Up Architectural GPS Radar */}
        <div
          className={`${
            isPreGoCountdown ? 'hidden md:flex' : 'flex'
          } fixed right-2.5 top-[72px] md:static flex-col items-center tactical-panel rounded-xl p-1 md:p-1.5 shrink-0 z-10`}
        >
          <canvas
            ref={mapCanvasRef}
            width={106}
            height={106}
            data-testid="hud-minimap"
            aria-label="Courier GPS route minimap"
            className="block w-[72px] h-[72px] md:w-[106px] md:h-[106px] rounded-lg border border-white/15"
          />
          <div className="w-full flex items-center justify-between px-1 pt-1 font-mono-num text-[9px] md:text-[10.5px] leading-none">
            <span className="font-semibold text-[#9ba3ae]">RADAR</span>
            <span className="font-semibold text-[#f4f3ef]">
              {hud.speedKmh} KM/H
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
