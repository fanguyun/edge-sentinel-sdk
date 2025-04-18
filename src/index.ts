/**
 * Edge Sentinel SDK
 * 前端监控与埋点SDK，支持功能模块扩展
 */
import BaseInfoCollector from './modules/base-info';
import ErrorMonitor from './modules/error-monitor';
import PerformanceMonitor from './modules/performance-monitor';
import OperationTracker from './modules/operation-tracker';
import WebVitalsMonitor from './modules/web-vitals-monitor';
import StorageService from './modules/storage-service';
import CompressionService from './modules/compression-service';
import SamplingService from './modules/sampling-service';
import ReplayService from './modules/replay-service';
import ConfigUI from './modules/config-ui';
import Utils from './modules/utils';
import Logger, { LogLevel } from './modules/logger';
import { SDKOptions, BaseInfo, ReportData, OperationStatus, ReportStrategy, SamplingStrategy } from './types';

// 声明全局错误处理函数，防止SDK错误影响业务应用
declare global {
  interface Window {
    __EDGE_SENTINEL_ERROR_HANDLER__: (err: Error, source: string) => void;
  }
}

class EdgeSentinelSDK {
  private static instance: EdgeSentinelSDK | null = null;
  private appId!: string;
  private reportUrl!: string;
  private userKey!: string;
  private sessionId!: string;
  private startTime!: number;
  private baseInfoCollector!: BaseInfoCollector;
  private errorMonitor!: ErrorMonitor;
  private performanceMonitor!: PerformanceMonitor;
  private operationTracker!: OperationTracker;
  private webVitalsMonitor!: WebVitalsMonitor;
  private storageService!: StorageService;
  private compressionService!: CompressionService;
  private samplingService!: SamplingService;
  private replayService: ReplayService | null = null;
  private configUI: ConfigUI | null = null;
  private baseInfo: BaseInfo | null = null;
  private logger!: Logger;
  private isInitialized: boolean = false;
  private isErrorState: boolean = false;
  private enableOperationTracking: boolean = false;
  private enableCompression: boolean = false;
  private reportStrategy: ReportStrategy = 'immediate';
  private batchSize: number = 10;
  private reportInterval: number = 5000; // 5秒
  private enableOfflineCache: boolean = false;
  private enableSampling: boolean = false;
  private enableReplay: boolean = false;
  private reportTimer: number | null = null;
  private options!: SDKOptions;
  private debugMode: boolean = false;

