import React from 'react';
import { pokoAudio } from '../game/audio';
import { PlayerProgression } from '../game/types';

interface QuestsRulesModalProps {
  open: boolean;
  progression: PlayerProgression;
  onClaimQuest: (questId: string) => void;
  onClose: () => void;
}

export const QuestsRulesModal: React.FC<QuestsRulesModalProps> = ({
  open,
  progression,
  onClaimQuest,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-4 bg-[#10151b]/50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quests-modal-heading"
    >
      <div className="pointer-events-auto nordic-sheet rounded-2xl p-5 sm:p-6 w-full max-w-[520px] my-auto flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <div className="font-mono-num text-[11px] font-medium uppercase tracking-[0.14em] text-[#525b65]">
              Active Bounties · Field Guide
            </div>
            <h2
              id="quests-modal-heading"
              className="font-display text-2xl sm:text-[28px] font-bold text-[#181d23] leading-tight"
            >
              Shift Manifest
            </h2>
          </div>

          <div className="nordic-inset rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full bg-[#eab308]"
              aria-hidden="true"
            />
            <span className="font-mono-num text-sm sm:text-base font-semibold text-[#181d23] leading-none">
              {progression.coins.toLocaleString()}
            </span>
          </div>
        </div>

        {/* 3 Rotating Shift Bounties */}
        <div className="flex flex-col gap-2.5">
          {progression.quests.map((q) => {
            const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
            const readyToClaim = q.progress >= q.target && !q.claimed;

            return (
              <div
                key={q.id}
                className="bg-white border border-[#d5d0c5] rounded-xl p-3.5 flex items-center justify-between gap-3.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-semibold text-sm sm:text-[15px] text-[#181d23] truncate">
                      {q.title}
                    </span>
                    <span className="font-mono-num text-xs font-medium text-[#525b65] shrink-0">
                      {q.progress}/{q.target}
                    </span>
                  </div>

                  <div className="mt-2 h-2 bg-[#eae6dd] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${
                        readyToClaim ? 'bg-[#16a34a]' : 'bg-[#ff551e]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {readyToClaim ? (
                  <button
                    type="button"
                    onClick={() => {
                      pokoAudio.playSpinReward();
                      onClaimQuest(q.id);
                    }}
                    className="btn-pine py-2 px-3.5 rounded-lg cursor-pointer shrink-0 font-mono-num font-semibold text-xs"
                  >
                    Claim +{q.rewardCoins}
                  </button>
                ) : (
                  <div className="font-mono-num text-xs font-semibold text-[#525b65] shrink-0 pl-1">
                    +{q.rewardCoins} Coins
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Concise Operational Field Guide */}
        <div className="nordic-inset rounded-xl p-3.5 text-xs text-[#181d23]/90 leading-relaxed flex flex-col gap-2">
          <div>
            <strong className="font-display font-semibold text-[#181d23]">
              Right-Lane Transit &amp; Bell [Q]:
            </strong>{' '}
            Keep right, obey traffic signals (or collect{' '}
            <strong>Green-Wave</strong> relays), and ring <strong>[Q]</strong> to
            calm scooters and clear duckling crossings.
          </div>
          <div>
            <strong className="font-display font-semibold text-[#181d23]">
              Special Parcels &amp; Bays:
            </strong>{' '}
            Drop on inner <strong>Bullseyes</strong> for +2x Combo, deliver{' '}
            <strong>Thermal</strong> bags while warm, brake for{' '}
            <strong>Large Crates</strong>, and visit <strong>Service Bays</strong>{' '}
            for hull repair + shield.
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            pokoAudio.playUiClick();
            onClose();
          }}
          className="btn-signal w-full py-3 px-5 rounded-xl cursor-pointer font-display font-semibold text-base"
        >
          Resume Shift
        </button>
      </div>
    </div>
  );
};
