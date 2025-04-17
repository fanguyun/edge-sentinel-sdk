/**
 * Edge Sentinel SDK
 * 前端监控与埋点SDK，支持功能模块扩展
 */
import BaseInfoCollector from './modules/base-info';
import ErrorMonitor from './modules/error-monitor';
import PerformanceMonitor from './modules/performance-monitor';
import OperationTracker from './modules/operation-tracker';
import Utils from './modules/utils';
import Logger, { LogLevel } from './modules/logger';
import { SDKOptions, BaseInfo, ReportData, OperationStatus } from './types';

// 声明全局错误处理函数，防止SDK错误影响业务应用
declare global {
  interface Window {
    __EDGE_SENTINEL_ERROR_HANDLER__: (err: Error, source: string) => void;
  }
}

class EdgeSentinelSDK {
  private appId: string;
  private reportUrl: string;
  private userKey: string;
  private sessionId: string;
  private startTime: number;
  private baseInfoCollector: BaseInfoCollector;
  private errorMonitor: ErrorMonitor;
  private performanceMonitor: PerformanceMonitor;
  private operationTracker: OperationTracker;
  private baseInfo: BaseInfo | null = null;
  private logger: Logger;
  private isInitialized: boolean = false;
  private isErrorState: boolean = false;
  private enableOperationTracking: boolean = false;

  /**
   * 创建SDK实例
   * @param {SDKOptions} options 配置选项
   */
  constructor(options: SDKOptions) {
    try {
      // 初始化日志系统
      this.logger = Logger.getInstance({
        level: options.logLevel || LogLevel.WARN,
        reportErrors: true
      });
      
      // 设置全局错误处理函数
      this._setupGlobalErrorHandler();
      
      const { appId, reportUrl, userKey } = options;

      if (!appId || !reportUrl || !userKey) {
        this.logger.error('初始化失败：appId, reportUrl, and userKey are required');
        this.isErrorState = true;
        return;
      }
      
      this.appId = appId;
      this.reportUrl = reportUrl;
      this.userKey = userKey;
      this.sessionId = Utils.generateSessionId();
      this.startTime = Utils.now();
      this.enableOperationTracking = options.enableOperationTracking || false;

      try {
        // 初始化各模块
        this.baseInfoCollector = new BaseInfoCollector();
        this.errorMonitor = new ErrorMonitor(this._report.bind(this));
        this.performanceMonitor = new PerformanceMonitor(this._report.bind(this));
        this.operationTracker = new OperationTracker(this._report.bind(this));
        
        this._init();
        this.logger.info('SDK初始化成功');
      } catch (err) {
        this.logger.error('模块初始化失败', err);
        this.isErrorState = true;
      }
    } catch (err) {
      // 确保构造函数不会抛出异常
      console.error('[EdgeSentinel] 初始化失败', err);
      this.isErrorState = true;
    }
  }

  /**
   * 初始化SDK
   * @private
   */
  private _init(): void {
    try {
      // 收集基础信息
      this.baseInfo = this.baseInfoCollector.collect();

      // 初始化各监控模块
      this.errorMonitor.init();
      this.performanceMonitor.init();
      
      // 如果启用了操作链路记录，初始化操作链路记录模块
      if (this.enableOperationTracking) {
        this.operationTracker.init();
      }
      
      this.isInitialized = true;
    } catch (err) {
      this.logger.error('SDK初始化过程出错', err);
      this.isErrorState = true;
      // 即使出错也不抛出异常，保证不影响业务应用
    }
  }
  
  /**
   * 设置全局错误处理函数
   * @private
   */
  private _setupGlobalErrorHandler(): void {
    try {
      window.__EDGE_SENTINEL_ERROR_HANDLER__ = (err: Error, source: string) => {
        this.logger.error(`SDK内部错误 [${source}]`, err);
      };
    } catch (err) {
      console.error('[EdgeSentinel] 设置全局错误处理函数失败', err);
    }
  }
  
  /**
   * 检查SDK是否可用
   * @private
   */
  private _checkAvailable(): boolean {
    return this.isInitialized && !this.isErrorState;
  }

  /**
   * 数据上报方法
   * @param {ReportData} data 上报数据
   * @private
   */
  private _report(data: ReportData): void {
    try {
      // 如果SDK处于错误状态，不进行上报
      if (this.isErrorState) {
        this.logger.warn('SDK处于错误状态，数据上报被跳过');
        return;
      }
      
      const reportData = {
        ...data,
        appId: this.appId,
        userKey: this.userKey,
        sessionId: this.sessionId,
        baseInfo: this.baseInfo
      };

      // 使用Beacon API或降级为XHR
      try {
        if (navigator && navigator.sendBeacon) {
          const success = navigator.sendBeacon(this.reportUrl, JSON.stringify(reportData));
          if (!success) {
            throw new Error('Beacon API上报失败，尝试XHR上报');
          }
        } else {
          throw new Error('Beacon API不可用，使用XHR上报');
        }
      } catch (err) {
        // Beacon API失败，降级为XHR
        this.logger.warn('使用XHR上报', err);
        try {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', this.reportUrl, true);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.send(JSON.stringify(reportData));
        } catch (xhrErr) {
          this.logger.error('XHR上报失败', xhrErr);
        }
      }
    } catch (err) {
      this.logger.error('数据上报过程出错', err);
      // 即使出错也不抛出异常，保证不影响业务应用
    }
  }

