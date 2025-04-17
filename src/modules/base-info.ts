/**
 * 基础信息收集模块
 */
import { BaseInfo } from '../types';
import Logger from './logger';

export default class BaseInfoCollector {
  private baseInfo: BaseInfo | null = null;
  private logger: Logger;

  constructor() {
    this.logger = Logger.getInstance();
  }

  collect(): BaseInfo {
    try {
      // 创建默认的基础信息对象（降级方案）
      const defaultBaseInfo: BaseInfo = {
        ua: 'unknown',
        language: 'unknown',
        platform: 'unknown',
        deviceMemory: null,
        hardwareConcurrency: null,
        screen: {
          width: 0,
          height: 0
        },
        ip: null,
        region: null,
        city: null
      };

      // 尝试收集真实信息，如果出错则使用默认值
      try {
        this.baseInfo = {
          ua: navigator?.userAgent || defaultBaseInfo.ua,
          language: navigator?.language || defaultBaseInfo.language,
          platform: navigator?.platform || defaultBaseInfo.platform,
          deviceMemory: navigator?.deviceMemory || null,
          hardwareConcurrency: navigator?.hardwareConcurrency || null,
          screen: {
            width: window?.screen?.width || defaultBaseInfo.screen.width,
            height: window?.screen?.height || defaultBaseInfo.screen.height
          },
          ip: null,
          region: null,
          city: null // 可通过后端或第三方API补充
        };
      } catch (err) {
        this.logger.error('收集基础信息失败，使用默认值', err);
        this.baseInfo = defaultBaseInfo;
      }

      return this.baseInfo;
    } catch (err) {
      this.logger.error('基础信息收集模块出错', err);
      // 返回空对象作为降级方案，确保不会影响业务应用
      return {
        ua: 'unknown',
        language: 'unknown',
        platform: 'unknown',
        deviceMemory: null,
        hardwareConcurrency: null,
        screen: {
          width: 0,
          height: 0
        },
        ip: null,
        region: null,
        city: null
      };
    }
  }

  getInfo(): BaseInfo | null {
    try {
      return this.baseInfo;
    } catch (err) {
      this.logger.error('获取基础信息失败', err);
      return null;
    }
  }
}
