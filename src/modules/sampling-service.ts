/**
 * 数据采样服务模块
 * 提供数据采样功能，允许用户配置采样率以减少高频事件上报量
 */
import Logger from './logger';
import Utils from './utils';

/**
 * 采样策略枚举
 */
export enum SamplingStrategy {
  RANDOM = 'random', // 随机采样
  CONSISTENT = 'consistent', // 一致性采样（相同特征的事件采样结果一致）
  RATE_LIMITING = 'rate_limiting', // 频率限制采样（限制单位时间内的事件数量）
}

/**
 * 采样配置接口
 */
export interface SamplingOptions {
  strategy: SamplingStrategy; // 采样策略
  rate: number; // 采样率 (0-1)
  consistentKey?: string; // 一致性采样的键名
  timeWindow?: number; // 频率限制采样的时间窗口（毫秒）
  maxEventsPerWindow?: number; // 频率限制采样的最大事件数
}

/**
 * 事件类型采样配置
 */
export interface EventSamplingConfig {
  [eventType: string]: SamplingOptions;
}

export default class SamplingService {
  private logger: Logger;
  private eventConfigs: EventSamplingConfig = {};
  private eventCounts: Record<string, number> = {};
  private eventTimestamps: Record<string, number[]> = {};

  constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * 配置事件采样
   * @param eventType 事件类型
   * @param options 采样选项
   */
  configureSampling(eventType: string, options: SamplingOptions): void {
    try {
      // 验证采样率范围
      if (options.rate < 0 || options.rate > 1) {
        throw new Error(`采样率必须在0-1之间，当前值: ${options.rate}`);
      }

      // 保存配置
      this.eventConfigs[eventType] = {
        ...options,
        // 确保频率限制采样的配置有默认值
        timeWindow: options.timeWindow || 60000, // 默认1分钟
        maxEventsPerWindow: options.maxEventsPerWindow || 100, // 默认每分钟100个事件
      };

      this.logger.info(`已配置事件 ${eventType} 的采样策略: ${options.strategy}, 采样率: ${options.rate}`);
    } catch (err) {
      this.logger.error(`配置事件 ${eventType} 的采样策略失败`, err);
    }
  }

  /**
   * 批量配置事件采样
   * @param configs 多个事件的采样配置
   */
  configureMultipleSampling(configs: EventSamplingConfig): void {
    Object.entries(configs).forEach(([eventType, options]) => {
      this.configureSampling(eventType, options);
    });
  }

  /**
   * 判断事件是否应该被采样
   * @param eventType 事件类型
   * @param eventData 事件数据
   * @returns 是否应该采样该事件
   */
  shouldSampleEvent(eventType: string, eventData?: any): boolean {
    try {
      // 如果没有配置该事件类型的采样策略，默认全部采样
      if (!this.eventConfigs[eventType]) {
        return true;
      }

      const config = this.eventConfigs[eventType];

      // 如果采样率为1，全部采样
      if (config.rate >= 1) {
        return true;
      }

      // 如果采样率为0，全部不采样
      if (config.rate <= 0) {
        return false;
      }

      // 根据不同的采样策略进行判断
      switch (config.strategy) {
        case SamplingStrategy.RANDOM:
          return this.randomSampling(config.rate);

        case SamplingStrategy.CONSISTENT:
          return this.consistentSampling(eventType, eventData, config);

        case SamplingStrategy.RATE_LIMITING:
          return this.rateLimitingSampling(eventType, config);

        default:
          return this.randomSampling(config.rate);
      }
    } catch (err) {
      this.logger.error(`判断事件 ${eventType} 是否应该被采样时出错`, err);
      // 出错时默认采样，确保重要数据不丢失
      return true;
    }
  }

  /**
   * 随机采样
   * @param rate 采样率
   * @returns 是否采样
   */
  private randomSampling(rate: number): boolean {
    return Math.random() < rate;
  }

  /**
   * 一致性采样（相同特征的事件采样结果一致）
   * @param eventType 事件类型
   * @param eventData 事件数据
   * @param config 采样配置
   * @returns 是否采样
   */
  private consistentSampling(eventType: string, eventData: any, config: SamplingOptions): boolean {
    try {
      // 如果没有提供事件数据或一致性键，回退到随机采样
      if (!eventData || !config.consistentKey) {
        return this.randomSampling(config.rate);
      }

      // 获取一致性键的值
      const keyValue = Utils.safeGet(eventData, config.consistentKey);

      // 如果没有找到键值，回退到随机采样
      if (keyValue === undefined) {
        return this.randomSampling(config.rate);
      }

      // 使用键值生成一个确定性的哈希值
      const hash = this.hashString(String(keyValue));

      // 将哈希值映射到0-1之间
      const normalizedHash = (hash % 1000) / 1000;

      // 根据采样率判断
      return normalizedHash < config.rate;
    } catch (err) {
      this.logger.error(`一致性采样事件 ${eventType} 时出错`, err);
      return this.randomSampling(config.rate);
    }
  }

  /**
   * 频率限制采样（限制单位时间内的事件数量）
   * @param eventType 事件类型
   * @param config 采样配置
   * @returns 是否采样
   */
  private rateLimitingSampling(eventType: string, config: SamplingOptions): boolean {
    try {
      const now = Utils.now();
      const timeWindow = config.timeWindow || 60000; // 默认1分钟
      const maxEvents = config.maxEventsPerWindow || 100; // 默认每分钟100个事件

      // 初始化事件时间戳数组
      if (!this.eventTimestamps[eventType]) {
        this.eventTimestamps[eventType] = [];
      }

      // 清理过期的时间戳
      this.eventTimestamps[eventType] = this.eventTimestamps[eventType].filter(
        (timestamp) => now - timestamp < timeWindow,
      );

      // 如果当前时间窗口内的事件数量小于最大值，则采样
      if (this.eventTimestamps[eventType].length < maxEvents) {
        // 记录当前事件的时间戳
        this.eventTimestamps[eventType].push(now);
        return true;
      }

      // 超过限制，根据采样率决定是否采样
      if (this.randomSampling(config.rate)) {
        // 记录当前事件的时间戳
        this.eventTimestamps[eventType].push(now);
        return true;
      }

      return false;
    } catch (err) {
      this.logger.error(`频率限制采样事件 ${eventType} 时出错`, err);
      return this.randomSampling(config.rate);
    }
  }

  /**
   * 简单的字符串哈希函数
   * @param str 要哈希的字符串
   * @returns 哈希值
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash);
  }

  /**
   * 重置采样状态
   * @param eventType 事件类型，如果不提供则重置所有事件
   */
  resetSamplingState(eventType?: string): void {
    if (eventType) {
      delete this.eventCounts[eventType];
      delete this.eventTimestamps[eventType];
    } else {
      this.eventCounts = {};
      this.eventTimestamps = {};
    }
  }
}
