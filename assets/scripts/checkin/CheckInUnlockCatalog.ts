export interface CheckInUnlockFeature {
  readonly id: string;
  readonly day: number;
  readonly title: string;
  readonly description: string;
}

/** V1.0.8 domain/check-in-access.js; thresholds use cumulative check-in days. */
export const CHECK_IN_UNLOCK_FEATURES: readonly CheckInUnlockFeature[] = [
  { id: 'shakeAsh', day: 1, title: '晃动弹烟灰',
    description: '默认关闭。前往「设置」手动开启「晃动弹烟灰」并同意隐私指引后，即可晃动手机抖落烟灰。' },
  { id: 'ringFormation', day: 2, title: '烟圈编队',
    description: '吸烟页右侧点按或长按「触发编队」。解锁今日无限烟圈与编队样式后，开启编队，在吐气时一键播放。' },
  { id: 'lab', day: 2, title: '烟雾实验室',
    description: '从首页或吸烟页进入实验室，搭配烟雾颜色、烟圈形状与吐雾方式，保存你的烟雾方案。' },
  { id: 'directionalRing', day: 3, title: '指向烟圈',
    description: '吐气时，从「吐烟圈」按钮向左、右或上方滑动，让烟圈朝你指向的方向飞去。' },
  { id: 'records', day: 3, title: '记录',
    description: '首页点「记录」，查看本机记录与任务。任务达标后点「完成」，即可分享解锁对应烟灰和烟圈样式。' },
  { id: 'handSmoke', day: 4, title: '手指拨烟',
    description: '在烟雾实验室开启「手指拨烟」，滑动手指，拨动眼前的烟雾。' },
];

export function newlyUnlockedFeatures(previousDays: number, currentDays: number): CheckInUnlockFeature[] {
  return CHECK_IN_UNLOCK_FEATURES.filter((feature) => previousDays < feature.day && currentDays >= feature.day);
}