  /**
   * 创建SDK实例
   * @param {SDKOptions} options 配置选项
   */
  constructor(options: SDKOptions) {
    try {
      // 初始化日志系统
      this.logger = Logger.getInstance({
        level: options.logLevel || LogLevel.WARN,
        reportErrors: true,
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

      // 设置配置选项
      this.enableOperationTracking = options.enableOperationTracking || false;
      this.enableCompression = options.enableCompression || false;
      this.reportStrategy = options.reportStrategy || 'immediate';
      this.batchSize = options.batchSize || 10;
      this.reportInterval = options.reportInterval || 5000;
      this.enableOfflineCache = options.enableOfflineCache || false;
      this.enableSampling = options.enableSampling || false;
      this.enableReplay = options.enableReplay || false;
      this.debugMode = options.debugMode || false;
      this.options = options;

      try {
        // 初始化各模块
        this.baseInfoCollector = new BaseInfoCollector();
        this.errorMonitor = new ErrorMonitor(this._report.bind(this));
        this.performanceMonitor = new PerformanceMonitor(this._report.bind(this));
        this.operationTracker = new OperationTracker(this._report.bind(this));
        this.webVitalsMonitor = new WebVitalsMonitor(this._report.bind(this));
        this.storageService = new StorageService();
        this.compressionService = new CompressionService();
        this.samplingService = new SamplingService();

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
  private async _init(): Promise<void> {
    try {
      // 收集基础信息
      this.baseInfo = this.baseInfoCollector.collect();

      // 初始化各监控模块
      this.errorMonitor.init();
      this.performanceMonitor.init();
      this.webVitalsMonitor.init();

      // 如果启用了操作链路记录，初始化操作链路记录模块
      if (this.enableOperationTracking) {
        this.operationTracker.init(true, this.options.operationInactivityThreshold, this.options.operationMaxDuration);
      } else {
        this.operationTracker.init(false);
      }

      // 如果启用了数据采样，配置采样服务
      if (this.enableSampling) {
        if (this.options.samplingConfig) {
          this.samplingService.configureMultipleSampling(this.options.samplingConfig);
        } else if (this.options.defaultSamplingRate) {
          // 配置默认采样策略
          const defaultConfig = {
            js_error: {
              strategy: SamplingStrategy.RANDOM,
              rate: this.options.defaultSamplingRate,
            },
            api_error: {
              strategy: SamplingStrategy.RANDOM,
              rate: this.options.defaultSamplingRate,
            },
            performance: {
              strategy: SamplingStrategy.RANDOM,
              rate: this.options.defaultSamplingRate,
            },
          };
          this.samplingService.configureMultipleSampling(defaultConfig);
        }
      }

      // 如果启用了用户行为回放，初始化回放服务
      if (this.enableReplay) {
        this.replayService = new ReplayService(this._report.bind(this), this.options.replayOptions);
        this.replayService.startRecording();
      }

      // 如果启用了离线缓存，初始化存储服务
      if (this.enableOfflineCache) {
        await this.storageService.init();

        // 如果使用批量或定时上报策略，启动上报定时器
        if (this.reportStrategy === 'batch' || this.reportStrategy === 'periodic') {
          this._startReportTimer();
        }

        // 监听网络状态变化，在网络恢复时尝试上报缓存数据
        this._setupNetworkListener();
      }

      // 如果启用了调试模式，输出调试信息
      if (this.debugMode) {
        this._logDebugInfo('SDK初始化完成', {
          appId: this.appId,
          sessionId: this.sessionId,
          enableCompression: this.enableCompression,
          reportStrategy: this.reportStrategy,
          enableOfflineCache: this.enableOfflineCache,
          enableSampling: this.enableSampling,
          enableReplay: this.enableReplay,
        });

        // 初始化配置界面
        this.configUI = new ConfigUI(this.options, this._updateOptions.bind(this));
        this.configUI.init();
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
  private async _report(data: ReportData): Promise<void> {
    try {
      // 如果SDK处于错误状态，不进行上报
      if (this.isErrorState) {
        this.logger.warn('SDK处于错误状态，数据上报被跳过');
        return;
      }

      // 如果启用了数据采样，检查是否应该采样该事件
      if (this.enableSampling && data.type !== 'replay_session') {
        if (!this.samplingService.shouldSampleEvent(data.type, data)) {
          this.logger.debug(`事件 ${data.type} 被采样过滤`);
          return;
        }
      }

      // 处理敏感数据
      const processedData = this._processSensitiveData(data);

      const reportData = {
        ...processedData,
        appId: this.appId,
        userKey: this.userKey,
        sessionId: this.sessionId,
        baseInfo: this.baseInfo,
      };

      // 如果启用了调试模式，输出上报数据
      if (this.debugMode) {
        this._logDebugInfo('准备上报数据', reportData);
      }

      // 根据上报策略处理数据
      if (this.enableOfflineCache && (this.reportStrategy === 'batch' || this.reportStrategy === 'periodic')) {
        // 批量上报或定时上报模式，先缓存数据
        await this.storageService.saveData(reportData);

        // 如果是批量上报模式且缓存数据量达到阈值，立即上报
        if (this.reportStrategy === 'batch') {
          const count = await this.storageService.getCount();
          if (count >= this.batchSize) {
            this._reportBatchData();
          }
        }
      } else {
        // 立即上报模式
        this._sendData(reportData);
      }
    } catch (err) {
      this.logger.error('数据上报过程出错', err);
      // 即使出错也不抛出异常，保证不影响业务应用
    }
  }

  /**
   * 发送数据到服务器
   * @param data 要上报的数据
   * @private
   */
  private _sendData(data: any): void {
    try {
      // 序列化数据
      let payload: string | Blob;
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };

      // 如果启用了压缩，压缩数据
      if (this.enableCompression) {
        const jsonStr = JSON.stringify(data);
        const compressed = this.compressionService.compress(jsonStr);
        payload = JSON.stringify({
          type: 'compressed',
          data: compressed,
        });
        headers['Content-Encoding'] = 'gzip';
        headers['X-Compressed'] = 'true';
      } else {
        payload = JSON.stringify(data);
      }

      // 使用Beacon API或降级为XHR
      try {
        if (navigator && navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' });
          const success = navigator.sendBeacon(this.reportUrl, blob);
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

          // 设置请求头
          Object.keys(headers).forEach((key) => {
            xhr.setRequestHeader(key, headers[key]);
          });

          xhr.send(payload);
        } catch (xhrErr) {
          this.logger.error('XHR上报失败', xhrErr);
        }
      }
    } catch (err) {
      this.logger.error('发送数据失败', err);
    }
  }

  /**
   * 批量上报缓存数据
   * @private
   */
  private async _reportBatchData(): Promise<void> {
    try {
      // 获取缓存数据
      const items = await this.storageService.getBatchData(this.batchSize);

      if (items.length === 0) {
        return;
      }

      // 提取数据ID列表，用于后续删除
      const ids = items.map((item) => item.id).filter((id) => id !== undefined) as number[];

      // 提取数据列表
      const dataList = items.map((item) => item.data);

      // 发送批量数据
      this._sendData({
        type: 'batch',
        items: dataList,
        count: dataList.length,
        timestamp: Utils.now(),
      });

      // 删除已上报的数据
      await this.storageService.removeData(ids);

      if (this.debugMode) {
        this._logDebugInfo('批量上报完成', {
          count: dataList.length,
          remainingCount: await this.storageService.getCount(),
        });
      }
    } catch (err) {
      this.logger.error('批量上报失败', err);
    }
  }

  /**
   * 启动上报定时器
   * @private
   */
  private _startReportTimer(): void {
    try {
      // 清除可能存在的定时器
      if (this.reportTimer !== null) {
        window.clearInterval(this.reportTimer);
      }

      // 创建新的定时器
      this.reportTimer = window.setInterval(() => {
        this._reportBatchData();
      }, this.reportInterval);

      if (this.debugMode) {
        this._logDebugInfo('启动上报定时器', {
          interval: this.reportInterval,
          strategy: this.reportStrategy,
        });
      }
    } catch (err) {
      this.logger.error('启动上报定时器失败', err);
    }
  }

  /**
   * 设置网络状态监听器
   * @private
   */
  private _setupNetworkListener(): void {
    try {
      window.addEventListener('online', () => {
        this.logger.info('网络已恢复，尝试上报缓存数据');
        this._reportBatchData();
      });
    } catch (err) {
      this.logger.error('设置网络状态监听器失败', err);
    }
  }

  /**
   * 处理敏感数据
   * @param {any} data 要处理的数据
   * @returns {any} 处理后的数据
   * @private
   */
  private _processSensitiveData(data: any): any {
    try {
      if (!data) return data;

      // 如果没有配置敏感字段，直接返回原始数据
      if (!this.options.sensitiveFields && !this.options.customSensitiveHandler) {
        return data;
      }

      // 创建数据副本，避免修改原始数据
      const result = JSON.parse(JSON.stringify(data));

      // 处理敏感字段
      if (this.options.sensitiveFields && this.options.sensitiveFields.length > 0) {
        this._maskSensitiveFields(result, this.options.sensitiveFields);
      }

      // 应用自定义敏感数据处理函数
      if (this.options.customSensitiveHandler) {
        return this._applyCustomHandler(result, this.options.customSensitiveHandler);
      }

      return result;
    } catch (err) {
      this.logger.error('处理敏感数据失败', err);
      return data; // 出错时返回原始数据
    }
  }

  /**
   * 掩码敏感字段
   * @param {any} obj 要处理的对象
   * @param {string[]} sensitiveFields 敏感字段列表
   * @returns {any} 处理后的对象
   * @private
   */
  private _maskSensitiveFields(obj: any, sensitiveFields: string[]): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        obj[i] = this._maskSensitiveFields(obj[i], sensitiveFields);
      }
      return obj;
    }

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // 检查是否为敏感字段或包含敏感关键词
        if (this._isSensitiveField(key, sensitiveFields)) {
          obj[key] = this._defaultSensitiveMask(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          // 递归处理嵌套对象
          obj[key] = this._maskSensitiveFields(obj[key], sensitiveFields);
        }
      }
    }

    return obj;
  }

  /**
   * 应用自定义敏感数据处理函数
   * @param {any} obj 要处理的对象
   * @param {Function} handler 自定义处理函数
   * @returns {any} 处理后的对象
   * @private
   */
  private _applyCustomHandler(obj: any, handler: (key: string, value: any) => any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        obj[i] = this._applyCustomHandler(obj[i], handler);
      }
      return obj;
    }

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // 应用自定义处理函数
        obj[key] = handler(key, obj[key]);

        // 如果返回值仍是对象，递归处理
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          obj[key] = this._applyCustomHandler(obj[key], handler);
        }
      }
    }

    return obj;
  }

  /**
   * 检查字段是否为敏感字段
   * @param {string} fieldName 字段名
   * @param {string[]} sensitiveFields 敏感字段列表
   * @returns {boolean} 是否为敏感字段
   * @private
   */
  private _isSensitiveField(fieldName: string, sensitiveFields: string[]): boolean {
    const lowerFieldName = fieldName.toLowerCase();

    // 精确匹配
    if (sensitiveFields.includes(fieldName)) {
      return true;
    }

    // 关键词匹配
    const sensitiveKeywords = [
      'password',
      'pwd',
      'secret',
      'token',
      'auth',
      'key',
      'credential',
      'ssn',
      'social',
      'card',
      'cvv',
      'pin',
      'passport',
      'license',
    ];

    for (const keyword of sensitiveKeywords) {
      if (lowerFieldName.includes(keyword)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 默认敏感数据脱敏处理
   * @param value 敏感数据值
   * @returns 脱敏后的值
   * @private
   */
  private _defaultSensitiveMask(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    const strValue = String(value);

    if (strValue.length <= 1) {
      return '*';
    } else if (strValue.length <= 3) {
      return strValue.charAt(0) + '*'.repeat(strValue.length - 1);
    } else {
      return strValue.charAt(0) + '*'.repeat(strValue.length - 2) + strValue.charAt(strValue.length - 1);
    }
  }

  /**
   * 输出调试信息
   * @param message 调试消息
   * @param data 调试数据
   * @private
   */
  private _logDebugInfo(message: string, data: any): void {
    try {
      this.logger.debug(`[DEBUG] ${message}`, data);

      if (this.options.debugCallback) {
        this.options.debugCallback(message, data);
      }
    } catch (err) {
      this.logger.error('输出调试信息失败', err);
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
        timestamp: Utils.now(),
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
  getLogs(): Array<{ level: LogLevel; message: string; details?: any; timestamp: number }> {
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
   * 更新SDK配置选项
   * @param {SDKOptions} newOptions 新的配置选项
   * @private
   */
  private _updateOptions(newOptions: SDKOptions): void {
    try {
      // 更新日志级别
      if (newOptions.logLevel !== this.options.logLevel) {
        this.setLogLevel(newOptions.logLevel || LogLevel.WARN);
      }

      // 更新调试模式
      this.debugMode = newOptions.debugMode || false;

      // 更新压缩选项
      this.enableCompression = newOptions.enableCompression || false;

      // 更新上报策略相关配置
      this.reportStrategy = newOptions.reportStrategy || 'immediate';
      this.batchSize = newOptions.batchSize || 10;
      this.reportInterval = newOptions.reportInterval || 5000;

      // 更新离线缓存配置
      const offlineCacheChanged = this.enableOfflineCache !== newOptions.enableOfflineCache;
      this.enableOfflineCache = newOptions.enableOfflineCache || false;

      // 更新采样配置
      const samplingChanged = this.enableSampling !== newOptions.enableSampling;
      this.enableSampling = newOptions.enableSampling || false;
      if (this.enableSampling && samplingChanged) {
        if (newOptions.samplingConfig) {
          this.samplingService.configureMultipleSampling(newOptions.samplingConfig);
        } else if (newOptions.defaultSamplingRate) {
          const defaultConfig = {
            js_error: {
              strategy: SamplingStrategy.RANDOM,
              rate: newOptions.defaultSamplingRate,
            },
            api_error: {
              strategy: SamplingStrategy.RANDOM,
              rate: newOptions.defaultSamplingRate,
            },
            performance: {
              strategy: SamplingStrategy.RANDOM,
              rate: newOptions.defaultSamplingRate,
            },
          };
          this.samplingService.configureMultipleSampling(defaultConfig);
        }
      }

      // 更新操作链路记录配置
      const operationTrackingChanged = this.enableOperationTracking !== newOptions.enableOperationTracking;
      this.enableOperationTracking = newOptions.enableOperationTracking || false;
      if (operationTrackingChanged) {
        this.operationTracker.init(
          this.enableOperationTracking,
          newOptions.operationInactivityThreshold,
          newOptions.operationMaxDuration,
        );
      }

      // 更新用户行为回放配置
      const replayChanged = this.enableReplay !== newOptions.enableReplay;
      this.enableReplay = newOptions.enableReplay || false;
      if (replayChanged) {
        if (this.enableReplay) {
          if (!this.replayService) {
            this.replayService = new ReplayService(this._report.bind(this), newOptions.replayOptions);
          }
          this.replayService.startRecording();
        } else if (this.replayService) {
          this.replayService.stopRecording();
        }
      }

      // 如果离线缓存配置发生变化，重新初始化存储服务
      if (offlineCacheChanged) {
        if (this.enableOfflineCache) {
          this.storageService.init().then(() => {
            if (this.reportStrategy === 'batch' || this.reportStrategy === 'periodic') {
              this._startReportTimer();
            }
          });
        } else if (this.reportTimer !== null) {
          window.clearInterval(this.reportTimer);
          this.reportTimer = null;
        }
      }

      // 更新其他配置选项
      this.options = {
        ...this.options,
        ...newOptions,
      };

      if (this.debugMode) {
        this._logDebugInfo('配置更新完成', {
          logLevel: this.options.logLevel,
          debugMode: this.debugMode,
          enableCompression: this.enableCompression,
          reportStrategy: this.reportStrategy,
          enableOfflineCache: this.enableOfflineCache,
          enableSampling: this.enableSampling,
          enableOperationTracking: this.enableOperationTracking,
          enableReplay: this.enableReplay,
        });
      }
    } catch (err) {
      this.logger.error('更新配置选项失败', err);
      // 即使出错也不抛出异常，保证不影响业务应用
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

  /**
   * 获取SDK实例
   * @param {SDKOptions} options 配置选项
   * @returns {EdgeSentinelSDK} SDK实例
   */
  public static getInstance(options: SDKOptions): EdgeSentinelSDK {
    if (!EdgeSentinelSDK.instance) {
      EdgeSentinelSDK.instance = new EdgeSentinelSDK(options);
    }
    return EdgeSentinelSDK.instance;
  }

  /**
   * 销毁SDK实例
   */
  public destroy(): void {
    try {
      if (!this._checkAvailable()) {
        this.logger.warn('SDK未初始化，无需销毁');
        return;
      }

      // 停止定时器
      if (this.reportTimer !== null) {
        window.clearInterval(this.reportTimer);
        this.reportTimer = null;
      }

      // 停止操作链路记录
      if (this.enableOperationTracking) {
        this.operationTracker.destroy();
      }

      // 停止用户行为回放
      if (this.replayService) {
        this.replayService.stopRecording();
        this.replayService = null;
      }

      // 销毁配置界面
      if (this.configUI) {
        this.configUI.destroy();
        this.configUI = null;
      }

      // 移除网络状态监听器
      window.removeEventListener('online', this._reportBatchData.bind(this));

      // 清理错误监控
      this.errorMonitor.destroy();

      // 清理性能监控
      this.performanceMonitor.destroy();

      // 清理Web Vitals监控
      this.webVitalsMonitor.destroy();

      // 清理操作链路记录
      if (this.enableOperationTracking) {
        this.operationTracker.destroy();
      }

      // 清理用户行为回放
      if (this.enableReplay && this.replayService) {
        this.replayService.destroy();
      }

      // 清理离线缓存
      if (this.enableOfflineCache) {
        this.storageService.clear();
      }

      // 清理定时器
      if (this.reportTimer !== null) {
        window.clearInterval(this.reportTimer);
        this.reportTimer = null;
      }

      // 清理配置界面
      if (this.debugMode && this.configUI) {
        this.configUI.destroy();
        this.configUI = null;
      }

      // 重置SDK状态
      this.isInitialized = false;
      this.baseInfo = null;
      this.replayService = null;

      this.logger.info('SDK销毁完成');
    } catch (err) {
      this.logger.error('SDK销毁过程出错', err);
    }
  }
}

export default EdgeSentinelSDK;
