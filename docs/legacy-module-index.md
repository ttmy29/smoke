# 旧包模块／方法静态索引

由 `tools/legacy-module-index.mjs` 从 V1.0.7 旧微信编译包生成；只解析代码，不运行旧包。统计排除 @swc 运行时及 vendor。该索引是历史快照，**尚未覆盖 V1.0.8** 新增的 `chunk_10`～`chunk_13`、`world-tools/`、`custom-tab-bar/` 等内容，不能再称为当前版本的全包索引。当前基准与选文件规则见 `legacy-reference.md`，详细规则见 `legacy-rules.md`，与当前实现差异见 `legacy-vs-current.md`。

V1.0.7 共索引 122 个模块。表中“导出”是静态可识别的公开名称；“方法”是小程序 Page/Component/App/Behavior 方法与编译后类成员名。匿名回调和未导出的内部函数不在此索引，不能将此表当成逐方法语义证明，也不能据此断言 V1.0.8 没有新增页面或方法。

## app（1）

| 模块（所在编译文件） | 导出 | 静态可识别方法 |
| --- | --- | --- |
| `app.js`（appservice.app.js） | — | `onError`、`onHide`、`onLaunch`、`onShow`、`onUnhandledRejection` |

## behaviors（1）

| 模块（所在编译文件） | 导出 | 静态可识别方法 |
| --- | --- | --- |
| `behaviors/achievement-modal.js`（appservice.app.js） | `achievementModal` | — |

## config（2）

| 模块（所在编译文件） | 导出 | 静态可识别方法 |
| --- | --- | --- |
| `config/developer-authorization.js`（appservice.app.js） | `DEVELOPER_BUILD`、`DEVELOPER_PUBLIC_KEY` | — |
| `config/engagement.js`（appservice.app.js） | `DAILY_PLACEMENTS`、`DAILY_UNLOCK_GROUPS`、`DAILY_UNLOCK_GROUP_IDS`、`ENGAGEMENT_AD_UNITS`、`ENGAGEMENT_MODE`、`ENGAGEMENT_POLICIES`、`dailyUnlockGroupForMember`、`dailyUnlockGroupForPlacement`、`makeEngagementPolicies` | — |

## domain（33）

