/**
 * 操作链路记录模块
 * 用于记录用户的完整操作链路，每次完整操作为一条记录
 * 支持自动分割操作链路
 */
import { OperationEvent, OperationStatus, ReportData } from '../types';
import Utils from './utils';
import Logger from './logger';

export default class OperationTracker {
  private reporter: (data: ReportData) => void;
  private initialized: boolean = false;
  private logger: Logger;
  private activeOperations: Map<string, OperationEvent> = new Map();
  
  // 自动操作链路相关属性
  private autoTrackingEnabled: boolean = false;
  private currentAutoOperation: string | null = null;
  private lastUserInteraction: number = 0;
  private lastPageChange: number = 0;
  private inactivityThreshold: number = 60000; // 默认60秒无操作视为一个操作链路结束
  private maxOperationDuration: number = 300000; // 默认最长操作时间5分钟
  private boundHandleUserInteraction: (e: Event) => void;
  private boundHandleVisibilityChange: () => void;
  private boundHandleRouteChange: () => void;
  private autoOperationCheckInterval: number | null = null;

  constructor(reporter: (data: ReportData) => void) {
    this.reporter = reporter;
    this.logger = Logger.getInstance();
    
    // 绑定事件处理函数到实例
    this.boundHandleUserInteraction = this.handleUserInteraction.bind(this);
    this.boundHandleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.boundHandleRouteChange = this.handleRouteChange.bind(this);
  }

  /**
   * 初始化操作链路记录模块
   * @param {boolean} enableAutoTracking 是否启用自动操作链路记录
   * @param {number} inactivityThreshold 无操作超时时间（毫秒）
   * @param {number} maxOperationDuration 最大操作时长（毫秒）
   */
  init(enableAutoTracking: boolean = false, inactivityThreshold?: number, maxOperationDuration?: number): void {
    try {
      if (this.initialized) return;
      
      // 页面关闭前处理未完成的操作
      window.addEventListener('beforeunload', () => {
        this.handlePageUnload();
      });
      
      // 如果启用自动操作链路记录
      if (enableAutoTracking) {
        this.enableAutoTracking(inactivityThreshold, maxOperationDuration);
      }
      
      this.initialized = true;
      this.logger.info('操作链路记录模块初始化成功');
    } catch (err) {
      this.logger.error('操作链路记录模块初始化失败', err);
      // 即使初始化失败也不抛出异常，保证不影响业务应用
    }
  }
  
  /**
   * 启用自动操作链路记录
   * @param {number} inactivityThreshold 无操作超时时间（毫秒）
   * @param {number} maxOperationDuration 最大操作时长（毫秒）
   */
  enableAutoTracking(inactivityThreshold?: number, maxOperationDuration?: number): void {
    try {
      if (this.autoTrackingEnabled) return;
      
      // 设置配置参数
      if (inactivityThreshold) this.inactivityThreshold = inactivityThreshold;
      if (maxOperationDuration) this.maxOperationDuration = maxOperationDuration;
      
      // 监听用户交互事件
      window.addEventListener('click', this.boundHandleUserInteraction, { passive: true });
      window.addEventListener('keydown', this.boundHandleUserInteraction, { passive: true });
      window.addEventListener('scroll', this.boundHandleUserInteraction, { passive: true });
      window.addEventListener('mousemove', this.boundHandleUserInteraction, { passive: true });
      window.addEventListener('touchstart', this.boundHandleUserInteraction, { passive: true });
      
      // 监听页面可见性变化
      document.addEventListener('visibilitychange', this.boundHandleVisibilityChange);
      
      // 监听路由变化（针对SPA应用）
      window.addEventListener('popstate', this.boundHandleRouteChange);
      window.addEventListener('hashchange', this.boundHandleRouteChange);
      
      // 启动定期检查
      this.autoOperationCheckInterval = window.setInterval(() => {
        this.checkAutoOperationStatus();
      }, 10000); // 每10秒检查一次
      
      // 初始化第一个自动操作
      this.startAutoOperation('页面浏览');
      
      this.autoTrackingEnabled = true;
      this.logger.info('自动操作链路记录已启用');
    } catch (err) {
      this.logger.error('启用自动操作链路记录失败', err);
    }
  }
  
  /**
   * 禁用自动操作链路记录
   */
  disableAutoTracking(): void {
    try {
      if (!this.autoTrackingEnabled) return;
      
      // 移除事件监听
      window.removeEventListener('click', this.boundHandleUserInteraction);
      window.removeEventListener('keydown', this.boundHandleUserInteraction);
      window.removeEventListener('scroll', this.boundHandleUserInteraction);
      window.removeEventListener('mousemove', this.boundHandleUserInteraction);
      window.removeEventListener('touchstart', this.boundHandleUserInteraction);
      document.removeEventListener('visibilitychange', this.boundHandleVisibilityChange);
      window.removeEventListener('popstate', this.boundHandleRouteChange);
      window.removeEventListener('hashchange', this.boundHandleRouteChange);
      
      // 清除定时器
      if (this.autoOperationCheckInterval !== null) {
        window.clearInterval(this.autoOperationCheckInterval);
        this.autoOperationCheckInterval = null;
      }
      
      // 结束当前自动操作
      if (this.currentAutoOperation) {
        this.completeOperation(this.currentAutoOperation, { reason: '自动操作链路记录已禁用' });
        this.currentAutoOperation = null;
      }
      
      this.autoTrackingEnabled = false;
      this.logger.info('自动操作链路记录已禁用');
    } catch (err) {
      this.logger.error('禁用自动操作链路记录失败', err);
    }
  }

