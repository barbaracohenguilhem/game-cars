import React from 'react';
import { ArrowRight, RotateCcw, Trophy, Users } from 'lucide-react';
import { pokoAudio } from '../game/audio';
import type { MultiplayerRoomState } from '../game/multiplayerTypes';
import { GamePhase, OutcomeKind, RunSnapshot } from '../game/types';

interface StatusModalProps {
  phase: GamePhase;
  snapshot: RunSnapshot | null;
  currentLevel: number;
  multiplayerRoom?: MultiplayerRoomState | null;
  localClientId?: string;
  onResume: () => void;
  onRestart: () => void;
  onNextLevel: () => void;
  onOpenShop: () => void;
  onOpenMultiplayer?: () => void;
  onLeaveMultiplayer?: () => void;
  onBackToTitle: () => void;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  phase,
  snapshot,
  currentLevel,
  multiplayerRoom = null,
  localClientId = '',
  onResume,
  onRestart,
  onNextLevel,
  onOpenShop,
  onOpenMultiplayer,
  onLeaveMultiplayer,
  onBackToTitle,
}) => {
  if (phase !== GamePhase.Paused && phase !== GamePhase.GameOver) {
    return null;
  }

  const isPaused = phase === GamePhase.Paused;
  const isVictory = snapshot?.outcome === OutcomeKind.Victory;
  const isBreakdown = snapshot?.outcome === OutcomeKind.Breakdown;
  const starsEarned = snapshot?.starsEarned ?? 0;

  const isMpFinished =
    !isPaused &&
    Boolean(multiplayerRoom) &&
    (multiplayerRoom?.standings.length ?? 0) > 0;
  const isMpHost = multiplayerRoom?.hostId === localClientId;
  const topStanding = multiplayerRoom?.standings[0];

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#10151b]/50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-heading"
    >
      <div className="pointer-events-auto nordic-sheet rounded-2xl p-5 sm:p-6 w-full max-w-md my-auto flex flex-col gap-4">
        {isPaused ? (
          <>
            <div className="flex flex-col gap-1">
              <div className="font-mono-num text-[11px] font-medium uppercase tracking-[0.14em] text-[#525b65]">
                {multiplayerRoom
                  ? `Room ${multiplayerRoom.roomId} · Live Menu`
                  : `Stage ${String(currentLevel).padStart(2, '0')} · Shift Paused`}
              </div>
              <h2
                id="modal-heading"
                className="font-display text-2xl sm:text-3xl font-bold text-[#181d23] leading-tight"
              >
                {multiplayerRoom ? 'Dispatch Menu' : 'Dispatch Paused'}
              </h2>
            </div>

            <div className="nordic-inset rounded-xl p-3.5 text-xs text-[#181d23]/90 leading-relaxed flex flex-col gap-2.5">
              <div>
                <span className="font-mono-num font-semibold text-[#ff551e] mr-1.5">
                  01
                </span>
                <strong className="font-display font-semibold text-[#181d23]">
                  Controls &amp; Courtesy Bell:
                </strong>{' '}
                <strong>W/↑</strong> Drive · <strong>S/↓</strong> Brake ·{' '}
                <strong>A/D</strong> Steer · <strong>Q</strong> Bell calms scooters
                and hurries ducklings.
              </div>
              <div>
                <span className="font-mono-num font-semibold text-[#16a34a] mr-1.5">
                  02
                </span>
                <strong className="font-display font-semibold text-[#181d23]">
                  Lanes &amp; Service Bays:
                </strong>{' '}
                Stay in the <strong>Right Lane</strong>, clear canal gates via{' '}
                <strong>Ramps</strong>, and roll through <strong>Espresso</strong>{' '}
                or <strong>Service</strong> bays.
              </div>
              <div>
                <span className="font-mono-num font-semibold text-[#3b5b7e] mr-1.5">
                  03
                </span>
                <strong className="font-display font-semibold text-[#181d23]">
                  Curbside Drops [Space]:
                </strong>{' '}
                Land inner <strong>Bullseyes</strong> for +2x Combo, rush{' '}
                <strong>Thermal</strong> bags, and brake for{' '}
                <strong>Large Crates</strong>.
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  pokoAudio.playUiClick();
                  onResume();
                }}
                className="btn-signal w-full py-3 px-5 rounded-xl cursor-pointer font-display font-semibold text-base sm:text-lg"
              >
                Resume Shift
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    pokoAudio.playUiClick();
                    onOpenShop();
                  }}
                  className="btn-graphite py-2.5 px-4 rounded-xl cursor-pointer font-display font-semibold text-sm"
                >
                  Fleet Depot
                </button>
                {multiplayerRoom && onOpenMultiplayer ? (
                  <button
                    type="button"
                    onClick={() => {
                      pokoAudio.playUiClick();
                      onOpenMultiplayer();
                    }}
                    className="btn-stone py-2.5 px-4 rounded-xl cursor-pointer font-display font-semibold text-sm"
                  >
                    Room {multiplayerRoom.roomId}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      pokoAudio.playUiClick();
                      onRestart();
                    }}
                    className="btn-stone py-2.5 px-4 rounded-xl cursor-pointer font-display font-semibold text-sm"
                  >
                    Restart Stage
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  pokoAudio.playUiClick();
                  if (multiplayerRoom && onLeaveMultiplayer) {
                    onLeaveMultiplayer();
                  } else {
                    onBackToTitle();
                  }
                }}
                className="btn-stone w-full py-2.5 px-5 rounded-xl cursor-pointer font-display font-semibold text-sm text-[#525b65]"
              >
                {multiplayerRoom ? 'Leave Multiplayer Shift' : 'Title Screen'}
              </button>
            </div>
          </>
        ) : isMpFinished && multiplayerRoom ? (
          /* MULTIPLAYER DISPATCH STANDINGS PODIUM */
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="font-mono-num text-[11px] font-medium uppercase tracking-[0.14em] text-[#525b65]">
                  Room {multiplayerRoom.roomId} · Stage{' '}
                  {String(multiplayerRoom.level).padStart(2, '0')}
                </div>
                <h2
                  id="modal-heading"
                  className="font-display text-2xl sm:text-[28px] font-bold text-[#181d23] leading-tight"
                >
                  {topStanding
                    ? `${topStanding.callsign} Leads Shift`
                    : 'Dispatch Standings'}
                </h2>
              </div>

              <div className="w-10 h-10 rounded-xl bg-[#ff551e]/12 border border-[#ff551e]/30 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-[#ff551e]" strokeWidth={2} />
              </div>
            </div>

            {/* Standings Table */}
            <div className="flex flex-col gap-2">
              {multiplayerRoom.standings.map((st) => {
                const isMe = st.id === localClientId;
                return (
                  <div
                    key={st.id}
                    className={`rounded-xl px-3.5 py-2.5 border flex items-center justify-between gap-3 ${
                      isMe
                        ? 'bg-white border-[#181d23]'
                        : 'nordic-inset border-[#d5d0c5]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono-num text-xs font-bold text-[#525b65] w-5">
                        #{st.rank}
                      </span>
                      <span
                        className="w-3 h-7 rounded-sm shrink-0"
                        style={{ backgroundColor: st.colorHex }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono-num text-xs sm:text-sm font-semibold text-[#181d23] truncate">
                            {st.callsign}
                          </span>
                          {isMe && (
                            <span className="font-mono-num text-[10px] font-semibold text-[#ff551e]">
                              · YOU
                            </span>
                          )}
                        </div>
                        <div className="font-mono-num text-[11px] text-[#525b65]">
                          {st.deliveries}{' '}
                          {st.deliveries === 1 ? 'Drop' : 'Drops'} ·{' '}
                          {st.bullseyes} Bullseye
                          {st.bullseyes === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono-num text-sm font-bold text-[#181d23]">
                        {st.score.toLocaleString()} PTS
                      </div>
                      <div className="font-mono-num text-[11px] font-semibold text-[#16a34a]">
                        +{st.coinsEarned} Coins
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2.5">
              {isMpHost ? (
                <button
                  type="button"
                  data-start="true"
                  onClick={() => {
                    pokoAudio.playUiClick();
                    onNextLevel();
                  }}
                  className="btn-signal w-full py-3.5 px-5 rounded-xl cursor-pointer flex items-center justify-between font-display font-semibold text-base sm:text-lg"
                >
                  <span>
                    {multiplayerRoom.outcome === 'victory'
                      ? 'Launch Next Stage'
                      : 'Rematch Stage'}
                  </span>
                  <span className="flex items-center gap-1.5 font-mono-num text-xs sm:text-sm">
                    <span>
                      STAGE{' '}
                      {String(
                        multiplayerRoom.outcome === 'victory'
                          ? multiplayerRoom.level + 1
                          : multiplayerRoom.level,
                      ).padStart(2, '0')}
                    </span>
                    <ArrowRight className="w-4 h-4" strokeWidth={2.2} />
                  </span>
                </button>
              ) : (
                <div className="nordic-inset rounded-xl px-4 py-2.5 text-center font-mono-num text-xs text-[#525b65]">
                  Waiting for room host to launch next stage...
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                {onOpenMultiplayer && (
                  <button
                    type="button"
                    onClick={() => {
                      pokoAudio.playUiClick();
                      onOpenMultiplayer();
                    }}
                    className="btn-graphite py-2.5 px-4 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 font-display font-semibold text-sm"
                  >
                    <Users className="w-4 h-4" strokeWidth={2} />
                    <span>Room Lobby</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    pokoAudio.playUiClick();
                    if (onLeaveMultiplayer) {
                      onLeaveMultiplayer();
                    } else {
                      onBackToTitle();
                    }
                  }}
                  className="btn-stone py-2.5 px-4 rounded-xl cursor-pointer font-display font-semibold text-sm"
                >
                  Leave Room
                </button>
              </div>
            </div>
          </>
        ) : (
          /* SOLO SHIFT SUMMARY */
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="font-mono-num text-[11px] font-medium uppercase tracking-[0.14em] text-[#525b65]">
                  Stage {String(snapshot?.level ?? currentLevel).padStart(2, '0')} ·{' '}
                  {snapshot?.districtName ?? 'Island Quarter'}
                </div>
                <h2
                  id="modal-heading"
                  className="font-display text-2xl sm:text-3xl font-bold text-[#181d23] leading-tight"
                >
                  {isVictory
                    ? 'Shift Complete'
                    : isBreakdown
                      ? 'Vehicle Disabled'
                      : 'Shift Time Expired'}
                </h2>
              </div>

              {/* 3 Geometric Mastery Stars */}
              <div
                className="flex items-center gap-1.5 pt-1 shrink-0"
                aria-label={`${starsEarned} of 3 mastery stars earned`}
              >
                {[1, 2, 3].map((st) => {
                  const earned = st <= starsEarned;
                  return (
                    <svg
                      key={st}
                      viewBox="0 0 28 28"
                      className="w-6 h-6"
                      aria-hidden="true"
                    >
                      <path
                        d="M14 2.5l3.4 6.9 7.6 1.1-5.5 5.4 1.3 7.6L14 19.9l-6.8 3.6 1.3-7.6-5.5-5.4 7.6-1.1L14 2.5z"
                        fill={earned ? '#ff551e' : '#e4dfd4'}
                        stroke={earned ? '#c83b0e' : '#bfb8a8'}
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                  );
                })}
              </div>
            </div>

            {/* 3 Tabular Metric Blocks */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="nordic-inset rounded-xl p-3 flex flex-col gap-0.5">
                <div className="text-[11px] font-medium text-[#525b65]">
                  {isVictory ? 'Time Left' : 'Deliveries'}
                </div>
                <div className="font-mono-num text-lg sm:text-xl font-semibold text-[#181d23]">
                  {isVictory
                    ? `${snapshot?.timeRemainingSec ?? 0}s`
                    : `${snapshot?.deliveredCount ?? 0}/${snapshot?.totalStops ?? 0}`}
                </div>
              </div>

              <div className="nordic-inset rounded-xl p-3 flex flex-col gap-0.5">
                <div className="text-[11px] font-medium text-[#525b65]">
                  Score
                </div>
                <div className="font-mono-num text-lg sm:text-xl font-semibold text-[#181d23]">
                  {(snapshot?.score ?? 0).toLocaleString()}
                </div>
              </div>

              <div className="nordic-inset rounded-xl p-3 flex flex-col gap-0.5">
                <div className="text-[11px] font-medium text-[#525b65]">
                  Coins
                </div>
                <div className="font-mono-num text-lg sm:text-xl font-semibold text-[#16a34a]">
                  +{snapshot?.coinsEarned ?? 0}
                </div>
              </div>
            </div>

            {/* Unboxed Inline Traffic Record */}
            <div className="font-mono-num text-xs text-[#525b65] flex flex-wrap items-center justify-between gap-2 border-y border-[#d5d0c5] py-2.5">
              <span>
                Traffic Record ·{' '}
                {(snapshot?.ticketsCount ?? 0) === 0 ? (
                  <strong className="font-semibold text-[#16a34a]">
                    Clean Driving (0 Citations)
                  </strong>
                ) : (
                  <strong className="font-semibold text-[#dc2626]">
                    {snapshot?.ticketsCount}{' '}
                    {snapshot?.ticketsCount === 1 ? 'Citation' : 'Citations'}
                  </strong>
                )}
              </span>

              {snapshot?.earnedSpinToken ? (
                <span className="font-semibold text-[#ff551e]">
                  +1 Dispatch Token
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-2.5">
              {isVictory ? (
                <>
                  <button
                    type="button"
                    data-start="true"
                    onClick={() => {
                      pokoAudio.playUiClick();
                      onNextLevel();
                    }}
                    className="btn-signal w-full py-3.5 px-5 rounded-xl cursor-pointer flex items-center justify-between font-display font-semibold text-base sm:text-lg"
                  >
                    <span>Next Stage</span>
                    <span className="flex items-center gap-1.5 font-mono-num text-xs sm:text-sm">
                      <span>
                        STAGE{' '}
                        {String((snapshot?.level ?? currentLevel) + 1).padStart(
                          2,
                          '0',
                        )}
                      </span>
                      <ArrowRight className="w-4 h-4" strokeWidth={2.2} />
                    </span>
                  </button>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        pokoAudio.playUiClick();
                        onOpenShop();
                      }}
                      className="btn-graphite py-2.5 px-4 rounded-xl cursor-pointer font-display font-semibold text-sm"
                    >
                      Depot &amp; Wheel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        pokoAudio.playUiClick();
                        onBackToTitle();
                      }}
                      className="btn-stone py-2.5 px-4 rounded-xl cursor-pointer font-display font-semibold text-sm"
                    >
                      Title Screen
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    data-start="true"
                    onClick={() => {
                      pokoAudio.playUiClick();
                      onRestart();
                    }}
                    className="btn-signal w-full py-3.5 px-5 rounded-xl cursor-pointer flex items-center justify-center gap-2 font-display font-semibold text-base sm:text-lg"
                  >
                    <RotateCcw className="w-4 h-4" strokeWidth={2.2} />
                    <span>Retry Stage</span>
                  </button>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        pokoAudio.playUiClick();
                        onOpenShop();
                      }}
                      className="btn-graphite py-2.5 px-4 rounded-xl cursor-pointer font-display font-semibold text-sm"
                    >
                      Fleet Depot
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        pokoAudio.playUiClick();
                        onBackToTitle();
                      }}
                      className="btn-stone py-2.5 px-4 rounded-xl cursor-pointer font-display font-semibold text-sm"
                    >
                      Title Screen
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