| 模块（所在编译文件） | 导出 | 静态可识别方法 |
| --- | --- | --- |
| `domain/achievement-ledger.js`（appservice.app.js） | `applyAchievementAction`、`applyAchievementForeground`、`applyAchievementSourceEvent`、`createAchievementLedger`、`isAchievementLedgerState` | — |
| `domain/achievements.js`（appservice.app.js） | `ACHIEVEMENTS`、`ACHIEVEMENT_GROUPS`、`ACHIEVEMENT_TARGET_IDS`、`captureAchievementUnlocks`、`countUnlockedAchievements`、`createAchievementMetrics`、`deriveAchievementProgress`、`resolveAchievementDefinition` | — |
| `domain/badges.js`（appservice.app.js） | `BADGES`、`FOUNDER_PLAYER_BADGE`、`badgeDefinition`、`equippedBadge`、`isBadgeOwnership` | — |
| `domain/check-in-access.js`（appservice.app.js） | `CHECK_IN_FEATURES`、`CHECK_IN_UNLOCK_DAYS`、`newlyUnlockedCheckInFeatures` | — |
| `domain/checksum.js`（appservice.app.js） | `fnv1aChecksum`、`utf8ByteLength` | — |
| `domain/cyber-session-v3.js`（appservice.app.js） | `completeCyberExhaleV3`、`completeCyberInhaleV3`、`confirmSessionExtraction`、`createCyberSessionV3`、`extinguishCyberSessionV3`、`flickCyberAshV3`、`igniteCyberStickV3`、`isCyberSessionV3Ended`、`isStoredCyberSessionV3`、`recordSmokeRingV3`、`smokingAshStateV3`、`startCyberInhaleV3` | — |
| `domain/cyber-session.js`（appservice.app.js） | `EXHALE_THRESHOLD_MS`、`FULL_CIGARETTE_PERMILLE`、`MAX_BURN_PERMILLE`、`MAX_INHALE_MS`、`MIN_BURN_PERMILLE`、`MIN_INHALE_MS`、`calculateBurnPreviewPermille`、`calculateSessionBurnPermille`、`clampInhaleDuration`、`shouldExhaleAfterInhale` | — |
| `domain/cyber-types.js`（appservice.app.js） | `DEFAULT_CYBER_SETTINGS`、`PACKS`、`isAshVisual`、`isCyberSettings`、`isIgnitionSoundId`、`isPackId`、`isShadowlessPack`、`isSmokeVisual`、`isSmokingEnvironmentId` | — |
| `domain/cyber-v3-types.js`（appservice.app.js） | — | — |
| `domain/effect-tasks.js`（appservice.app.js） | `ASH_EFFECT_OPTIONS`、`EFFECT_TASKS`、`applyEffectTaskEvent`、`completeEffectTask`、`createEffectTaskState`、`effectTaskCheckKey`、`effectTaskForPlacement`、`effectTaskIdsToCheck`、`effectTaskProgress`、`isEffectTaskState` | — |
| `domain/engagement.js`（appservice.app.js） | — | — |
| `domain/gift-display.js`（appservice.app.js） | `ashVisualName` | — |
| `domain/gift-send.js`（appservice.app.js） | `DAILY_GIFT_LIMIT`、`buildStructuredGiftId`、`isGiftSendState`、`isStructuredGiftId`、`randomHex` | — |
| `domain/history-page.js`（appservice.app.js） | `HISTORY_PAGE_MAX_BYTES`、`HISTORY_PAGE_MAX_RECORDS`、`createEmptyHistoryManifest`、`decodeHistoryPage`、`encodeHistoryPage`、`historyPageId`、`historyPageMeta`、`isHistoryManifestV3`、`isHistoryPageKind`、`replaceHistoryPageMeta` | — |
| `domain/local-date-time.js`（appservice.app.js） | `formatLocalDateTime` | — |
| `domain/local-day.js`（appservice.app.js） | `calendarDaySpanInclusive`、`formatLocalDay`、`isNextCalendarDay`、`isValidDayString` | — |
| `domain/loose-session.js`（appservice.app.js） | `createLooseCyberSessionV4`、`isLooseCyberSessionV4` | — |
| `domain/microphone-breath.js`（appservice.app.js） | `MIC_OPTIONS`、`MIC_SENSITIVITY_PROFILES`、`MicrophoneBreathDetector`、`microphoneStrengthPercent`、`pcmRms` | `feed`、`reset` |
| `domain/pack-inventory.js`（appservice.app.js） | `PACK_SLOT_COUNT`、`PackDomainError`、`confirmExtraction`、`countAvailableSlots`、`countReservedSlots`、`createFreshPack`、`debitGiftSlot`、`isPackEmpty`、`openPack`、`releaseReservation`、`reserveExactSlot`、`reserveRandomSlot` | — |
| `domain/pack-settlement.js`（appservice.app.js） | `SettlementDomainError`、`ensurePackSettlement` | — |
| `domain/quit-log.js`（appservice.app.js） | `MAX_QUIT_FEELING_LENGTH`、`createQuitDayCancellation`、`createQuitDayLog`、`deriveQuitDaySummary`、`isQuitDayCancellation`、`isQuitDayHistoryRecord`、`isQuitDayLog`、`normalizeQuitFeeling` | — |
| `domain/real-smoking.js`（appservice.app.js） | `DEFAULT_REAL_PRICE`、`REAL_SMOKING_SETTINGS_KEY`、`activeRealSmokingEntries`、`isRealSmokingEvent`、`isRealSmokingPrice`、`realSmokingCost`、`realSmokingDays`、`realSmokingUnitCost` | — |
| `domain/ring-formation.js`（appservice.app.js） | `RING_FORMATION_OPTIONS`、`isRingFormationPreset`、`resolveRingFormationSettings`、`ringFormationOption` | — |
| `domain/share-copy.js`（appservice.app.js） | `APP_SHARE_TITLES`、`GIFT_SHARE_TITLES`、`SHARE_APP_NAME`、`appShareTitle`、`giftShareTitle` | — |
| `domain/smoke-lab.js`（appservice.app.js） | `DEFAULT_SMOKE_VISUAL_SCHEME`、`DIRECTIONAL_RING_MIN_DISTANCE`、`EXHALE_STYLE_OPTIONS`、`RING_SHAPE_OPTIONS`、`SMOKE_AMOUNT_OPTIONS`、`SMOKE_COLOR_OPTIONS`、`cloneSmokeVisualScheme`、`createDefaultSmokeSchemeRecord`、`createSharedSmokeEffectSnapshot`、`createSmokeSchemeStore`、`deriveDirectionalRingMotion`、`deriveSmokeUnlockState`、`exhaleStyleLabel`、`isExhaleStyle`、`isRingShape`、`isSharedSmokeEffectSnapshot`、`isSmokeAmount`、`isSmokeColorId`、`isSmokeSchemeRecord`、`isSmokeSchemeStore`、`isSmokeVisualScheme`、`normalizeSharedSmokeEffectSnapshot`、`resolveSmokeVisualScheme`、`restoreSmokeVisualScheme`、`ringShapeLabel`、`ringShapeToSmokeVisual`、`saveSmokeVisualScheme`、`smokeAmountLabel`、`smokeAmountMultiplier`、`smokeColorHex`、`smokeColorLabel`、`smokeSchemeSourceLabel`、`smokeSchemeSummary` | — |
| `domain/smoking-physics.js`（appservice.app.js） | `ASH_GROWTH_PER_BURN`、`ASH_LONG_MAX`、`ASH_LONG_MIN`、`ASH_RELOAD_MAX`、`ASH_RELOAD_MIN`、`ASH_UNIT`、`CHAR_MAX`、`CIGARETTE_FULL_LENGTH`、`DEFAULT_FILTER_RATIO`、`EMBER_MAX`、`canFlickSmokingAsh`、`clampUnit`、`computeAshAfterFlick`、`computeAshFlickThreshold`、`computeCigaretteBurnGeometry`、`createSmokingAshState`、`flickSmokingAsh`、`growSmokingAsh`、`hashUnit` | — |
| `domain/social-avatar.js`（appservice.app.js） | `SOCIAL_AVATAR_JPEG_PREFIX`、`SOCIAL_AVATAR_TOKEN_MAX_LENGTH`、`avatarDataUrlToToken`、`avatarTokenToDataUrl`、`encodeAvatarJpeg`、`isSocialAvatarToken` | — |
| `domain/social-gift.js`（appservice.app.js） | `LOOSE_BOX_TIERS`、`SOCIAL_ID_PATTERN`、`SOCIAL_NICKNAME_MAX_LENGTH`、`SOCIAL_PROTOCOL_VERSION`、`SOCIAL_SHARE_PATH_MAX_LENGTH`、`buildReceiveRanking`、`currentGiftThemeSnapshot`、`decideGiftReceipt`、`displaySocialNickname`、`formatGiftCalendarDate`、`getLooseBoxTier`、`getNextLooseBoxTier`、`giftSharePath`、`isGiftThemeSnapshot`、`isLooseBoxLevel`、`isSocialId`、`isSocialProfileReady`、`looseCigaretteSourceText`、`parseGiftPayload`、`sanitizeSocialNickname` | — |
| `domain/social-page.js`（appservice.app.js） | `SOCIAL_PAGE_KINDS`、`SOCIAL_PAGE_MAX_BYTES`、`SOCIAL_PAGE_MAX_RECORDS`、`createEmptySocialManifest`、`decodeSocialPage`、`encodeSocialPage`、`isSocialManifestV1`、`isSocialPageKind`、`replaceSocialPageMeta`、`socialPageId`、`socialPageMeta` | — |
| `domain/storage-limits.js`（appservice.app.js） | `STORAGE_VALUE_MAX_BYTES` | — |
| `domain/tasks.js`（appservice.app.js） | `DEFAULT_PACK_ID`、`GOLD_PACK_TICKET_COST`、`PACK_UNLOCK_TASKS`、`TICKET_PASSPHRASE_REWARD`、`applyTaskEvent`、`capturePackUnlocks`、`createTaskState`、`derivePackUnlocks`、`isAdUnlockablePack`、`isFreePack`、`isPackUnlocked`、`isShadowlessPassphrase`、`isTicketRewardPassphrase` | — |
| `domain/ticket-wallet.js`（appservice.app.js） | `MAX_RECENT_TICKET_ENTRIES`、`TicketDomainError`、`applyEntry`、`assertTicketWallet`、`checkIn`、`createInstallTicketWallet`、`grantTicket`、`spendTicketForRefill` | — |
| `domain/utf8-token.js`（appservice.app.js） | `decodeBytesToken`、`decodeUtf8Token`、`encodeBytesToken`、`encodeUtf8Token` | — |

