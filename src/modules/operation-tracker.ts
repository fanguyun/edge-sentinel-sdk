/**
 * 操作链路记录模块
 * 用于记录用户的完整操作链路，每次完整操作为一条记录
 */
import { OperationEvent, OperationStatus, ReportData } from '../types';
import Utils from './utils';
import Logger from './logger';

export default class OperationTracker {
  private reporter: (data: ReportData) => void;
  private initialized: boolean = false;
  private logger: Logger;
  private activeOperations: Map<string, OperationEvent> = new Map();

  constructor(reporter: (data: ReportData) => void) {
    this.reporter = reporter;
    this.logger = Logger.getInstance();
  }

  /**
   * 初始化操作链路记录模块
   */
  init(): void {
    try {
      if (this.initialized) return;
      
      // 页面关闭前处理未完成的操作
      window.addEventListener('beforeunload', () => {
        this.handlePageUnload();
      });
      
      this.initialized = true;
      this.logger.info('操作链路记录模块初始化成功');
    } catch (err) {
      this.logger.error('操作链路记录模块初始化失败', err);
      // 即使初始化失败也不抛出异常，保证不影响业务应用
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
}