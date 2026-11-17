/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GameHud, MinimapSnapshot } from './components/GameHud';
import { GarageShopModal } from './components/GarageShopModal';
import { MultiplayerModal } from './components/MultiplayerModal';
import { QuestsRulesModal } from './components/QuestsRulesModal';
import { StatusModal } from './components/StatusModal';
import { TitleOverlay } from './components/TitleOverlay';
import { pokoAudio } from './game/audio';
import {
  MultiplayerClientSnapshot,
  multiplayerClient,
  readInitialRoomFromUrl,
} from './game/multiplayerClient';
import { getLevelConfig } from './game/proceduralCity';
import {
  SpinWheelSlice,
  VEHICLE_SPECS,
  claimQuest,
  executeLuckySpin,
  incrementQuestProgress,
  loadProgression,
  purchaseOrSelectTopper,
  purchaseOrSelectVehicle,
  saveProgression,
} from './game/progression';
import {
  GamePhase,
  HudState,
  OutcomeKind,
  ParcelKind,
  PlayerProgression,
  QuestKind,
  RunSnapshot,
  TopperId,
  VehicleId,
} from './game/types';

function readInitialPhase(): GamePhase {
  if (typeof window === 'undefined') return GamePhase.Title;
  const params = new URLSearchParams(window.location.search);
  return params.get('autostart') === '1' ? GamePhase.Playing : GamePhase.Title;
}

