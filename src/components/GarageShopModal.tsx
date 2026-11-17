import React, { useState } from 'react';
import { pokoAudio } from '../game/audio';
import {
  SPIN_COST_COINS,
  SPIN_WHEEL_SLICES,
  SpinWheelSlice,
  TOPPER_SPECS,
  VEHICLE_SPECS,
} from '../game/progression';
import { PlayerProgression, TopperId, VehicleId } from '../game/types';

interface GarageShopModalProps {
  open: boolean;
  progression: PlayerProgression;
  onSelectOrBuyVehicle: (id: VehicleId) => void;
  onSelectOrBuyTopper: (id: TopperId) => void;
  onSpinWheel: () => { slice: SpinWheelSlice | null; usedToken: boolean };
  onClose: () => void;
}

type ShopTab = 'fleet' | 'toppers' | 'spin';

export const GarageShopModal: React.FC<GarageShopModalProps> = ({
  open,
  progression,
  onSelectOrBuyVehicle,
  onSelectOrBuyTopper,
  onSpinWheel,
  onClose,
}) => {
  const [tab, setTab] = useState<ShopTab>('fleet');
  const [wheelDeg, setWheelDeg] = useState<number>(0);
  const [spinning, setSpinning] = useState<boolean>(false);
  const [lastSpinReward, setLastSpinReward] = useState<SpinWheelSlice | null>(
    null,
  );

  if (!open) return null;

  const canSpin =
    !spinning &&
    (progression.spinTokens > 0 || progression.coins >= SPIN_COST_COINS);

  const handleTriggerSpin = () => {
    if (!canSpin) return;
    pokoAudio.playUiClick();
    const res = onSpinWheel();
    if (!res.slice) return;
    setSpinning(true);
    setLastSpinReward(null);
    // Align landing slice under top pointer (6 slices = 60 deg each)
    const sliceCenterDeg = res.slice.index * 60 + 30;
    const nextRot =
      wheelDeg + 1080 + ((360 - sliceCenterDeg - (wheelDeg % 360) + 360) % 360);
    setWheelDeg(nextRot);
    window.setTimeout(() => {
      setSpinning(false);
      setLastSpinReward(res.slice);
      pokoAudio.playSpinReward();
    }, 850);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-4 bg-[#10151b]/50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="garage-shop-heading"
    >
      <div className="pointer-events-auto nordic-sheet rounded-2xl p-5 sm:p-6 w-full max-w-[560px] my-auto flex flex-col gap-4">
        {/* Header + Coin / Token Readout */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <div className="font-mono-num text-[11px] font-medium uppercase tracking-[0.14em] text-[#525b65]">
              Fleet Depot · Customization
            </div>
            <h2
              id="garage-shop-heading"
              className="font-display text-2xl sm:text-[28px] font-bold text-[#181d23] leading-tight"
            >
              Courier Depot
            </h2>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div
              className="nordic-inset rounded-lg px-3 py-1.5 flex items-center gap-2"
              aria-label={`${progression.coins} coins available`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full bg-[#eab308]"
                aria-hidden="true"
              />
              <span className="font-mono-num text-sm sm:text-base font-semibold text-[#181d23] leading-none">
                {progression.coins.toLocaleString()}
              </span>
              <span className="font-mono-num text-[10px] uppercase tracking-wider text-[#525b65]">
                Coins
              </span>
            </div>

            {progression.spinTokens > 0 && (
              <span className="font-mono-num text-[11px] font-semibold text-[#16a34a]">
                {progression.spinTokens} Dispatch{' '}
                {progression.spinTokens === 1 ? 'Token' : 'Tokens'} Ready
              </span>
            )}
          </div>
        </div>

        {/* 3-Tab Segmented Control */}
        <div
          className="nordic-inset rounded-xl p-1 grid grid-cols-3 gap-1"
          role="tablist"
          aria-label="Shop categories"
        >
          {(
            [
              { id: 'fleet', label: 'Fleet Vans' },
              { id: 'toppers', label: 'Roof Rigs' },
              { id: 'spin', label: 'Dispatch Wheel' },
            ] as { id: ShopTab; label: string }[]
          ).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  pokoAudio.playUiClick();
                  setTab(t.id);
                }}
                className={`${
                  active
                    ? 'bg-[#181d23] text-[#f5f3ee] shadow-xs'
                    : 'text-[#525b65] hover:text-[#181d23]'
                } py-2 px-2 rounded-lg cursor-pointer text-center font-display font-semibold text-xs sm:text-sm transition-colors`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Unlockable Fleet Vehicles */}
        {tab === 'fleet' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(
              Object.values(
                VEHICLE_SPECS,
              ) as (typeof VEHICLE_SPECS)[VehicleId][]
            ).map((v) => {
              const owned = progression.unlockedVehicles.includes(v.id);
              const equipped = progression.selectedVehicle === v.id;
              const canAfford = progression.coins >= v.costCoins;

              return (
                <div
                  key={v.id}
                  className="bg-white border border-[#d5d0c5] rounded-xl p-3.5 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div>
                      <div className="font-display font-semibold text-[15px] text-[#181d23] leading-snug">
                        {v.name}
                      </div>
                      <div className="text-xs text-[#525b65] mt-0.5 leading-relaxed">
                        {v.tagline}
                      </div>
                    </div>
                    <span
                      className="w-5 h-5 rounded-md border border-black/15 shrink-0 mt-0.5"
                      style={{ backgroundColor: v.accentHex }}
                      aria-hidden="true"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={!owned && !canAfford}
                    onClick={() => {
                      pokoAudio.playUiClick();
                      onSelectOrBuyVehicle(v.id);
                    }}
                    className={`${
                      equipped
                        ? 'btn-pine'
                        : owned
                          ? 'btn-graphite'
                          : canAfford
                            ? 'btn-signal'
                            : 'bg-[#eae6dd] text-[#8b929a] border border-[#d5d0c5] cursor-not-allowed'
                    } w-full py-2 px-3 rounded-lg text-center font-display font-semibold text-xs sm:text-sm ${
                      !owned && !canAfford ? '' : 'cursor-pointer'
                    }`}
                  >
                    {equipped
                      ? 'Equipped'
                      : owned
                        ? 'Equip Vehicle'
                        : `Unlock · ${v.costCoins} Coins`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: 3D Roof Rigs */}
        {tab === 'toppers' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(
              Object.values(TOPPER_SPECS) as (typeof TOPPER_SPECS)[TopperId][]
            ).map((tp) => {
              const owned = progression.unlockedToppers.includes(tp.id);
              const equipped = progression.selectedTopper === tp.id;
              const canAfford = progression.coins >= tp.costCoins;

              return (
                <div
                  key={tp.id}
                  className="bg-white border border-[#d5d0c5] rounded-xl p-3.5 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="font-display font-semibold text-[15px] text-[#181d23] leading-snug">
                      {tp.name}
                    </div>
                    <div className="text-xs text-[#525b65] mt-0.5 leading-relaxed">
                      {tp.tagline}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!owned && !canAfford}
                    onClick={() => {
                      pokoAudio.playUiClick();
                      onSelectOrBuyTopper(tp.id);
                    }}
                    className={`${
                      equipped
                        ? 'btn-pine'
                        : owned
                          ? 'btn-graphite'
                          : canAfford
                            ? 'btn-signal'
                            : 'bg-[#eae6dd] text-[#8b929a] border border-[#d5d0c5] cursor-not-allowed'
                    } w-full py-2 px-3 rounded-lg text-center font-display font-semibold text-xs sm:text-sm ${
                      !owned && !canAfford ? '' : 'cursor-pointer'
                    }`}
                  >
                    {equipped
                      ? 'Equipped'
                      : owned
                        ? 'Equip Rig'
                        : `Unlock · ${tp.costCoins} Coins`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 3: Precision Rotary Dispatch Wheel */}
        {tab === 'spin' && (
          <div className="nordic-inset rounded-xl p-5 flex flex-col items-center gap-3.5">
            <div className="relative w-44 h-44 flex items-center justify-center">
              {/* Top Signal Orange Index Pointer */}
              <svg
                viewBox="0 0 28 24"
                className="w-7 h-6 absolute -top-2 z-10 drop-shadow-xs"
                aria-hidden="true"
              >
                <polygon
                  points="4,2 24,2 14,21"
                  fill="#ff551e"
                  stroke="#181d23"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>

              {/* Rotating 6-Sector Nordic Dial */}
              <svg
                viewBox="0 0 120 120"
                className="w-40 h-40 transition-transform duration-700 ease-out"
                style={{ transform: `rotate(${wheelDeg}deg)` }}
                aria-hidden="true"
              >
                <circle
                  cx="60"
                  cy="60"
                  r="56"
                  fill="#181d23"
                />
                {SPIN_WHEEL_SLICES.map((s, idx) => {
                  const a0 = ((idx * 60 - 90) * Math.PI) / 180;
                  const a1 = (((idx + 1) * 60 - 90) * Math.PI) / 180;
                  const x0 = 60 + 51 * Math.cos(a0);
                  const y0 = 60 + 51 * Math.sin(a0);
                  const x1 = 60 + 51 * Math.cos(a1);
                  const y1 = 60 + 51 * Math.sin(a1);
                  return (
                    <path
                      key={s.index}
                      d={`M60 60 L${x0.toFixed(1)} ${y0.toFixed(1)} A51 51 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`}
                      fill={s.colorHex}
                      stroke="#f5f3ee"
                      strokeWidth="1.6"
                    />
                  );
                })}
                <circle
                  cx="60"
                  cy="60"
                  r="13"
                  fill="#181d23"
                  stroke="#f5f3ee"
                  strokeWidth="2"
                />
                <circle cx="60" cy="60" r="4.5" fill="#ff551e" />
              </svg>
            </div>

            {lastSpinReward ? (
              <div className="bg-white border border-[#d5d0c5] rounded-lg px-4 py-2 text-center">
                <div className="font-display font-bold text-[#16a34a] text-sm sm:text-base">
                  Issued: {lastSpinReward.label}
                </div>
                <div className="text-xs text-[#525b65]">
                  {lastSpinReward.detail}
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#525b65] text-center">
                Win up to <strong className="text-[#181d23]">+500 Coins</strong>{' '}
                or a complimentary <strong className="text-[#181d23]">Bumper Shield</strong>.
              </div>
            )}

            <button
              type="button"
              disabled={!canSpin}
              onClick={handleTriggerSpin}
              className={`${
                canSpin
                  ? 'btn-signal cursor-pointer'
                  : 'bg-[#dfdacf] text-[#8b929a] border border-[#d5d0c5] cursor-not-allowed'
              } w-full max-w-xs py-2.5 px-5 rounded-xl font-display font-semibold text-sm sm:text-base`}
            >
              {spinning
                ? 'Spinning Dial...'
                : progression.spinTokens > 0
                  ? `Use Dispatch Token (${progression.spinTokens})`
                  : `Spin Wheel · ${SPIN_COST_COINS} Coins`}
            </button>
          </div>
        )}

        {/* Return CTA */}
        <button
          type="button"
          onClick={() => {
            pokoAudio.playUiClick();
            onClose();
          }}
          className="btn-stone w-full py-2.5 px-5 rounded-xl cursor-pointer font-display font-semibold text-sm sm:text-base"
        >
          Return to Shift
        </button>
      </div>
    </div>
  );
};