## presentation（31）

| 模块（所在编译文件） | 导出 | 静态可识别方法 |
| --- | --- | --- |
| `presentation/achievement-session-runtime.js`（appservice.app.js） | `AchievementSessionRuntime`、`SESSION_STATISTICS_INTERVAL_MS` | `baseAction`、`captureForegroundRemainder`、`clearFlushTimer`、`detach`、`enqueue`、`finish`、`finishSession`、`flushPending`、`normalizeMetadata`、`pauseForeground`、`report`、`reportState`、`resumeForeground`、`scheduleFlush`、`start`、`updateForeground`、`updateMetadata` |
| `presentation/animation-runtime.js`（appservice.app.js） | `AnimationRuntime`、`MAX_ANIMATION_DELTA_MS` | `attach`、`cancelScheduledFrame`、`captureGuard`、`destroy`、`hasPendingFrame`、`invalidate`、`isAlive`、`isVisible`、`monotonicNow`、`resume`、`schedule`、`setCadence`、`suspend`、`tick` |
| `presentation/box-gift-preview.js`（appservice.app.js） | `BoxGiftItem`、`buildBoxGiftPreview` | — |
| `presentation/cigarette-tip-material.js`（appservice.app.js） | `CHAR_FOLD_COLOR`、`CigaretteTipMaterial`、`TIP_EMBER_HEIGHT`、`TIP_REFERENCE_DIAMETER`、`createAshMaterial`、`createCharFoldGradient`、`tipDisplayGeometry` | `drawAsh`、`drawEmber`、`drawFragments`、`ensureTexture`、`traceAsh` |
| `presentation/effect-geometry.js`（appservice.app.js） | `drawAshMotif`、`effectRingPoint` | — |
| `presentation/field-ambience.js`（appservice.app.js） | `drawFieldAmbience` | — |
| `presentation/flick-detector.js`（appservice.app.js） | `DEFAULT_FLICK_COOLDOWN_MS`、`DEFAULT_FLICK_THRESHOLD`、`FLICK_MAX_SAMPLE_GAP_MS`、`FLICK_WINDOW_MS`、`createFlickDetector` | — |
| `presentation/gift-effect-preview.js`（appservice.app.js） | `giftEffectPreviewItems` | — |
| `presentation/home-daily-copy.js`（appservice.app.js） | `HOME_DAILY_COPIES`、`presentHomeDailyCopy` | — |
| `presentation/home-status.js`（appservice.app.js） | `formatLastSmokeTime`、`presentHomeCheckinStatus`、`presentHomeSmokingStatus` | — |
| `presentation/ignition-sound.js`（appservice.app.js） | `DEFAULT_IGNITION_SOUND_ID`、`IGNITION_SOUND_OPTIONS`、`getIgnitionSoundOption`、`ignitionSoundPickerItems`、`normalizeIgnitionSoundId` | — |
| `presentation/motion-timings.js`（appservice.app.js） | `CIGARETTE_EXTRACTION_MOTION_MS`、`CIGARETTE_EXTRACTION_PRELUDE_MS`、`CIGARETTE_OCCLUSION_CLEAR_PROGRESS`、`REDUCED_EXTRACTION_MOTION_MS`、`REDUCED_EXTRACTION_PRELUDE_MS`、`cigaretteExtractionMotionDuration`、`homeOpeningMotion` | — |
| `presentation/native-ad-state.js`（appservice.app.js） | `onNativeAdState` | — |
| `presentation/pack-theme.js`（appservice.app.js） | `getPackOption`、`getPackTheme`、`unlockTaskCopy` | — |
| `presentation/rain-ripples.js`（appservice.app.js） | `drawRainRipples` | — |
| `presentation/ring-formation.js`（appservice.app.js） | `RING_FORMATION_DURATION_MS`、`sampleRingFormation` | — |
| `presentation/sea-surf.js`（appservice.app.js） | `drawSeaSurf`、`seaSurfState` | — |
| `presentation/session-cigarette-geometry.js`（appservice.app.js） | `sessionCigaretteRestGeometry` | — |
| `presentation/session-entry-motion.js`（appservice.app.js） | `sharedCigaretteEntryMotion` | — |
| `presentation/session-microphone.js`（appservice.app.js） | `SessionMicrophone`、`sessionMicrophone` | `armWatchdog`、`clearWatchdog`、`fail`、`pauseForPlayback`、`resumeAfterPlayback`、`start`、`stop` |
| `presentation/session-progress-checkpoint.js`（appservice.app.js） | `SessionProgressCheckpoint` | `clear`、`dispose`、`flush`、`queue`、`schedule` |
| `presentation/session-sound.js`（appservice.app.js） | `SESSION_SOUND_ASSETS`、`SessionSoundController`、`sessionSoundAssetForCue` | `destroy`、`enabledAssets`、`getAudio`、`handleAudioEnded`、`play`、`playAshAccent`、`playAsset`、`playCue`、`preloadEnabledAssets`、`preloadNextAsset`、`retryFailedAsset`、`setEnabled`、`setIgnitionSound`、`setPreferences`、`startIgnitionAttempt`、`stop`、`stopIgnitionAttempt`、`stopPlayback` |
| `presentation/session-waveform.js`（appservice.app.js） | `SessionWaveform` | `cue`、`isActive`、`reset`、`sample` |
| `presentation/share-card.js`（appservice.app.js） | `SHARE_CARD_HEIGHT`、`SHARE_CARD_WIDTH`、`drawShareCard` | — |
| `presentation/smoke-wind.js`（appservice.app.js） | `SmokeWindField` | `clear`、`push`、`sample`、`steer`、`update` |
| `presentation/smoking-ambient.js`（appservice.app.js） | `AMBIENT_CROSSFADE_MS`、`SmokingAmbientController` | `createSlot`、`destroy`、`disposeSlot`、`finishCrossfade`、`handleSlotEnded`、`handleSlotError`、`maybeStartCrossfade`、`prepareStandby`、`resume`、`select`、`setEnabled`、`startEnvironment`、`stop`、`stopPlayback`、`updateCrossfade` |
| `presentation/smoking-environment.js`（appservice.app.js） | `DEFAULT_SMOKING_ENVIRONMENT_ID`、`SMOKING_ENVIRONMENTS`、`environmentPickerItems`、`getSmokingEnvironment`、`normalizeSmokingEnvironmentId` | — |
| `presentation/smoking-particles.js`（appservice.app.js） | `MAX_SMOKING_PARTICLES`、`SmokingParticleEngine` | `cancelRingFormation`、`clear`、`deflectSmoke`、`draw`、`drawAsh`、`drawBubble`、`drawFormationRing`、`drawMeteor`、`drawRing`、`drawSmoke`、`drawSpark`、`emitAshBubbles`、`emitAshEffect`、`emitAshFirework`、`emitAshFlick`、`emitAshWarningDust`、`emitExhale`、`emitFireworkBurst`、`emitRing`、`emitSpark`、`formationSprite`、`hasActiveParticles`、`hasActiveRingFormation`、`particleCount`、`push`、`smokeSprite`、`startRingFormation`、`update`、`updateRingFormation` |
| `presentation/smoking-visual-policy.js`（appservice.app.js） | `EMBER_HEAT_ATTACK_MS`、`EMBER_HEAT_RELEASE_MS`、`HUMAN_SMOKE_WHITE`、`advanceEmberHeat`、`breathingHaloRadius`、`burnContourOffset`、`charFoldContourOffset`、`exhaleSmokeProfile`、`exhaleSmokeStrength`、`humanExhaleOrigin`、`shouldSpawnTipSmoke`、`tipSmokeAnchorBlend`、`tipSmokeTrailOffset` | — |
| `presentation/static-canvas-layer.js`（appservice.app.js） | `StaticCanvasLayer` | `clear`、`draw` |
| `presentation/tip-smoke.js`（appservice.app.js） | `TipSmokeRenderer` | `clear`、`draw`、`hasTrails`、`knotCount`、`release`、`update` |