function readInitialLevel(): number {
  if (typeof window === 'undefined') return 1;
  const params = new URLSearchParams(window.location.search);
  const parsed = Number(params.get('level'));
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

export default function App() {
  const [phase, setPhase] = useState<GamePhase>(readInitialPhase);
  const [activeLevel, setActiveLevel] = useState<number>(readInitialLevel);
  const [progression, setProgression] =
    useState<PlayerProgression>(loadProgression);
  const [highestUnlockedLevel, setHighestUnlockedLevel] = useState<number>(() => {
    const savedProg = loadProgression();
    const maxStarLvl = Object.keys(savedProg.districtStars).reduce(
      (acc, k) => Math.max(acc, Number(k) + 1),
      1,
    );
    return Math.max(1, readInitialLevel(), maxStarLvl);
  });
  const [runNonce, setRunNonce] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(0);
  const [muted, setMuted] = useState<boolean>(false);
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null);
  const [shopOpen, setShopOpen] = useState<boolean>(false);
  const [questsOpen, setQuestsOpen] = useState<boolean>(false);
  const [mpState, setMpState] = useState<MultiplayerClientSnapshot>(() =>
    multiplayerClient.getSnapshot(),
  );
  const [mpModalOpen, setMpModalOpen] = useState<boolean>(() =>
    Boolean(readInitialRoomFromUrl()),
  );

  const bestScoreRef = useRef<number>(bestScore);
  bestScoreRef.current = bestScore;
  const initVehRef = useRef<VehicleId>(progression.selectedVehicle);
  initVehRef.current = progression.selectedVehicle;
  const initTopRef = useRef<TopperId>(progression.selectedTopper);
  initTopRef.current = progression.selectedTopper;

  const minimapRef = useRef<MinimapSnapshot>({
    city: null,
    truckX: 0,
    truckZ: 0,
    truckYaw: Math.PI / 2,
    activeStopIndex: 1,
  });

  // Persist progression whenever wallet coins, quests, stars, or cosmetics update
  useEffect(() => {
    saveProgression(progression);
  }, [progression]);

  // Keep multiplayer profile cosmetics synced whenever vehicle or topper changes
  useEffect(() => {
    multiplayerClient.syncCosmetics(
      progression.selectedVehicle,
      progression.selectedTopper,
    );
  }, [progression.selectedVehicle, progression.selectedTopper]);

  // Connect real-time WebSocket multiplayer manager & listen for match start/finish events
  useEffect(() => {
    multiplayerClient.ensureConnected();
    const unsubSnap = multiplayerClient.subscribe(setMpState);

    const urlRoom = readInitialRoomFromUrl();
    if (urlRoom) {
      multiplayerClient.joinRoom(
        urlRoom,
        initVehRef.current,
        initTopRef.current,
      );
      setMpModalOpen(true);
    }

    const unsubMatch = multiplayerClient.onMatchLifecycle((ev) => {
      if (ev.type === 'started') {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setMpModalOpen(false);
        setShopOpen(false);
        setQuestsOpen(false);
        setActiveLevel(ev.room.level);
        setHighestUnlockedLevel((prev) => Math.max(prev, ev.room.level));
        setSnapshot(null);
        setRunNonce((n) => n + 1);
        document.body.dataset.state = GamePhase.Playing;
        setPhase(GamePhase.Playing);
        pokoAudio.playStartChime();
        pokoAudio.setMusicPlaying(true);
        const canvas = document.querySelector('canvas');
        if (canvas instanceof HTMLElement) {
          canvas.focus();
        }
      } else if (ev.type === 'finished') {
        const cid = multiplayerClient.getSnapshot().clientId;
        const myStanding = ev.room.standings.find((s) => s.id === cid);
        const isVictory = ev.room.outcome === 'victory';
        const outcomeKind = isVictory
          ? OutcomeKind.Victory
          : OutcomeKind.OutOfTime;
        const deliveredCount = Object.keys(ev.room.claimedStops).length;
        const myScore = myStanding?.score ?? 0;
        const coinsEarned = myStanding?.coinsEarned ?? 30;
        const starsEarned = isVictory ? (myStanding?.rank === 1 ? 3 : 2) : 0;
        const earnedSpinToken = Boolean(isVictory && myStanding?.rank === 1);

        const mpSnap: RunSnapshot = {
          level: ev.room.level,
          districtName: ev.room.districtName,
          outcome: outcomeKind,
          score: myScore,
          bestScore: Math.max(bestScoreRef.current, myScore),
          coinsEarned,
          starsEarned,
          earnedSpinToken,
          deliveredCount,
          totalStops: ev.room.totalStops,
          bullseyeCount: myStanding?.bullseyes ?? 0,
          timeRemainingSec: Math.max(0, Math.ceil(ev.room.timeRemainingSec)),
          elapsedSec: 0,
          maxCombo: 0,
          healthRemaining: 3,
          ticketsCount: myStanding?.tickets ?? 0,
        };

        setSnapshot(mpSnap);
        setBestScore((prev) => Math.max(prev, myScore));
        setProgression((prev) => {
          const prevStars = prev.districtStars[ev.room.level] ?? 0;
          const nextStars = Math.max(prevStars, starsEarned);
          return {
            ...prev,
            coins: prev.coins + coinsEarned,
            spinTokens: prev.spinTokens + (earnedSpinToken ? 1 : 0),
            districtStars:
              nextStars > prevStars
                ? { ...prev.districtStars, [ev.room.level]: nextStars }
                : prev.districtStars,
          };
        });
        if (isVictory) {
          setHighestUnlockedLevel((prev) => Math.max(prev, ev.room.level + 1));
          pokoAudio.playStageClear();
        } else {
          pokoAudio.playGameOver();
        }
        setMpModalOpen(false);
        setShopOpen(false);
        setQuestsOpen(false);
        pokoAudio.setMusicPlaying(false);
        document.body.dataset.state = GamePhase.GameOver;
        setPhase(GamePhase.GameOver);
      }
    });

    return () => {
      unsubSnap();
      unsubMatch();
    };
  }, []);

  const initialCfg = getLevelConfig(activeLevel);
  const initialVehSpec =
    VEHICLE_SPECS[progression.selectedVehicle] ??
    VEHICLE_SPECS[VehicleId.ClassicVan];

  const [hud, setHud] = useState<HudState>({
    level: initialCfg.level,
    districtName: initialCfg.districtName,
    atmosphere: initialCfg.atmosphere,
    deliveredCount: 0,
    totalStops: initialCfg.stopCount,
    timeRemainingSec: initialCfg.timeLimitSec,
    score: 0,
    coins: progression.coins,
    bestScore: 0,
    combo: 0,
    comboTimer: 0,
    isFever: false,
    health: initialVehSpec.maxHealth,
    maxHealth: initialVehSpec.maxHealth,
    hasBumperShield: progression.nextFreeShield,
    greenWaveTimer: 0,
    nextStopIndex: 1,
    nextCustomerName: 'Maya',
    nextParcelLabel: 'Matcha Pocket Tin',
    nextParcelKind: ParcelKind.Small,
    nextVipRole: 'none',
    thermalPct: 0,
    fragileIntact: true,
    nextStopAppearance: null,
    distanceToStopMeters: 24,
    bearingToStopRad: 0,
    canExpressToss: false,
    canBullseyeToss: false,
    needsBrakeForLarge: false,
    isWrongWay: false,
    wrongWayProgress: 0,
    ticketsCount: 0,
    boostReady: true,
    boostCharge: 1,
    isBoosting: false,
    isDrifting: false,
    speedKmh: 0,
    bannerEvent: null,
    countdownStage: null,
    rocketStartStatus: 'idle',
    demoActive: false,
    demoRemainingSec: 0,
  });

  // In live multiplayer shifts, keep the 3D world running smoothly even while overlays/menus are open
  const inLiveMultiplayerShift = mpState.room?.status === 'playing';
  const effectiveCanvasPhase = inLiveMultiplayerShift
    ? phase === GamePhase.Paused
      ? GamePhase.Playing
      : phase
    : (shopOpen || questsOpen || mpModalOpen) && phase === GamePhase.Playing
      ? GamePhase.Paused
      : phase;

  // Mirror state machine to document.body.dataset.state & sync background music loop
  useEffect(() => {
    document.body.dataset.state = effectiveCanvasPhase;
    pokoAudio.setMusicPlaying(effectiveCanvasPhase === GamePhase.Playing);
  }, [effectiveCanvasPhase]);

  const startPlaying = useCallback((targetLevel?: number) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (multiplayerClient.getSnapshot().room) {
      multiplayerClient.leaveRoom();
    }
    setMpModalOpen(false);
    setShopOpen(false);
    setQuestsOpen(false);
    document.body.dataset.state = GamePhase.Playing;
    if (targetLevel !== undefined) {
      setActiveLevel(targetLevel);
    }
    setSnapshot(null);
    setRunNonce((n) => n + 1);
    setPhase(GamePhase.Playing);
    pokoAudio.playStartChime();
    pokoAudio.setMusicPlaying(true);
    const canvas = document.querySelector('canvas');
    if (canvas instanceof HTMLElement) {
      canvas.focus();
    }
  }, []);

  const handleEnterActiveMultiplayerShift = useCallback(() => {
    const rm = multiplayerClient.getSnapshot().room;
    if (!rm) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setMpModalOpen(false);
    setShopOpen(false);
    setQuestsOpen(false);
    setActiveLevel(rm.level);
    setSnapshot(null);
    setRunNonce((n) => n + 1);
    document.body.dataset.state = GamePhase.Playing;
    setPhase(GamePhase.Playing);
    pokoAudio.playStartChime();
    pokoAudio.setMusicPlaying(true);
    const canvas = document.querySelector('canvas');
    if (canvas instanceof HTMLElement) {
      canvas.focus();
    }
  }, []);

  const handleRestart = useCallback(() => {
    const snap = multiplayerClient.getSnapshot();
    if (snap.room) {
      if (snap.room.hostId === snap.clientId) {
        multiplayerClient.startMatch(snap.room.level);
      } else {
        setMpModalOpen(true);
      }
      return;
    }
    startPlaying(activeLevel);
  }, [activeLevel, startPlaying]);

  const handleNextLevel = useCallback(() => {
    const snap = multiplayerClient.getSnapshot();
    if (snap.room) {
      if (snap.room.hostId === snap.clientId) {
        const nextMpLvl =
          snap.room.outcome === 'victory'
            ? snap.room.level + 1
            : snap.room.level;
        setHighestUnlockedLevel((prev) => Math.max(prev, nextMpLvl));
        multiplayerClient.startMatch(nextMpLvl);
      } else {
        setMpModalOpen(true);
      }
      return;
    }
    const nextLvl = (snapshot?.level ?? activeLevel) + 1;
    setHighestUnlockedLevel((prev) => Math.max(prev, nextLvl));
    startPlaying(nextLvl);
  }, [activeLevel, snapshot, startPlaying]);

  const handleToggleMute = useCallback(() => {
    const nextMuted = pokoAudio.toggleMute();
    setMuted(nextMuted);
  }, []);

  const handleAwardLiveCoins = useCallback((delta: number) => {
    if (delta <= 0) return;
    setProgression((prev) => ({
      ...prev,
      coins: prev.coins + delta,
    }));
  }, []);

  const handleQuestEvent = useCallback(
    (kind: QuestKind, amount: number = 1) => {
      setProgression((prev) => incrementQuestProgress(prev, kind, amount));
    },
    [],
  );

  const handleConsumeStartShield = useCallback(() => {
    setProgression((prev) =>
      prev.nextFreeShield ? { ...prev, nextFreeShield: false } : prev,
    );
  }, []);

  const handleSelectOrBuyVehicle = useCallback((id: VehicleId) => {
    setProgression((prev) => purchaseOrSelectVehicle(prev, id).next);
  }, []);

  const handleSelectOrBuyTopper = useCallback((id: TopperId) => {
    setProgression((prev) => purchaseOrSelectTopper(prev, id).next);
  }, []);

  const handleClaimQuest = useCallback((questId: string) => {
    setProgression((prev) => claimQuest(prev, questId));
  }, []);

  const handleSpinWheel = useCallback((): {
    slice: SpinWheelSlice | null;
    usedToken: boolean;
  } => {
    let spinOut: { slice: SpinWheelSlice | null; usedToken: boolean } = {
      slice: null,
      usedToken: false,
    };
    setProgression((prev) => {
      const res = executeLuckySpin(prev);
      spinOut = { slice: res.slice, usedToken: res.usedToken };
      return res.next;
    });
    return spinOut;
  }, []);

  const handleRunFinished = useCallback((snap: RunSnapshot) => {
    setSnapshot(snap);
    setBestScore((prev) => Math.max(prev, snap.score));
    setProgression((prev) => {
      const prevStars = prev.districtStars[snap.level] ?? 0;
      const nextStars = Math.max(prevStars, snap.starsEarned);
      return {
        ...prev,
        coins: prev.coins + snap.coinsEarned,
        spinTokens: prev.spinTokens + (snap.earnedSpinToken ? 1 : 0),
        districtStars:
          nextStars > prevStars
            ? { ...prev.districtStars, [snap.level]: nextStars }
            : prev.districtStars,
      };
    });
    if (snap.outcome === OutcomeKind.Victory) {
      setHighestUnlockedLevel((prev) => Math.max(prev, snap.level + 1));
    }
    setShopOpen(false);
    setQuestsOpen(false);
    setMpModalOpen(false);
    pokoAudio.setMusicPlaying(false);
    document.body.dataset.state = GamePhase.GameOver;
    setPhase(GamePhase.GameOver);
  }, []);

  // Global keyboard shortcuts for Title Start, Mute [M], Restart [R], Garage [G], Quests [J], Multiplayer [L], and Modal Escape
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (e.code === 'Escape' && (shopOpen || questsOpen || mpModalOpen)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        pokoAudio.playUiClick();
        setShopOpen(false);
        setQuestsOpen(false);
        setMpModalOpen(false);
        return;
      }

      const targetTag = (e.target as HTMLElement | null)?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') {
        return;
      }

      if (
        phase === GamePhase.Title &&
        !shopOpen &&
        !questsOpen &&
        !mpModalOpen &&
        (e.code === 'Enter' || e.code === 'Space')
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        startPlaying(activeLevel);
        return;
      }
      if (
        phase === GamePhase.GameOver &&
        !shopOpen &&
        !questsOpen &&
        !mpModalOpen &&
        (e.code === 'Enter' || e.code === 'Space')
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (snapshot?.outcome === OutcomeKind.Victory) {
          handleNextLevel();
        } else {
          handleRestart();
        }
        return;
      }
      if (e.code === 'KeyM') {
        handleToggleMute();
      } else if (e.code === 'KeyL') {
        pokoAudio.playUiClick();
        setShopOpen(false);
        setQuestsOpen(false);
        setMpModalOpen((v) => !v);
      } else if (
        e.code === 'KeyG' &&
        (phase === GamePhase.Playing ||
          phase === GamePhase.Paused ||
          phase === GamePhase.GameOver ||
          mpModalOpen)
      ) {
        pokoAudio.playUiClick();
        setQuestsOpen(false);
        setMpModalOpen(false);
        setShopOpen((v) => !v);
      } else if (
        e.code === 'KeyJ' &&
        (phase === GamePhase.Playing || phase === GamePhase.Paused)
      ) {
        pokoAudio.playUiClick();
        setShopOpen(false);
        setMpModalOpen(false);
        setQuestsOpen((v) => !v);
      } else if (
        e.code === 'KeyR' &&
        phase === GamePhase.Playing &&
        !shopOpen &&
        !questsOpen &&
        !mpModalOpen &&
        !mpState.room
      ) {
        handleRestart();
      }
    };
    window.addEventListener('keydown', onGlobalKey, true);
    return () => window.removeEventListener('keydown', onGlobalKey, true);
  }, [
    phase,
    activeLevel,
    snapshot,
    shopOpen,
    questsOpen,
    mpModalOpen,
    mpState.room,
    startPlaying,
    handleNextLevel,
    handleRestart,
    handleToggleMute,
  ]);

  const hasClaimableQuest = progression.quests.some(
    (q) => q.progress >= q.target && !q.claimed,
  );
  const hasFreeSpin = progression.spinTokens > 0;
  const syncedHud: HudState = {
    ...hud,
    coins: hud.demoActive ? hud.coins : progression.coins,
  };

  return (
    <main className="relative w-full h-full overflow-hidden select-none">
      <GameCanvas
        phase={effectiveCanvasPhase}
        activeLevel={activeLevel}
        runNonce={runNonce}
        bestScore={bestScore}
        selectedVehicle={progression.selectedVehicle}
        selectedTopper={progression.selectedTopper}
        walletCoins={progression.coins}
        startWithShield={progression.nextFreeShield}
        multiplayerRoom={mpState.room}
        localClientId={mpState.clientId}
        minimapRef={minimapRef}
        onHudUpdate={setHud}
        onPhaseChange={setPhase}
        onRunFinished={handleRunFinished}
        onAwardLiveCoins={handleAwardLiveCoins}
        onQuestEvent={handleQuestEvent}
        onConsumeStartShield={handleConsumeStartShield}
      />

      {phase === GamePhase.Title && !mpModalOpen && !shopOpen && (
        <TitleOverlay
          selectedLevel={activeLevel}
          highestUnlockedLevel={highestUnlockedLevel}
          muted={muted}
          onlineCount={mpState.onlineCount}
          activeRoomCode={mpState.room?.roomId ?? null}
          onSelectLevel={(lvl) => setActiveLevel(lvl)}
          onStart={() => startPlaying(activeLevel)}
          onOpenMultiplayer={() => {
            pokoAudio.playUiClick();
            setShopOpen(false);
            setQuestsOpen(false);
            setMpModalOpen(true);
          }}
          onToggleMute={handleToggleMute}
        />
      )}

      {phase === GamePhase.Playing && (
        <GameHud
          hud={syncedHud}
          minimapRef={minimapRef}
          muted={muted}
          hasClaimableQuest={hasClaimableQuest}
          hasFreeSpin={hasFreeSpin}
          multiplayerRoom={mpState.room}
          localClientId={mpState.clientId}
          onToggleMute={handleToggleMute}
          onPause={() => {
            pokoAudio.playUiClick();
            setShopOpen(false);
            setQuestsOpen(false);
            setMpModalOpen(false);
            setPhase(GamePhase.Paused);
          }}
          onOpenQuests={() => {
            pokoAudio.playUiClick();
            setShopOpen(false);
            setMpModalOpen(false);
            setQuestsOpen(true);
          }}
          onOpenShop={() => {
            pokoAudio.playUiClick();
            setQuestsOpen(false);
            setMpModalOpen(false);
            setShopOpen(true);
          }}
          onOpenMultiplayer={() => {
            pokoAudio.playUiClick();
            setShopOpen(false);
            setQuestsOpen(false);
            setMpModalOpen(true);
          }}
          onRestart={handleRestart}
        />
      )}

      {!shopOpen && !questsOpen && !mpModalOpen && (
        <StatusModal
          phase={phase}
          snapshot={snapshot}
          currentLevel={activeLevel}
          multiplayerRoom={mpState.room}
          localClientId={mpState.clientId}
          onResume={() => {
            document.body.dataset.state = GamePhase.Playing;
            setPhase(GamePhase.Playing);
          }}
          onRestart={handleRestart}
          onNextLevel={handleNextLevel}
          onOpenShop={() => {
            pokoAudio.playUiClick();
            setShopOpen(true);
          }}
          onOpenMultiplayer={() => {
            pokoAudio.playUiClick();
            if (mpState.room?.status === 'finished') {
              multiplayerClient.returnRoomToLobby();
            }
            setMpModalOpen(true);
          }}
          onLeaveMultiplayer={() => {
            pokoAudio.playUiClick();
            multiplayerClient.leaveRoom();
            setMpModalOpen(false);
            document.body.dataset.state = GamePhase.Title;
            setPhase(GamePhase.Title);
          }}
          onBackToTitle={() => {
            if (mpState.room) {
              multiplayerClient.leaveRoom();
            }
            document.body.dataset.state = GamePhase.Title;
            setPhase(GamePhase.Title);
          }}
        />
      )}

      <MultiplayerModal
        open={mpModalOpen}
        mpState={mpState}
        selectedVehicle={progression.selectedVehicle}
        selectedTopper={progression.selectedTopper}
        preferredLevel={activeLevel}
        onOpenShop={() => {
          setMpModalOpen(false);
          setShopOpen(true);
        }}
        onEnterActiveShift={handleEnterActiveMultiplayerShift}
        onClose={() => setMpModalOpen(false)}
      />

      <GarageShopModal
        open={shopOpen}
        progression={progression}
        onSelectOrBuyVehicle={handleSelectOrBuyVehicle}
        onSelectOrBuyTopper={handleSelectOrBuyTopper}
        onSpinWheel={handleSpinWheel}
        onClose={() => setShopOpen(false)}
      />

      <QuestsRulesModal
        open={questsOpen}
        progression={progression}
        onClaimQuest={handleClaimQuest}
        onClose={() => setQuestsOpen(false)}
      />
    </main>
  );
}