  /**
   * 开始记录一个操作
   * @param {string} operationName 操作名称
   * @param {Record<string, any>} metadata 操作相关元数据
   * @returns {string} 操作ID
   */
  startOperation(operationName: string, metadata: Record<string, any> = {}): string {
    try {
      if (!operationName) {
        this.logger.warn('操作名称不能为空');
        return '';
      }

      const operationId = Utils.generateSessionId();
      const startTime = Utils.now();
      
      const operation: OperationEvent = {
        type: 'operation',
        operationId,
        operationName,
        status: OperationStatus.STARTED,
        startTime,
        metadata,
        steps: [],
        timestamp: startTime
      };
      
      this.activeOperations.set(operationId, operation);
      
      // 上报操作开始事件
      this.reporter(operation);
      
      return operationId;
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
      if (!operationId || !stepName) {
        this.logger.warn('操作ID和步骤名称不能为空');
        return false;
      }

      const operation = this.activeOperations.get(operationId);
      if (!operation) {
        this.logger.warn(`未找到操作ID: ${operationId}`);
        return false;
      }

      const step = {
        stepName,
        stepData,
        timestamp: Utils.now()
      };

      operation.steps.push(step);
      operation.status = OperationStatus.IN_PROGRESS;
      operation.timestamp = step.timestamp;
      
      // 更新操作状态
      this.activeOperations.set(operationId, operation);
      
      // 上报操作进度更新
      this.reporter({
        ...operation,
        type: 'operation',
        status: OperationStatus.IN_PROGRESS
      });
      
      return true;
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
      if (!operationId) {
        this.logger.warn('操作ID不能为空');
        return false;
      }

      const operation = this.activeOperations.get(operationId);
      if (!operation) {
        this.logger.warn(`未找到操作ID: ${operationId}`);
        return false;
      }

      const endTime = Utils.now();
      const duration = endTime - operation.startTime;
      
      // 更新操作状态
      operation.status = isSuccess ? OperationStatus.COMPLETED : OperationStatus.FAILED;
      operation.endTime = endTime;
      operation.duration = duration;
      operation.resultData = resultData;
      operation.timestamp = endTime;
      
      // 上报完整操作链路
      this.reporter(operation);
      
      // 从活动操作中移除
      this.activeOperations.delete(operationId);
      
      return true;
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
      if (!operationId) {
        this.logger.warn('操作ID不能为空');
        return false;
      }

      const operation = this.activeOperations.get(operationId);
      if (!operation) {
        this.logger.warn(`未找到操作ID: ${operationId}`);
        return false;
      }

      const endTime = Utils.now();
      const duration = endTime - operation.startTime;
      
      // 更新操作状态
      operation.status = OperationStatus.CANCELLED;
      operation.endTime = endTime;
      operation.duration = duration;
      operation.cancelReason = reason;
      operation.timestamp = endTime;
      
      // 上报取消操作事件
      this.reporter(operation);
      
      // 从活动操作中移除
      this.activeOperations.delete(operationId);
      
      return true;
    } catch (err) {
      this.logger.error(`取消操作 [${operationId}] 失败`, err);
      return false;
    }
  }

  /**
   * 处理用户交互事件
   * @param {Event} event 交互事件
   * @private
   */
  private handleUserInteraction(event: Event): void {
    try {
      if (!this.autoTrackingEnabled) return;
      
      const now = Utils.now();
      this.lastUserInteraction = now;
      
      // 如果当前没有活动的自动操作，创建一个新的
      if (!this.currentAutoOperation) {
        this.startAutoOperation('用户交互');
        return;
      }
      
      // 添加交互步骤
      if (this.currentAutoOperation) {
        const eventType = event.type;
        const target = event.target as HTMLElement;
        const targetInfo = target ? {
          tagName: target.tagName?.toLowerCase() || 'unknown',
          id: target.id || undefined,
          className: target.className || undefined
        } : 'unknown';
        
        this.addOperationStep(this.currentAutoOperation, `用户${eventType}`, {
          eventType,
          target: targetInfo,
          timestamp: now
        });
      }
    } catch (err) {
      this.logger.error('处理用户交互事件失败', err);
    }
  }
  
  /**
   * 处理页面可见性变化
   * @private
   */
  private handleVisibilityChange(): void {
    try {
      if (!this.autoTrackingEnabled) return;
      
      const isVisible = document.visibilityState === 'visible';
      const now = Utils.now();
      
      if (isVisible) {
        // 页面变为可见，如果没有活动的自动操作，创建一个新的
        if (!this.currentAutoOperation) {
          this.startAutoOperation('页面恢复可见');
        } else {
          this.addOperationStep(this.currentAutoOperation, '页面恢复可见', {
            timestamp: now
          });
        }
      } else {
        // 页面变为不可见，结束当前操作
        if (this.currentAutoOperation) {
          this.completeOperation(this.currentAutoOperation, {
            reason: '页面不可见',
            timestamp: now
          });
          this.currentAutoOperation = null;
        }
      }
    } catch (err) {
      this.logger.error('处理页面可见性变化失败', err);
    }
  }
  
