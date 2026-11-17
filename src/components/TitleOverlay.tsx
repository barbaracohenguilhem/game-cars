import React from 'react';
import {
  ArrowRight,
  Compass,
  Package,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { pokoAudio } from '../game/audio';

interface TitleOverlayProps {
  selectedLevel?: number;
  highestUnlockedLevel?: number;
  muted: boolean;
  onlineCount?: number;
  activeRoomCode?: string | null;
  onSelectLevel?: (lvl: number) => void;
  onStart: () => void;
  onOpenMultiplayer?: () => void;
  onToggleMute: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  selectedLevel = 1,
  highestUnlockedLevel = 1,
  muted,
  onlineCount = 0,
  activeRoomCode = null,
  onSelectLevel,
  onStart,
  onOpenMultiplayer,
  onToggleMute,
}) => {
  const maxStage = Math.max(1, highestUnlockedLevel);
  const stageButtons = Array.from({ length: maxStage }, (_, idx) => idx + 1);

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-[#10151b]/45 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-heading"
    >
      {/* Top-Right Tactical Audio Toggle */}
      <div className="fixed top-3.5 right-3.5 sm:top-5 sm:right-5 z-30">
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          className="pointer-events-auto tactical-btn w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff551e]"
        >
          {muted ? (
            <VolumeX className="w-5 h-5 text-[#ff551e]" strokeWidth={2} />
          ) : (
            <Volume2 className="w-5 h-5 text-[#f4f3ef]" strokeWidth={2} />
          )}
        </button>
      </div>

      {/* Centered Scandinavian Architectural Briefing Sheet */}
      <div className="pointer-events-auto nordic-sheet rounded-2xl p-5 sm:px-8 sm:py-7 w-full max-w-[640px] my-auto flex flex-col gap-5">
        {/* Header Lockup */}
        <div className="flex flex-col gap-2">
          <div className="font-mono-num text-[11px] font-medium uppercase tracking-[0.14em] text-[#525b65]">
            Nordic Archipelago · Curbside Dispatch
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className="w-11 h-11 rounded-xl bg-[#ff551e] flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(255,85,30,0.25)]"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 28 28"
                  className="w-6 h-6"
                  fill="none"
                >
                  <circle
                    cx="14"
                    cy="14"
                    r="9.5"
                    stroke="#ffffff"
                    strokeWidth="1.8"
                    strokeOpacity="0.9"
                  />
                  <circle
                    cx="14"
                    cy="14"
                    r="4"
                    fill="#ffffff"
                  />
                  <path
                    d="M14 2.5v3M14 22.5v3M2.5 14h3M22.5 14h3"
                    stroke="#ffffff"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <h1
                id="welcome-heading"
                className="font-display text-3xl sm:text-[40px] font-bold tracking-tight text-[#181d23] leading-[1.04]"
              >
                Courier Field
              </h1>
            </div>

            <span className="hidden sm:inline font-mono-num text-xs font-medium text-[#525b65]">
              Stage {String(selectedLevel).padStart(2, '0')}
            </span>
          </div>

          <p className="text-xs sm:text-[13.5px] font-medium text-[#525b65] leading-relaxed max-w-[540px]">
            Navigate canal islands, timber crossings, and rush-hour intersections
            to complete sequential curbside drops before the shift clock expires.
          </p>
        </div>

        {/* 3-Column Operational Specification */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#d5d0c5] border-y border-[#d5d0c5] py-4 gap-3.5 sm:gap-0">
          <div className="flex flex-col gap-1.5 sm:pr-5">
            <div className="flex items-center justify-between text-[#ff551e]">
              <span className="font-mono-num text-[11px] font-semibold tracking-wider">
                01 · ROUTE
              </span>
              <Package className="w-4 h-4" strokeWidth={1.9} aria-hidden="true" />
            </div>
            <div className="font-display text-[15px] font-semibold text-[#181d23] leading-snug">
              Sequential Drops
            </div>
            <p className="text-xs text-[#525b65] leading-relaxed">
              Follow road chevrons, obey traffic signals, and toss parcels into
              curbside customer rings.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 pt-3.5 sm:pt-0 sm:px-5">
            <div className="flex items-center justify-between text-[#16a34a]">
              <span className="font-mono-num text-[11px] font-semibold tracking-wider">
                02 · PRECISION
              </span>
              <Zap className="w-4 h-4" strokeWidth={1.9} aria-hidden="true" />
            </div>
            <div className="font-display text-[15px] font-semibold text-[#181d23] leading-snug">
              Bullseye &amp; Fever
            </div>
            <p className="text-xs text-[#525b65] leading-relaxed">
              Land inner bullseyes to build 2x Fever streaks and fund new EV
              vans and roof rigs.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 pt-3.5 sm:pt-0 sm:pl-5">
            <div className="flex items-center justify-between text-[#3b5b7e]">
              <span className="font-mono-num text-[11px] font-semibold tracking-wider">
                03 · DISTRICTS
              </span>
              <Compass className="w-4 h-4" strokeWidth={1.9} aria-hidden="true" />
            </div>
            <div className="font-display text-[15px] font-semibold text-[#181d23] leading-snug">
              Island Mastery
            </div>
            <p className="text-xs text-[#525b65] leading-relaxed">
              Clear every stop cleanly before time runs out to earn 3 stars and
              unlock new districts.
            </p>
          </div>
        </div>

        {/* Unlocked District Stage Selector (shown once Stage 2+ is unlocked) */}
        {maxStage > 1 && onSelectLevel && (
          <div className="flex items-center justify-between gap-3 nordic-inset rounded-xl px-3 py-2">
            <span className="font-mono-num text-[11px] font-medium uppercase tracking-wider text-[#525b65]">
              Dispatch Stage
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {stageButtons.map((lvl) => {
                const isSelected = lvl === selectedLevel;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => {
                      pokoAudio.playUiClick();
                      onSelectLevel(lvl);
                    }}
                    className={`font-mono-num text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#181d23] text-[#f5f3ee]'
                        : 'bg-white text-[#181d23] border border-[#d5d0c5] hover:bg-[#f5f3ee]'
                    }`}
                  >
                    {String(lvl).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Unboxed Inline Control Reference */}
        <div className="flex sm:hidden items-center justify-center text-center font-mono-num text-[11px] text-[#525b65]">
          <span>
            <strong className="font-semibold text-[#181d23]">Touch Pedals</strong>{' '}
            Drive &amp; Steer ·{' '}
            <strong className="font-semibold text-[#181d23]">Tap Dispatch</strong>{' '}
            Drop
          </span>
        </div>

        <div className="hidden sm:flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center font-mono-num text-[11.5px] text-[#525b65]">
          <span>
            <strong className="font-semibold text-[#181d23]">W/↑</strong> Drive
          </span>
          <span aria-hidden="true" className="text-[#b5afa2]">
            ·
          </span>
          <span>
            <strong className="font-semibold text-[#181d23]">S/↓</strong> Brake
          </span>
          <span aria-hidden="true" className="text-[#b5afa2]">
            ·
          </span>
          <span>
            <strong className="font-semibold text-[#181d23]">A/D</strong> Steer
          </span>
          <span aria-hidden="true" className="text-[#b5afa2]">
            ·
          </span>
          <span>
            <strong className="font-semibold text-[#181d23]">Space</strong> Drop
          </span>
          <span aria-hidden="true" className="text-[#b5afa2]">
            ·
          </span>
          <span>
            <strong className="font-semibold text-[#181d23]">Shift</strong> Boost
          </span>
          <span aria-hidden="true" className="text-[#b5afa2]">
            ·
          </span>
          <span>
            <strong className="font-semibold text-[#181d23]">Q</strong> Bell
          </span>
          <span aria-hidden="true" className="text-[#b5afa2]">
            ·
          </span>
          <span>
            <strong className="font-semibold text-[#181d23]">Esc</strong> Pause
          </span>
        </div>

        {/* Solo + Multiplayer Action CTAs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              pokoAudio.playUiClick();
              onStart();
            }}
            className="btn-signal w-full h-13 sm:h-14 rounded-xl px-5 flex items-center justify-between cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181d23]"
          >
            <span className="font-display text-base sm:text-lg font-semibold tracking-tight">
              Solo Shift
            </span>
            <span className="flex items-center gap-1.5 font-mono-num text-xs font-medium opacity-95">
              <span>STAGE {String(selectedLevel).padStart(2, '0')}</span>
              <ArrowRight className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
            </span>
          </button>

          {onOpenMultiplayer && (
            <button
              type="button"
              data-testid="open-multiplayer-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                pokoAudio.playUiClick();
                onOpenMultiplayer();
              }}
              className="btn-graphite w-full h-13 sm:h-14 rounded-xl px-5 flex items-center justify-between cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff551e]"
            >
              <span className="flex items-center gap-2 font-display text-base sm:text-lg font-semibold tracking-tight">
                <Users className="w-4 h-4 text-[#ff551e]" strokeWidth={2.1} aria-hidden="true" />
                <span>Multiplayer</span>
              </span>
              <span className="flex items-center gap-1.5 font-mono-num text-xs font-medium text-[#f5f3ee]/85">
                <span
                  className="w-2 h-2 rounded-full bg-[#16a34a]"
                  aria-hidden="true"
                />
                <span>
                  {activeRoomCode
                    ? `ROOM ${activeRoomCode}`
                    : `${Math.max(1, onlineCount)} LIVE`}
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
