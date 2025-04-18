/**
 * Web Vitals监控模块
 * 提供核心Web Vitals指标监控功能
 */
import { onCLS, onLCP, onFID, onFCP, onTTFB, Metric } from 'web-vitals';
import { ReportData } from '../types';
import Logger from './logger';

export default class WebVitalsMonitor {
  private reporter: (data: ReportData) => void;
  private initialized: boolean = false;
  private logger: Logger;

  constructor(reporter: (data: ReportData) => void) {
    this.reporter = reporter;
    this.logger = Logger.getInstance();
  }

  /**
   * 初始化Web Vitals监控
   */
  init(): void {
    try {
      if (this.initialized) return;

      // 监控核心Web Vitals指标
      this.trackCLS();
      this.trackLCP();
      this.trackFID();

      // 监控其他性能指标
      this.trackFCP();
      this.trackTTFB();

      this.initialized = true;
      this.logger.info('Web Vitals监控模块初始化成功');
    } catch (err) {
      this.logger.error('Web Vitals监控模块初始化失败', err);
      // 即使初始化失败也不抛出异常，保证不影响业务应用
    }
  }

  /**
   * 监控累积布局偏移 (CLS)
   */
  private trackCLS(): void {
    try {
      onCLS((metric: Metric) => {
        this.reporter({
          type: 'performance',
          name: 'CLS',
          value: metric.value,
          id: metric.id,
          navigationType: metric.navigationType || null,
          rating: this.getRating('CLS', metric.value),
          timestamp: Date.now(),
        });
      });
    } catch (err) {
      this.logger.error('CLS监控初始化失败', err);
    }
  }

  /**
   * 监控最大内容绘制 (LCP)
   */
  private trackLCP(): void {
    try {
      onLCP((metric: Metric) => {
        this.reporter({
          type: 'performance',
          name: 'LCP',
          value: metric.value,
          id: metric.id,
          navigationType: metric.navigationType || null,
          rating: this.getRating('LCP', metric.value),
          timestamp: Date.now(),
        });
      });
    } catch (err) {
      this.logger.error('LCP监控初始化失败', err);
    }
  }

  /**
   * 监控首次输入延迟 (FID)
   */
  private trackFID(): void {
    try {
      onFID((metric: Metric) => {
        this.reporter({
          type: 'performance',
          name: 'FID',
          value: metric.value,
          id: metric.id,
          navigationType: metric.navigationType || null,
          rating: this.getRating('FID', metric.value),
          timestamp: Date.now(),
        });
      });
    } catch (err) {
      this.logger.error('FID监控初始化失败', err);
    }
  }

  /**
   * 监控首次内容绘制 (FCP)
   */
  private trackFCP(): void {
    try {
      onFCP((metric: Metric) => {
        this.reporter({
          type: 'performance',
          name: 'FCP',
          value: metric.value,
          id: metric.id,
          navigationType: metric.navigationType || null,
          rating: this.getRating('FCP', metric.value),
          timestamp: Date.now(),
        });
      });
    } catch (err) {
      this.logger.error('FCP监控初始化失败', err);
    }
  }

  /**
   * 监控首字节时间 (TTFB)
   */
  private trackTTFB(): void {
    try {
      onTTFB((metric: Metric) => {
        this.reporter({
          type: 'performance',
          name: 'TTFB',
          value: metric.value,
          id: metric.id,
          navigationType: metric.navigationType || null,
          rating: this.getRating('TTFB', metric.value),
          timestamp: Date.now(),
        });
      });
    } catch (err) {
      this.logger.error('TTFB监控初始化失败', err);
    }
  }

  /**
   * 根据指标值获取评级
   * @param metricName 指标名称
   * @param value 指标值
   * @returns 评级 (good|needs-improvement|poor)
   */
  private getRating(metricName: string, value: number): string {
    switch (metricName) {
      case 'CLS':
        return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
      case 'LCP':
        return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
      case 'FID':
        return value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor';
      case 'FCP':
        return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
      case 'TTFB':
        return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
      default:
        return 'unknown';
    }
  }

  /**
   * 销毁Web Vitals监控模块
   */
  destroy(): void {
    try {
      // 移除所有Web Vitals监听器
      // 由于web-vitals库的监听器是一次性的，不需要手动移除
      // 但我们需要重置模块状态
      this.initialized = false;
      this.logger.info('Web Vitals监控模块已销毁');
    } catch (err) {
      this.logger.error('Web Vitals监控模块销毁失败', err);
    }
  }
}