  /**
   * 处理路由变化（SPA应用）
   * @private
   */
  private handleRouteChange(): void {
    try {
      if (!this.autoTrackingEnabled) return;
      
      const now = Utils.now();
      this.lastPageChange = now;
      
      // 结束当前操作并开始新操作
      if (this.currentAutoOperation) {
        this.completeOperation(this.currentAutoOperation, {
          reason: '页面路由变化',
          url: window.location.href,
          timestamp: now
        });
      }
      
      // 开始新的操作
      this.startAutoOperation('页面路由变化', {
        url: window.location.href,
        title: document.title
      });
    } catch (err) {
      this.logger.error('处理路由变化失败', err);
    }
  }
  
  /**
   * 检查自动操作状态
   * @private
   */
  private checkAutoOperationStatus(): void {
    try {
      if (!this.autoTrackingEnabled || !this.currentAutoOperation) return;
      
      const now = Utils.now();
      const operation = this.activeOperations.get(this.currentAutoOperation);
      
      if (!operation) {
        this.currentAutoOperation = null;
        return;
      }
      
      // 检查是否超过最大操作时长
      const operationDuration = now - operation.startTime;
      if (operationDuration > this.maxOperationDuration) {
        this.completeOperation(this.currentAutoOperation, {
          reason: '操作超时',
          duration: operationDuration,
          timestamp: now
        });
        this.currentAutoOperation = null;
        this.startAutoOperation('新操作会话');
        return;
      }
      
      // 检查是否超过无操作阈值
      const timeSinceLastInteraction = now - this.lastUserInteraction;
      if (timeSinceLastInteraction > this.inactivityThreshold) {
        this.completeOperation(this.currentAutoOperation, {
          reason: '用户无操作',
          inactiveTime: timeSinceLastInteraction,
          timestamp: now
        });
        this.currentAutoOperation = null;
      }
    } catch (err) {
      this.logger.error('检查自动操作状态失败', err);
    }
  }
  
  /**
   * 开始自动操作
   * @param {string} operationName 操作名称
   * @param {Record<string, any>} metadata 操作元数据
   * @private
   */
  private startAutoOperation(operationName: string, metadata: Record<string, any> = {}): void {
    try {
      const now = Utils.now();
      this.lastUserInteraction = now;
      
      // 添加自动操作的标识
      const enhancedMetadata = {
        ...metadata,
        isAutoTracked: true,
        url: window.location.href,
        title: document.title,
        timestamp: now
      };
      
      // 开始新操作
      const operationId = this.startOperation(operationName, enhancedMetadata);
      if (operationId) {
        this.currentAutoOperation = operationId;
      }
    } catch (err) {
      this.logger.error(`开始自动操作 [${operationName}] 失败`, err);
    }
  }
  
  /**
   * 处理页面卸载时的未完成操作
   * @private
   */
  private handlePageUnload(): void {
    try {
      // 将所有未完成的操作标记为中断
      this.activeOperations.forEach((operation, operationId) => {
        try {
          const endTime = Utils.now();
          const duration = endTime - operation.startTime;
          
          // 更新操作状态
          operation.status = OperationStatus.INTERRUPTED;
          operation.endTime = endTime;
          operation.duration = duration;
          operation.timestamp = endTime;
          
          // 上报中断操作事件
          this.reporter(operation);
        } catch (err) {
          this.logger.error(`处理未完成操作 [${operationId}] 失败`, err);
        }
      });
      
      // 清空活动操作
      this.activeOperations.clear();
    } catch (err) {
      this.logger.error('处理页面卸载时的未完成操作失败', err);
    }
  }

  /**
   * 获取当前活动操作数量
   * @returns {number} 活动操作数量
   */
  getActiveOperationsCount(): number {
    return this.activeOperations.size;
  }

  /**
   * 获取指定操作的当前状态
   * @param {string} operationId 操作ID
   * @returns {OperationStatus | null} 操作状态
   */
  getOperationStatus(operationId: string): OperationStatus | null {
    try {
      if (!operationId) return null;
      
      const operation = this.activeOperations.get(operationId);
      return operation ? operation.status : null;
    } catch (err) {
      this.logger.error(`获取操作状态 [${operationId}] 失败`, err);
      return null;
    }
  }
  
  /**
   * 获取当前自动操作ID
   * @returns {string | null} 当前自动操作ID
   */
  getCurrentAutoOperation(): string | null {
    return this.currentAutoOperation;
  }
  
  /**
   * 检查自动操作链路记录是否已启用
   * @returns {boolean} 是否已启用
   */
  isAutoTrackingEnabled(): boolean {
    return this.autoTrackingEnabled;
  }
}