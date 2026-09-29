/** The refill page uses this boundary; a real ad SDK can replace the preview adapter. */
export interface RewardedVideoRequest {
  placement: 'pack:refill' | 'checkin:extra-ticket';
  resourceId: string;
}

export type RewardedVideoResult = 'completed' | 'cancelled' | 'unavailable' | 'error';

export interface RewardedVideoGateway {
  show(request: RewardedVideoRequest): Promise<RewardedVideoResult>;
}

/** Development preview, never claims an ad was watched without an explicit action. */
export class PreviewRewardedVideoGateway implements RewardedVideoGateway {
  constructor(private readonly present: () => Promise<RewardedVideoResult>) {}

  public show(request: RewardedVideoRequest): Promise<RewardedVideoResult> {
    if ((request.placement !== 'pack:refill' && request.placement !== 'checkin:extra-ticket')
      || !request.resourceId) return Promise.resolve('error');
    return this.present();
  }
}