## services（33）

| 模块（所在编译文件） | 导出 | 静态可识别方法 |
| --- | --- | --- |
| `services/achievement-changes.js`（appservice.app.js） | `isAchievementActivitySuspended`、`isAchievementNotificationAllowed`、`notifyAchievementChanges`、`resetAchievementInteractionState`、`setAchievementInteractionBlocked`、`setAchievementVisibility`、`subscribeAchievementChanges` | — |
| `services/achievement-service.js`（appservice.app.js） | `getAchievementUnreadSummary`、`getNextAchievementNotice`、`isAchievementNotificationAllowed`、`markAchievementToastShown`、`releaseAchievementNotice`、`setAchievementInteractionBlocked`、`subscribeAchievementChanges`、`synchronizeAchievementTasks` | — |
| `services/achievement-source-bridge.js`（appservice.app.js） | `installAchievementSourceRecorder`、`recordAchievementSourceEvent`、`safeRecordAchievementSourceEvent` | — |
| `services/achievement-store.js`（appservice.app.js） | `ACHIEVEMENT_HOT_KEY`、`ACHIEVEMENT_JOURNAL_KEY`、`commitAchievementEvent`、`loadAchievementHot`、`persistAchievementHot` | — |
| `services/achievement-tracker.js`（appservice.app.js） | `ACHIEVEMENT_SOURCE_PENDING_KEY`、`installAchievementActivityTracking`、`onAchievementInteraction`、`recordAchievementAction`、`recordAchievementActions`、`recordAchievementActivity`、`recordAchievementSourceEvent`、`resetAchievementTracking`、`retryPendingAchievementSources`、`setAchievementAppVisible`、`synchronizeAchievementTasks`、`synchronizeTaskNotices` | — |
| `services/cyber-data.js`（appservice.app.js） | `ensureCurrentCyberData`、`rebuildCurrentCyberData` | — |
| `services/cyber-game-service.js`（appservice.app.js） | `CyberGameError`、`archiveEvictedTicketEntries`、`beginRandomStickSession`、`beginStickExtraction`、`cancelStickExtraction`、`checkInForTicket`、`claimPassphraseTickets`、`commitEndedCyberSession`、`confirmStickExtraction`、`ensureUnlockedPackInstances`、`exchangeTicketForPack`、`finalizeActiveCyberSessionWithoutResume`、`getCyberGameSnapshot`、`openCyberPack`、`recordFirstQuitDay`、`refillPackAfterEngagement`、`refillPackWithTicket`、`saveCyberSessionProgress`、`selectCyberPack`、`unlockShadowlessPack` | — |
| `services/cyber-report-service.js`（appservice.app.js） | `findCompletedCyberSession`、`getCyberHomeStatusSnapshot`、`getCyberReportSnapshot` | — |
| `services/cyber-v3-store.js`（appservice.app.js） | `CYBER_ACTIVE_KEY`、`CYBER_APPLICATION_JOURNAL_KEY`、`CYBER_HOT_KEY`、`CYBER_SETTINGS_KEY`、`HOT_STORE_HARD_BYTES`、`HOT_STORE_TARGET_BYTES`、`MAX_RECENT_TRANSACTION_IDS`、`STORAGE_NONESSENTIAL_STOP_KB`、`STORAGE_WARNING_KB`、`canWriteNonessentialCyberV3Storage`、`clearAllCyberV3Data`、`commitCyberV3StateTransaction`、`cyberHotStoreBytes`、`cyberStoragePressure`、`diagnoseCyberHotStoreV3`、`ensureCyberV3Store`、`getCyberV3LocalCapacity`、`isCyberHotStoreV3`、`isCyberSessionV3`、`loadActiveCyberSessionV3`、`loadCyberSettingsV3`、`persistCyberHotStoreV3`、`recoverPendingCyberV3State`、`saveActiveCyberSessionV3`、`saveCyberSettingsV3`、`subscribeCyberSettingsChanged` | — |
| `services/daily-access.js`（appservice.app.js） | `DAILY_ACCESS_KEY`、`checkInAccess`、`dailyAccessGranted`、`dailyAccessGroupState`、`dailyAccessSnapshot`、`effectEligible`、`effectTaskLockHint`、`effectiveSessionSettings`、`effectiveSmokeScheme`、`grantDailyAccess`、`hasUnlockedUnlimitedRings`、`isDailyPlacement`、`notifyAccessChanged`、`subscribeAccessChanged`、`validEngagementReceipt` | — |
| `services/development-access.js`（appservice.app.js） | `DEVELOPMENT_ACCESS_KEY`、`DEVELOPMENT_DEVICE_KEY`、`developmentDay`、`developmentVersion`、`disableDevelopmentAccess`、`enableDevelopmentAccess`、`enableDevelopmentCheckinAccess`、`enableDevelopmentDayAccess`、`getDevelopmentDeviceCode`、`isDevelopmentCheckinMode`、`isDevelopmentDataActive`、`isDevelopmentEnvironment`、`isDevelopmentPassphrase`、`isDevelopmentUnlocked` | — |
| `services/development-fixtures.js`（appservice.app.js） | `createUnlockedDevelopmentStore` | — |
| `services/diagnostic-log.js`（appservice.app.js） | `DIAGNOSTIC_FILE`、`DIAGNOSTIC_KEY`、`clearDiagnosticLog`、`diagnosticCode`、`readDiagnosticLog`、`recordDiagnostic` | — |
| `services/effect-task-service.js`（appservice.app.js） | `completeEffectTaskReward`、`recordEffectAction` | — |
| `services/engagement-rewards.js`（appservice.app.js） | `applyEngagementReward`、`engagementAction` | — |
| `services/engagement-service.js`（appservice.app.js） | `buildShareContent`、`createEngagementController` | — |
| `services/engagement-share-router.js`（appservice.app.js） | `SHARE_MIN_ELAPSED_MS`、`awaitShareReturn`、`hasPendingEngagementAction`、`registerEngagementShare`、`routeEngagementShare`、`setEngagementVideoPending`、`settleEngagementShareReturns` | — |
| `services/gift-send-service.js`（appservice.app.js） | `GiftSendError`、`commitGiftSend`、`committedGiftOperation`、`giftSendAvailability`、`giftSendErrorMessage`、`newGiftOperationId` | — |
| `services/gift-session-settings.js`（appservice.app.js） | `canUseGiftEnvironment`、`giftSessionSettings` | — |
| `services/history-page-store.js`（appservice.app.js） | `HISTORY_DIRECTORY`、`HISTORY_FILE_SOFT_LIMIT_BYTES`、`HISTORY_JOURNAL_KEY`、`HISTORY_MANIFEST_KEY`、`appendHistoryRecord`、`clearHistoryPages`、`ensureHistoryManifest`、`findHistoryRecordsReverse`、`historyManifestBytes`、`listHistoryRecords`、`recoverPendingHistoryWrite`、`withHistoryReadScope` | — |
| `services/local-data.js`（appservice.app.js） | `DEVELOPMENT_STORAGE_PREFIX`、`clearDevelopmentLocalData`、`localDataDirectory`、`localStorage`、`localStorageKey`、`resetDevelopmentRun` | — |
| `services/local-storage-cache.js`（appservice.app.js） | `LOCAL_STORAGE_CACHE_MAX_BYTES`、`cachedStorage`、`installLocalStorageCache`、`invalidateLocalStorageCache`、`withFreshLocalStorage` | — |
| `services/my-miniprogram-reward.js`（appservice.app.js） | `MY_MINIPROGRAM_CHECK_TIMEOUT_MS`、`MY_MINIPROGRAM_REWARD_TICKETS`、`checkMyMiniProgramAdded`、`claimMyMiniProgramReward`、`hasClaimedMyMiniProgramReward`、`hasVerifiedMyMiniProgramAdded` | — |
| `services/page-navigation.js`（appservice.app.js） | `isPageNavigating`、`navigateHome`、`openPage` | — |
| `services/privacy-authorization.js`（appservice.app.js） | `PRIVACY_AGREE_BUTTON_ID`、`installPrivacyAuthorization`、`registerPrivacyHost`、`reportPrivacyExposure`、`resolvePrivacyAuthorization`、`setPrivacyHostActive` | — |
| `services/quit-log-reader.js`（appservice.app.js） | `getLatestQuitDayRecord`、`getQuitDayLog`、`getQuitDaySummary`、`getQuitDaySummaryAt`、`listQuitDayLogs` | — |
| `services/real-smoking-reader.js`（appservice.app.js） | `loadRealSmokingPrice`、`readRealSmokingEvents`、`realQuitCancellations`、`realSmokingOnDay` | — |
| `services/rewarded-video.js`（appservice.app.js） | `isRewardedVideoAvailable`、`requestRewardedVideo` | — |
| `services/share-card-cache.js`（appservice.app.js） | `SHARE_CARD_CACHE_MAX_FILES`、`SHARE_CARD_MAX_BYTES`、`clearShareCardCache`、`installShareCardWarmup`、`prepareShareCards`、`setShareCardWarmupBlocked`、`shareContentWithCover` | — |
| `services/smoke-gift-share.js`（appservice.app.js） | `createSmokeGiftShare`、`getCurrentSmokeGiftTheme`、`giftProfileFlowUrl`、`giftSourceFromProfileQuery`、`resolveSmokeGiftSource`、`smokeGiftAvailability` | — |
| `services/smoke-lab-store.js`（appservice.app.js） | `SMOKE_LAB_HARD_BYTES`、`SMOKE_LAB_STORE_KEY`、`SMOKE_LAB_TARGET_BYTES`、`ensureSmokeLabStore`、`getRingFormationSettings`、`getSmokeLabEditingContext`、`getSmokeLabRuntimeSnapshot`、`persistSmokeLabStore`、`resolveStoredSmokeScheme`、`restoreStoredSmokeScheme`、`saveStoredSmokeScheme`、`setHandSmokeEnabled`、`setRingFormationSettings`、`smokeEffectSnapshotForContext`、`smokeUnlockState`、`unlimitedRingsActive` | — |
| `services/social-gift-service.js`（appservice.app.js） | `SOCIAL_ACTIVE_KEY`、`SOCIAL_HOT_KEY`、`SOCIAL_OPERATION_JOURNAL_KEY`、`SOCIAL_PROFILE_KEY`、`acceptGift`、`acceptGiftDirect`、`applyLooseBoxUpgradeAfterEngagement`、`beginLooseCigaretteSession`、`cancelLooseCigaretteExtraction`、`changeLooseSessionEnvironment`、`clearAllSocialGiftData`、`commitEndedLooseSession`、`commitLooseEffectProgress`、`confirmLooseCigaretteExtraction`、`createGiftPayloadForShare`、`discardLooseCigarette`、`ensureSocialStore`、`finalizeActiveLooseSessionWithoutResume`、`getLooseBoxSnapshot`、`getLooseCigarette`、`getLooseSessionRecencySnapshot`、`getReceiveRanking`、`getReceivedGiftEvent`、`getSocialLocalCapacity`、`isLocalSocialProfile`、`isSocialHotV2`、`listAvailableLooseCigarettes`、`listCompletedLooseSessions`、`listReceivedGiftEvents`、`listSmokedLooseCigarettes`、`loadActiveLooseSession`、`markLooseBoxViewed`、`previewGift`、`reconcileSocialHotFromHistory`、`recoverPendingSocialOperation`、`saveLooseSessionProgress`、`saveSocialProfile` | — |
| `services/social-page-store.js`（appservice.app.js） | `SOCIAL_DIRECTORY`、`SOCIAL_FILE_SOFT_LIMIT_BYTES`、`SOCIAL_MANIFEST_KEY`、`SOCIAL_PAGE_JOURNAL_KEY`、`appendSocialRecord`、`clearSocialPages`、`ensureSocialManifest`、`findSocialRecordsReverse`、`hasSocialRecordVersion`、`listSocialRecords`、`recoverPendingSocialPageWrite` | — |

