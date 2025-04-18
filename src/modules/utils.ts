/**
 * 工具类模块
 */
import Logger from './logger';

export default class Utils {
  private static logger = Logger.getInstance();
  private static networkStatus: boolean = navigator.onLine;

  /**
   * 生成会话ID
   * @returns {string} 生成的会话ID
   */
  static generateSessionId(): string {
    try {
      return 'xxxxxxxxyxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    } catch (err) {
      this.logger.error('生成会话ID失败', err);
      // 返回一个固定的ID作为降级方案
      return 'fallback-session-id';
    }
  }

  /**
   * 获取当前时间戳
   * @returns {number} 当前时间戳
   */
  static now(): number {
    try {
      return Date.now();
    } catch (err) {
      this.logger.error('获取时间戳失败', err);
      // 返回当前时间的近似值作为降级方案
      return new Date().valueOf();
    }
  }

  /**
   * 安全的JSON序列化
   * @param {any} data 要序列化的数据
   * @returns {string} 序列化后的JSON字符串
   */
  static safeStringify(data: any): string {
    try {
      return JSON.stringify(data);
    } catch (err) {
      this.logger.error('JSON序列化失败', err);
      // 返回空对象字符串作为降级方案
      return '{}';
    }
  }

  /**
   * 安全的JSON解析
   * @param {string} text 要解析的JSON字符串
   * @returns {any} 解析后的对象
   */
  static safeParse(text: string): any {
    try {
      return JSON.parse(text);
    } catch (err) {
      this.logger.error('JSON解析失败', err);
      // 返回空对象作为降级方案
      return {};
    }
  }

  /**
   * 安全的获取对象属性
   * @param {any} obj 目标对象
   * @param {string} path 属性路径，如 'a.b.c'
   * @param {any} defaultValue 默认值
   * @returns {any} 属性值或默认值
   */
  static safeGet(obj: any, path: string, defaultValue: any = undefined): any {
    try {
      if (!obj || !path) return defaultValue;

      const keys = path.split('.');
      let result = obj;

      for (const key of keys) {
        if (result === undefined || result === null) return defaultValue;
        result = result[key];
      }

      return result === undefined ? defaultValue : result;
    } catch (err) {
      this.logger.error(`获取属性 ${path} 失败`, err);
      return defaultValue;
    }
  }

  /**
   * 检查网络是否在线
   * @returns {boolean} 是否在线
   */
  static isOnline(): boolean {
    try {
      return navigator.onLine;
    } catch (err) {
      this.logger.error('检查网络状态失败', err);
      return true; // 默认假设在线
    }
  }

  /**
   * 设置网络状态监听器
   * @param {Function} onlineCallback 网络恢复回调
   * @param {Function} offlineCallback 网络断开回调
   */
  static setupNetworkListener(onlineCallback: () => void, offlineCallback?: () => void): void {
    try {
      // 初始化网络状态
      this.networkStatus = navigator.onLine;

      // 监听网络状态变化
      window.addEventListener('online', () => {
        const previousStatus = this.networkStatus;
        this.networkStatus = true;

        // 只有状态变化时才触发回调
        if (!previousStatus && onlineCallback) {
          onlineCallback();
        }
      });

      window.addEventListener('offline', () => {
        const previousStatus = this.networkStatus;
        this.networkStatus = false;

        // 只有状态变化时才触发回调
        if (previousStatus && offlineCallback) {
          offlineCallback();
        }
      });
    } catch (err) {
      this.logger.error('设置网络状态监听器失败', err);
    }
  }

  /**
   * 生成唯一ID
   * @returns {string} 唯一ID
   */
  static generateUniqueId(): string {
    try {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    } catch (err) {
      this.logger.error('生成唯一ID失败', err);
      return `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  }
}
