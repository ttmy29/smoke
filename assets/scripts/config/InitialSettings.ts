/**
 * 应用初始设置：通过 import 使用，无需挂载到场景节点。
 * 修改后重新运行生效；初始存档参数仅在开启重置时应用。
 * [已接入]：配置已被运行代码读取并生效。[有限支持]：仅支持注明的范围。
 * [预留]：仅保留参数接口，尚未实现对应初始化，修改不会生成数据。
 * 完整状态表和示例见 docs/initial-settings.md。
 */

// ── 开发开关 ──
/** [已接入] true：每次启动清空本项目存档；false：保留已有进度。查看效果后改回 false。 */
export const RESET_LOCAL_SAVE_ON_START: boolean = false;

/** [已接入] 应用自有调试日志开关，每次启动生效；警告、错误及引擎日志不受此开关控制。 */
export const ENABLE_DEBUG_LOGS: boolean = false;

/** [已接入] 广告模拟弹层开关，每次启动生效；false 返回 unavailable，不发奖励。真实广告 SDK 待接入。 */
export const ENABLE_AD_PREVIEW: boolean = true;

/** [已接入] 实验室 UI 预览：普通选项直接点选，保存只保存在本次运行的预览状态，不写真实方案或驱动烟雾。 */
export const ENABLE_SMOKE_LAB_UI_PREVIEW: boolean = true;

// ── 打卡初始数据 ──
/**
 * [已接入] 累计打卡天数，非负安全整数；所有初始存档参数仅在开启重置时生效。
 * 设为 0 / 1 / 2 / 3，且今天未打卡时，再打卡分别触发第 1 / 2 / 3 / 4 天弹层。
 * 连续天数、烟票余额和今日状态由下面的独立参数控制。
 */
export const INITIAL_CHECK_IN_DAYS: number = 2;


/** [已接入] 连续打卡天数：非负安全整数，必须 <= 累计天数；今天已打卡时必须 >= 1。 */
export const INITIAL_CHECK_IN_STREAK_DAYS: number = 2;

/** [已接入] 烟票余额：非负安全整数，独立于累计/连续天数。 */
export const INITIAL_TICKET_BALANCE: number = 2;

/** [已接入] 今天是否已打卡；true 时不再弹本日解锁提示，也不能重复领取打卡烟票。 */
export const INITIAL_CHECKED_IN_TODAY: boolean = false;

// ── 烟盒初始数据 ──
/** [已接入] 剩余支数：0～10 的整数；0 可查看空盒补盒流程。 */
export const INITIAL_PACK_REMAINING: number = 10;

/** [已接入] 初始盒盖是否打开。 */
export const INITIAL_PACK_LID_OPEN: boolean = false;

/** [有限支持] 默认烟盒 ID：当前只支持 'wang-xi'；其他 ID 会拒绝初始化，多烟盒切换待接入。 */
export const INITIAL_PACK_ID: string = 'wang-xi';

// ── 个人初始数据 ──
/** [已接入] 累计抽烟支数：非负安全整数；今天已抽和最后抽烟时间仍为空白初始状态。 */
export const INITIAL_SMOKED_CIGARETTES: number = 0;

/** [预留] 戒烟天数：默认 0；尚未接入逐日戒烟记录初始化，修改此值不会改变戒烟数据。 */
export const INITIAL_QUIT_DAYS: number = 0;

// ── 默认偏好 ──
/** [已接入] 每次启动的音效默认状态；设置页可在本次运行中切换。 */
export const DEFAULT_SOUND_ENABLED: boolean = true;

/** [已接入] 音效总音量：0～1，乘以各音效自身音量；每次启动生效，0 表示无声。 */
export const DEFAULT_SOUND_VOLUME: number = 1;