## components（16）

| 模块（所在编译文件） | 导出 | 静态可识别方法 |
| --- | --- | --- |
| `components/achievement-icon/achievement-icon.js`（chunk_0.appservice.js） | — | — |
| `components/achievement-notice/achievement-notice.js`（chunk_0.appservice.js） | — | `activateIfTopPage`、`clearTimers`、`deactivatePage`、`dismissNotice`、`finishDismiss`、`getPageId`、`guardNoticeAvailability`、`handleAchievementChange`、`isTopPage`、`persistShown`、`presentNext`、`queueRetry`、`releaseReservation`、`schedulePresent`、`startDismissTimer`、`stopEvent` |
| `components/badge-mark/badge-mark.js`（chunk_1.appservice.js） | — | `close`、`imageFailed`、`noop`、`selectBadge`、`viewBadge` |
| `components/check-in-unlock/check-in-unlock.js`（chunk_2.appservice.js） | — | `close`、`noop`、`openSettings` |
| `components/daily-unlock-group/daily-unlock-group.js`（chunk_3.appservice.js） | — | `completed`、`refresh` |
| `components/desktop-guide/desktop-guide.js`（chunk_4.appservice.js） | — | `claimReward`、`closeDesktopGuide`、`confirmDesktopGuide`、`keepDesktopGuideOpen`、`refreshAddedStatus` |
| `components/effect-task-lock/effect-task-lock.js`（chunk_3.appservice.js） | — | — |
| `components/engagement-action/engagement-action.js`（chunk_0.appservice.js） | — | `activate`、`completeAction`、`refreshAction` |
| `components/gift-share-control/gift-share-control.js`（chunk_3.appservice.js） | — | `closeRefill`、`keepRefill`、`prepare`、`refillCompleted`、`refresh`、`sourceInput` |
| `components/loose-container-visual/loose-container-visual.js`（chunk_5.appservice.js） | — | `syncVisual` |
| `components/pack-box/pack-box.js`（chunk_4.appservice.js） | — | `handlePackTap`、`handleStickTap`、`measureExtractionSource` |
| `components/privacy-authorization/privacy-authorization.js`（chunk_6.appservice.js） | — | `agree`、`blockTouch`、`openContract`、`refuse` |
| `components/ring-formation-controls/ring-formation-controls.js`（chunk_3.appservice.js） | — | `refresh`、`select`、`toggle` |
| `components/session-experience/session-experience.js`（chunk_3.appservice.js） | — | `achievementMetadata`、`activatePrewarmedSession`、`animationCadence`、`applySessionState`、`applyShakeAshSetting`、`beginInhale`、`cancelFrame`、`cancelIgnition`、`cancelInhale`、`cancelResultTransition`、`cancelSessionWarmup`、`chooseAshStyle`、`chooseEnvironment`、`chooseIgnitionStyle`、`chooseMicrophoneSensitivity`、`chooseRingFormation`、`chooseSmokeRingShape`、`chooseSoundDetails`、`clearNativeHudAreas`、`clearReinhaleState`、`closeEnvironmentPicker`、`closeSmokeLab`、`closeToolPicker`、`commitSettledSessionAndRoute`、`completeAndRoute`、`configureChromeInset`、`configureSession`、`cueWaveform`、`disposeSessionSurface`、`drawAshStack`、`drawBreathingHalo`、`drawBurningTip`、`drawCigarette`、`drawEnvironmentMotion`、`drawExhaleHalo`、`drawExhaleHandoff`、`drawFilterDetail`、`drawFilterEmblem`、`drawFrame`、`drawIdleSmoke`、`drawIgnitionArc`、`drawIgnitionEffect`、`drawIgnitionFlame`、`drawInhaleHalo`、`drawPaperMatchIgnition`、`drawPaperMatchTipFlame`、`drawSessionHud`、`endIgnition`、`endInhale`、`engagementCompleted`、`ensureRingFormationAccess`、`finalizeSessionForLeave`、`finishAchievementSession`、`finishEntryWarmupFrame`、`finishExhale`、`finishIgnition`、`finishInhale`、`flickAsh`、`flushPendingSmokeLab`、`flushSessionStatistics`、`handleAshTool`、`handleCanvasLongPress`、`handleCanvasTap`、`handleCanvasTouchCancel`、`handleCanvasTouchEnd`、`handleCanvasTouchMove`、`handleCanvasTouchStart`、`handleDirectionalSmokeRing`、`handleErrorAction`、`handleGiftModalChange`、`handleSceneReadyChange`、`handleSmokeLabSchemeChange`、`handleSmokeLabShareProfileRequest`、`handleSmokeLabUnlimitedChange`、`handleSmokeRing`、`initializeSessionSurface`、`isAchievementInteractionBlocked`、`isEntryAnimating`、`loadSessionSurfaceState`、`measureSessionOverlay`、`openMicrophonePermission`、`openSmokeLab`、`openSmokeLabPanel`、`pauseSessionSurface`、`pauseSmokeSettings`、`prepareSessionCanvas`、`refreshDailySettings`、`refreshHudGeometry`、`refreshRingUnlockState`、`refreshSmokeLabRuntime`、`releaseSessionHandoff`、`releaseTipSmokeTrails`、`rememberMenuScroll`、`reportAchievementAction`、`reportAchievementState`、`requestFrame`、`resolveCanvasGestureAction`、`restoreMenuScrollAfterShare`、`resumeCanvasInput`、`resumeSessionSurface`、`resumeSmokeSettings`、`returnHome`、`routeAfterCommit`、`routeAfterLeave`、`selectAshVisual`、`selectEnvironment`、`selectIgnitionStyle`、`selectMicrophoneSensitivity`、`selectSmokeRingShape`、`setSessionKeepScreenOn`、`showAshSensorFailure`、`showFatalError`、`showSessionOverlay`、`sourceBadgeImageFailed`、`startIgnition`、`startInhale`、`stopAshAccelerometer`、`stopMicrophone`、`stopSession`、`stopVisualInteraction`、`syncAchievementForeground`、`syncAchievementInteractionBlocked`、`syncAnimationCadence`、`syncAshAccelerometer`、`toggleMicrophone`、`toggleSound`、`triggerRingFormation`、`updateAshBreak`、`updateEmberHeat`、`updatePendingInhale`、`updateSoundDetail`、`updateTimers`、`warmSessionCanvas` |
| `components/themed-confirm/themed-confirm.js`（chunk_4.appservice.js） | — | `cancel`、`confirm`、`noop` |
| `components/ticket-balance/ticket-balance.js`（chunk_7.appservice.js） | — | `hideHint`、`showHint` |