  /**
   * 手动上报自定义事件
   * @param {string} eventName 事件名称
   * @param {Record<string, any>} eventData 事件数据
   */
  trackEvent(eventName: string, eventData: Record<string, any> = {}): void {
    try {
      if (!this._checkAvailable()) {
        this.logger.warn(`自定义事件 [${eventName}] 上报被跳过，SDK未正确初始化`);
        return;
      }
      
      if (!eventName) {
        this.logger.warn('自定义事件上报失败：事件名称不能为空');
        return;
      }
      
      this._report({
        type: 'custom',
        name: eventName,
        data: eventData,
        timestamp: Utils.now()
      });
    } catch (err) {
      this.logger.error(`自定义事件 [${eventName}] 上报失败`, err);
      // 即使出错也不抛出异常，保证不影响业务应用
    }
  }
  
  /**
   * 获取SDK日志
   * 可用于调试和问题排查
   */
  getLogs(): Array<{level: LogLevel; message: string; details?: any; timestamp: number}> {
    try {
      return this.logger.getLogs();
    } catch (err) {
      console.error('[EdgeSentinel] 获取日志失败', err);
      return [];
    }
  }
  
  /**
   * 设置日志级别
   * @param {LogLevel} level 日志级别
   */
  setLogLevel(level: LogLevel): void {
    try {
      this.logger.setLevel(level);
    } catch (err) {
      console.error('[EdgeSentinel] 设置日志级别失败', err);
    }
  }

  /**
   * 开始记录一个操作链路
   * @param {string} operationName 操作名称
   * @param {Record<string, any>} metadata 操作相关元数据
   * @returns {string} 操作ID，如果失败则返回空字符串
   */
  startOperation(operationName: string, metadata: Record<string, any> = {}): string {
    try {
      if (!this._checkAvailable()) {
        this.logger.warn(`开始操作 [${operationName}] 失败，SDK未正确初始化`);
        return '';
      }
      
      if (!this.enableOperationTracking) {
        this.logger.warn(`开始操作 [${operationName}] 失败，操作链路记录功能未启用`);
        return '';
      }
      
      return this.operationTracker.startOperation(operationName, metadata);
    } catch (err) {
      this.logger.error(`开始操作 [${operationName}] 失败`, err);
      return '';
    }
  }

  /**
   * 添加操作步骤
   * @param {string} operationId 操作ID
   * @param {string} stepName 步骤名称
   * @param {Record<string, any>} stepData 步骤数据
   * @returns {boolean} 是否添加成功
   */
  addOperationStep(operationId: string, stepName: string, stepData: Record<string, any> = {}): boolean {
    try {
      if (!this._checkAvailable()) {
        this.logger.warn(`添加操作步骤 [${stepName}] 失败，SDK未正确初始化`);
        return false;
      }
      
      if (!this.enableOperationTracking) {
        this.logger.warn(`添加操作步骤 [${stepName}] 失败，操作链路记录功能未启用`);
        return false;
      }
      
      return this.operationTracker.addOperationStep(operationId, stepName, stepData);
    } catch (err) {
      this.logger.error(`添加操作步骤 [${stepName}] 失败`, err);
      return false;
    }
  }

  /**
   * 完成操作
   * @param {string} operationId 操作ID
   * @param {Record<string, any>} resultData 操作结果数据
   * @param {boolean} isSuccess 操作是否成功
   * @returns {boolean} 是否完成成功
   */
  completeOperation(operationId: string, resultData: Record<string, any> = {}, isSuccess: boolean = true): boolean {
    try {
      if (!this._checkAvailable()) {
        this.logger.warn(`完成操作 [${operationId}] 失败，SDK未正确初始化`);
        return false;
      }
      
      if (!this.enableOperationTracking) {
        this.logger.warn(`完成操作 [${operationId}] 失败，操作链路记录功能未启用`);
        return false;
      }
      
      return this.operationTracker.completeOperation(operationId, resultData, isSuccess);
    } catch (err) {
      this.logger.error(`完成操作 [${operationId}] 失败`, err);
      return false;
    }
  }

  /**
   * 取消操作
   * @param {string} operationId 操作ID
   * @param {string} reason 取消原因
   * @returns {boolean} 是否取消成功
   */
  cancelOperation(operationId: string, reason: string = '用户取消'): boolean {
    try {
      if (!this._checkAvailable()) {
        this.logger.warn(`取消操作 [${operationId}] 失败，SDK未正确初始化`);
        return false;
      }
      
      if (!this.enableOperationTracking) {
        this.logger.warn(`取消操作 [${operationId}] 失败，操作链路记录功能未启用`);
        return false;
      }
      
      return this.operationTracker.cancelOperation(operationId, reason);
    } catch (err) {
      this.logger.error(`取消操作 [${operationId}] 失败`, err);
      return false;
    }
  }

  /**
   * 获取操作状态
   * @param {string} operationId 操作ID
   * @returns {OperationStatus | null} 操作状态
   */
  getOperationStatus(operationId: string): OperationStatus | null {
    try {
      if (!this._checkAvailable()) {
        this.logger.warn(`获取操作状态 [${operationId}] 失败，SDK未正确初始化`);
        return null;
      }
      
      if (!this.enableOperationTracking) {
        this.logger.warn(`获取操作状态 [${operationId}] 失败，操作链路记录功能未启用`);
        return null;
      }
      
      return this.operationTracker.getOperationStatus(operationId);
    } catch (err) {
      this.logger.error(`获取操作状态 [${operationId}] 失败`, err);
      return null;
    }
  }
}

export default EdgeSentinelSDK;
