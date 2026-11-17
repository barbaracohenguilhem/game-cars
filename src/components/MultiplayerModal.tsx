import React, { useEffect, useState } from 'react';
import {
  Check,
  CloudFog,
  CloudRain,
  Copy,
  Globe,
  Lock,
  LogOut,
  Play,
  Radio,
  Snowflake,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { pokoAudio } from '../game/audio';
import {
  MultiplayerClientSnapshot,
  multiplayerClient,
} from '../game/multiplayerClient';
import type { MultiplayerWeatherCondition } from '../game/multiplayerTypes';
import { WEATHER_CYCLE_ORDER, WEATHER_SPECS } from '../game/proceduralCity';
import { TOPPER_SPECS, VEHICLE_SPECS } from '../game/progression';
import { TopperId, VehicleId, WeatherCondition } from '../game/types';

interface MultiplayerModalProps {
  open: boolean;
  mpState: MultiplayerClientSnapshot;
  selectedVehicle: VehicleId;
  selectedTopper: TopperId;
  preferredLevel: number;
  preferredWeather?: WeatherCondition;
  onOpenShop: () => void;
  onEnterActiveShift: () => void;
  onClose: () => void;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  open,
  mpState,
  selectedVehicle,
  selectedTopper,
  preferredLevel,
  preferredWeather,
  onOpenShop,
  onEnterActiveShift,
  onClose,
}) => {
  const [callsignDraft, setCallsignDraft] = useState(mpState.callsign);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);

  useEffect(() => {
    setCallsignDraft(mpState.callsign);
  }, [mpState.callsign]);

  useEffect(() => {
    if (open) {
      multiplayerClient.ensureConnected();
    }
  }, [open]);

  if (!open) return null;

  const room = mpState.room;
  const isHost = room?.hostId === mpState.clientId;
  const selfPlayer = room?.players.find((p) => p.id === mpState.clientId);

  const handleCopyInviteLink = async () => {
    if (!room) return;
    pokoAudio.playUiClick();
    try {
      const inviteUrl = new URL(window.location.href);
      inviteUrl.searchParams.set('room', room.roomId);
      await navigator.clipboard.writeText(inviteUrl.toString());
      setCopiedInvite(true);
      window.setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      setCopiedInvite(false);
    }
  };

  const commitCallsign = (nextVal: string) => {
    setCallsignDraft(nextVal);
    multiplayerClient.setCallsign(nextVal);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-4 bg-[#10151b]/55 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mp-modal-heading"
    >
      <div className="pointer-events-auto nordic-sheet rounded-2xl p-5 sm:p-6 w-full max-w-[600px] my-auto flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 font-mono-num text-[11px] font-medium uppercase tracking-[0.14em] text-[#525b65]">
              <span
                className={`w-2 h-2 rounded-full ${
                  mpState.connectionStatus === 'connected'
                    ? 'bg-[#16a34a]'
                    : mpState.connectionStatus === 'connecting'
                      ? 'bg-[#eab308]'
                      : 'bg-[#dc2626]'
                }`}
                aria-hidden="true"
              />
              <span>
                {mpState.connectionStatus === 'connected'
                  ? `Live Dispatch Network · ${Math.max(1, mpState.onlineCount)} Online`
                  : mpState.connectionStatus === 'connecting'
                    ? 'Connecting to Dispatch Relay...'
                    : 'Reconnecting...'}
              </span>
            </div>

            <h2
              id="mp-modal-heading"
              className="font-display text-2xl sm:text-[28px] font-bold text-[#181d23] leading-tight"
            >
              {room ? `Dispatch Room · ${room.roomId}` : 'Multiplayer Dispatch'}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              pokoAudio.playUiClick();
              onClose();
            }}
            aria-label="Close multiplayer modal"
            className="btn-stone w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4 text-[#181d23]" strokeWidth={2.2} />
          </button>
        </div>

        {/* Inline Error Notice */}
        {mpState.errorMessage && (
          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-[#b91c1c] font-medium">
            <span>{mpState.errorMessage}</span>
            <button
              type="button"
              onClick={() => multiplayerClient.clearError()}
              className="font-mono-num uppercase text-[10px] font-semibold underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Courier Identity & Active Rig Row */}
        <div className="nordic-inset rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1">
            <label
              htmlFor="mp-callsign-input"
              className="font-mono-num text-[11px] font-semibold uppercase tracking-wider text-[#525b65] shrink-0"
            >
              Callsign
            </label>
            <input
              id="mp-callsign-input"
              type="text"
              maxLength={12}
              value={callsignDraft}
              onChange={(e) => commitCallsign(e.target.value)}
              placeholder="NORD-01"
              className="bg-white border border-[#d5d0c5] rounded-lg px-2.5 py-1.5 font-mono-num text-xs sm:text-sm font-semibold uppercase text-[#181d23] w-full max-w-[155px] focus:outline-2 focus:outline-[#ff551e]"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2.5">
            <div className="text-xs text-[#525b65]">
              <strong className="font-display font-semibold text-[#181d23]">
                {VEHICLE_SPECS[selectedVehicle]?.name ?? 'Fjord Standard'}
              </strong>{' '}
              · {TOPPER_SPECS[selectedTopper]?.name ?? 'Signal Beacon'}
            </div>
            <button
              type="button"
              onClick={() => {
                pokoAudio.playUiClick();
                onOpenShop();
              }}
              className="btn-stone px-2.5 py-1 rounded-lg font-mono-num text-[11px] font-semibold cursor-pointer shrink-0"
            >
              Swap Rig
            </button>
          </div>
        </div>

        {!room ? (
          /* VIEW A: DISPATCH DIRECTORY & ROOM CREATION */
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                data-testid="mp-quick-join-btn"
                onClick={() => {
                  pokoAudio.playUiClick();
                  multiplayerClient.quickJoin(
                    selectedVehicle,
                    selectedTopper,
                    preferredLevel,
                  );
                }}
                className="btn-signal rounded-xl p-3.5 flex flex-col items-start gap-1 cursor-pointer text-left"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-display font-bold text-base">
                    Quick Match
                  </span>
                  <Radio className="w-4 h-4" strokeWidth={2.1} />
                </div>
                <span className="text-xs text-white/90 leading-snug">
                  Join an open dispatch shift or launch a public channel.
                </span>
              </button>

              <button
                type="button"
                data-testid="mp-create-public-btn"
                onClick={() => {
                  pokoAudio.playUiClick();
                  multiplayerClient.createRoom(
                    true,
                    preferredLevel,
                    selectedVehicle,
                    selectedTopper,
                    preferredWeather as MultiplayerWeatherCondition | undefined,
                  );
                }}
                className="btn-graphite rounded-xl p-3.5 flex flex-col items-start gap-1 cursor-pointer text-left"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-display font-semibold text-base">
                    Host Public
                  </span>
                  <Globe className="w-4 h-4 text-[#f5f3ee]/80" strokeWidth={2} />
                </div>
                <span className="text-xs text-[#f5f3ee]/75 leading-snug">
                  Listed in live directory for up to 6 couriers.
                </span>
              </button>

              <button
                type="button"
                data-testid="mp-create-private-btn"
                onClick={() => {
                  pokoAudio.playUiClick();
                  multiplayerClient.createRoom(
                    false,
                    preferredLevel,
                    selectedVehicle,
                    selectedTopper,
                    preferredWeather as MultiplayerWeatherCondition | undefined,
                  );
                }}
                className="btn-stone rounded-xl p-3.5 flex flex-col items-start gap-1 cursor-pointer text-left"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-display font-semibold text-base text-[#181d23]">
                    Host Private
                  </span>
                  <Lock className="w-4 h-4 text-[#525b65]" strokeWidth={2} />
                </div>
                <span className="text-xs text-[#525b65] leading-snug">
                  Invite friends directly with a 5-letter room code.
                </span>
              </button>
            </div>

            {/* Join by Room Code */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!joinCodeInput.trim()) return;
                pokoAudio.playUiClick();
                multiplayerClient.joinRoom(
                  joinCodeInput,
                  selectedVehicle,
                  selectedTopper,
                );
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                maxLength={8}
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="Enter Room Code (e.g. FJORD)"
                aria-label="Room code"
                className="flex-1 bg-white border border-[#d5d0c5] rounded-xl px-3.5 py-2.5 font-mono-num text-sm font-semibold uppercase tracking-wider text-[#181d23] placeholder:font-normal placeholder:normal-case placeholder:tracking-normal focus:outline-2 focus:outline-[#ff551e]"
              />
              <button
                type="submit"
                disabled={joinCodeInput.trim().length < 4}
                className={`${
                  joinCodeInput.trim().length >= 4
                    ? 'btn-graphite cursor-pointer'
                    : 'bg-[#dfdacf] text-[#8b929a] border border-[#d5d0c5] cursor-not-allowed'
                } px-5 py-2.5 rounded-xl font-display font-semibold text-sm shrink-0`}
              >
                Join Code
              </button>
            </form>

            {/* Open Public Dispatch Channels */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between font-mono-num text-[11px] font-medium uppercase tracking-wider text-[#525b65]">
                <span>Open Public Channels</span>
                <span>{mpState.publicRooms.length} Active</span>
              </div>

              {mpState.publicRooms.length === 0 ? (
                <div className="nordic-inset rounded-xl p-4 text-center text-xs text-[#525b65]">
                  No public channels open yet. Click{' '}
                  <strong className="text-[#181d23]">Quick Match</strong> or{' '}
                  <strong className="text-[#181d23]">Host Public</strong> to open
                  a shared island shift.
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-[185px] overflow-y-auto pr-0.5">
                  {mpState.publicRooms.map((r) => (
                    <div
                      key={r.roomId}
                      className="bg-white border border-[#d5d0c5] rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-num text-xs font-semibold text-[#181d23]">
                            {r.roomId}
                          </span>
                          <span className="text-[#b5afa2]">·</span>
                          <span className="font-display text-sm font-semibold text-[#181d23] truncate">
                            Stage {String(r.level).padStart(2, '0')} ·{' '}
                            {r.districtName}
                          </span>
                        </div>
                        <div className="font-mono-num text-[11px] text-[#525b65] mt-0.5">
                          Host {r.hostCallsign} ·{' '}
                          {r.status === 'playing' ? 'In Shift' : 'Lobby'} ·{' '}
                          {r.playerCount}/{r.maxPlayers} Couriers
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={r.playerCount >= r.maxPlayers}
                        onClick={() => {
                          pokoAudio.playUiClick();
                          multiplayerClient.joinRoom(
                            r.roomId,
                            selectedVehicle,
                            selectedTopper,
                          );
                        }}
                        className="btn-signal px-3.5 py-1.5 rounded-lg font-display font-semibold text-xs cursor-pointer shrink-0"
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* VIEW B: ACTIVE ROOM LOBBY */
          <>
            {/* Invite Link & District Stage Bar */}
            <div className="bg-white border border-[#d5d0c5] rounded-xl p-3.5 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-mono-num text-xs text-[#525b65]">
                  <Users className="w-4 h-4 text-[#181d23]" strokeWidth={2} />
                  <span>
                    <strong className="font-semibold text-[#181d23]">
                      {room.players.length}/6
                    </strong>{' '}
                    Couriers · {room.isPublic ? 'Public Channel' : 'Private Code'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="btn-stone px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-mono-num text-xs font-semibold cursor-pointer"
                >
                  {copiedInvite ? (
                    <>
                      <Check
                        className="w-3.5 h-3.5 text-[#16a34a]"
                        strokeWidth={2.3}
                      />
                      <span className="text-[#16a34a]">Invite Link Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" strokeWidth={2} />
                      <span>Copy Invite Link ({room.roomId})</span>
                    </>
                  )}
                </button>
              </div>

              {/* District Stage & Weather Picker (Host editable, live synced) */}
              <div className="flex flex-col gap-2 pt-2.5 border-t border-[#eae6dd]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-[#525b65]">
                    District:{' '}
                    <strong className="font-display font-semibold text-[#181d23]">
                      Stage {String(room.level).padStart(2, '0')} ·{' '}
                      {room.districtName}
                    </strong>{' '}
                    <span className="font-mono-num text-[11px]">
                      ({room.totalStops} Stops · {room.timeLimitSec}s ·{' '}
                      {WEATHER_SPECS[room.weather as WeatherCondition]?.shortLabel ??
                        'Mist'}
                      )
                    </span>
                  </div>

                  {isHost && room.status !== 'playing' && (
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5, 6].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => {
                            pokoAudio.playUiClick();
                            multiplayerClient.setRoomLevel(lvl);
                          }}
                          className={`font-mono-num text-[11px] font-semibold px-2 py-1 rounded-md cursor-pointer transition-colors ${
                            room.level === lvl
                              ? 'bg-[#181d23] text-[#f5f3ee]'
                              : 'bg-[#eae6dd] text-[#525b65] hover:text-[#181d23]'
                          }`}
                        >
                          {String(lvl).padStart(2, '0')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {isHost && room.status !== 'playing' && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono-num text-[10.5px] uppercase tracking-wider text-[#525b65]">
                      Room Weather
                    </span>
                    <div className="flex flex-wrap items-center gap-1">
                      {WEATHER_CYCLE_ORDER.map((w) => {
                        const isSel = room.weather === w;
                        const WIcon =
                          w === WeatherCondition.MorningMist
                            ? CloudFog
                            : w === WeatherCondition.LightSnow
                              ? Snowflake
                              : w === WeatherCondition.FjordDrizzle
                                ? CloudRain
                                : Sun;
                        return (
                          <button
                            key={w}
                            type="button"
                            onClick={() => {
                              pokoAudio.playUiClick();
                              multiplayerClient.setRoomWeather(
                                w as MultiplayerWeatherCondition,
                              );
                            }}
                            className={`flex items-center gap-1 font-mono-num text-[11px] font-semibold px-2 py-1 rounded-md cursor-pointer transition-colors ${
                              isSel
                                ? 'bg-[#181d23] text-[#f5f3ee]'
                                : 'bg-[#eae6dd] text-[#525b65] hover:text-[#181d23]'
                            }`}
                          >
                            <WIcon className="w-3 h-3" strokeWidth={2.1} aria-hidden="true" />
                            <span>{WEATHER_SPECS[w].shortLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Connected Couriers Roster */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {room.players.map((p) => {
                const isMe = p.id === mpState.clientId;
                const playerIsHost = p.id === room.hostId;
                const vehSpec =
                  VEHICLE_SPECS[p.vehicleId as VehicleId] ??
                  VEHICLE_SPECS[VehicleId.ClassicVan];

                return (
                  <div
                    key={p.id}
                    className={`rounded-xl p-3 border flex items-center justify-between gap-2.5 ${
                      isMe
                        ? 'bg-white border-[#181d23]'
                        : 'bg-white/80 border-[#d5d0c5]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3.5 h-8 rounded-sm shrink-0"
                        style={{ backgroundColor: p.colorHex }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono-num text-xs sm:text-sm font-semibold text-[#181d23] truncate">
                            {p.callsign}
                          </span>
                          {isMe && (
                            <span className="font-mono-num text-[10px] font-semibold text-[#ff551e]">
                              · YOU
                            </span>
                          )}
                          {playerIsHost && (
                            <span className="font-mono-num text-[10px] font-medium text-[#525b65]">
                              · HOST
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#525b65] truncate">
                          {vehSpec.name}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`font-mono-num text-[10.5px] font-semibold uppercase tracking-wider shrink-0 ${
                        room.status === 'playing'
                          ? 'text-[#16a34a]'
                          : p.ready
                            ? 'text-[#16a34a]'
                            : 'text-[#525b65]'
                      }`}
                    >
                      {room.status === 'playing'
                        ? `${p.deliveries} Drops`
                        : p.ready
                          ? 'Ready'
                          : 'Standby'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="nordic-inset rounded-xl px-3.5 py-2.5 text-xs text-[#525b65] leading-relaxed">
              All couriers share the same procedural island and race toward the
              active curbside customer. First parcel on target claims the stop
              and advances everyone&apos;s route!
            </div>

            {/* Room Footer Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  pokoAudio.playUiClick();
                  multiplayerClient.leaveRoom();
                }}
                className="btn-stone px-4 py-2.5 rounded-xl flex items-center gap-1.5 font-display font-semibold text-sm cursor-pointer"
              >
                <LogOut className="w-4 h-4" strokeWidth={2} />
                <span>Leave Room</span>
              </button>

              <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
                {room.status === 'playing' ? (
                  <button
                    type="button"
                    onClick={() => {
                      pokoAudio.playUiClick();
                      onEnterActiveShift();
                    }}
                    className="btn-signal px-5 py-2.5 rounded-xl flex items-center gap-2 font-display font-semibold text-sm sm:text-base cursor-pointer"
                  >
                    <Play className="w-4 h-4" strokeWidth={2.2} />
                    <span>Join Active Shift</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        pokoAudio.playUiClick();
                        multiplayerClient.toggleReady(!selfPlayer?.ready);
                      }}
                      className={`${
                        selfPlayer?.ready ? 'btn-pine' : 'btn-stone'
                      } px-4 py-2.5 rounded-xl font-display font-semibold text-sm cursor-pointer`}
                    >
                      {selfPlayer?.ready ? 'Ready ✓' : 'Mark Ready'}
                    </button>

                    {isHost && (
                      <button
                        type="button"
                        data-testid="mp-launch-shift-btn"
                        onClick={() => {
                          pokoAudio.playUiClick();
                          multiplayerClient.startMatch(room.level);
                        }}
                        className="btn-signal px-5 py-2.5 rounded-xl flex items-center gap-2 font-display font-semibold text-sm sm:text-base cursor-pointer"
                      >
                        <Play className="w-4 h-4" strokeWidth={2.2} />
                        <span>
                          {room.players.length >= 2
                            ? 'Launch Shift'
                            : 'Launch Shift (Open Join)'}
                        </span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