## pages（5）

| 模块（所在编译文件） | 导出 | 静态可识别方法 |
| --- | --- | --- |
| `pages/check-in/check-in.js`（chunk_2.appservice.js） | — | `checkInToday`、`closeUnlock`、`extraTicketCompleted`、`onShow`、`openUnlockSettings`、`refreshSnapshot` |
| `pages/index/index.js`（chunk_4.appservice.js） | — | `animateLid`、`beginInlineSession`、`browseNextPack`、`browsePack`、`browsePreviousPack`、`cancelExchange`、`closeAnnouncements`、`closeDesktopGuide`、`closeHomeGift`、`confirmExchange`、`copyAnnouncementPassphrase`、`copyAnnouncementWechat`、`handleCheckinStatusTap`、`handleHomeGiftChanged`、`handleHomeScroll`、`handleLidToggle`、`handleLockedPackTap`、`handlePackChange`、`handleSessionEntryClear`、`handleSessionEntryComplete`、`handleSessionLeave`、`launchStickSession`、`onAnnouncementChange`、`onHide`、`onLoad`、`onMyMiniProgramRewardClaim`、`onReady`、`onShareAppMessage`、`onShow`、`onUnload`、`openAchievements`、`openAnnouncementReward`、`openCheckIn`、`openDesktopGuide`、`openHomeGift`、`openPackCatalog`、`openQuitCheck`、`openReceiveRanking`、`openRecords`、`openSettings`、`openSmokeLab`、`preloadMenuWebview`、`refreshAchievementUnread`、`requireUnlockedPack`、`retryHomeLoad`、`scheduleSessionWarmup`、`startExactStick`、`startGame`、`stopAnnouncementTouch`、`stopHomeGiftTouch`、`toggleAnnouncementDetail`、`toggleAnnouncementUpdates`、`toggleAnnouncements` |
| `pages/loose-box/loose-box.js`（chunk_5.appservice.js） | — | `badgeInfoChanged`、`closeDetail`、`confirmDiscard`、`goHome`、`keepSelected`、`onLoad`、`onShareAppMessage`、`onShow`、`openDetail`、`openRanking`、`preventDetailScroll`、`refreshBox`、`requestDiscard`、`smokeRandom`、`smokeSelected`、`smokeSpecific`、`startLoose`、`upgradeCompleted` |
| `pages/receive/receive.js`（chunk_8.appservice.js） | — | `badgeInfoChanged`、`cancelStoredNavigation`、`closePreview`、`goHome`、`onHide`、`onLoad`、`onShareAppMessage`、`onShow`、`onUnload`、`openLooseBox`、`refreshPreview`、`showPreviewError`、`smokeNow`、`storeLoose`、`upgradeCompleted` |
| `pages/session/session.js`（chunk_9.appservice.js） | — | `clearEntryVeilTimer`、`onHide`、`onLoad`、`onReady`、`onShareAppMessage`、`onShow`、`onUnload` |
