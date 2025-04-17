/**
 * SDK类型定义文件
 */

// SDK配置选项接口
import { LogLevel } from './modules/logger';

export interface SDKOptions {
  appId: string;
  reportUrl: string;
  userKey: string;
  logLevel?: LogLevel;
  maxRetries?: number;
  enableOperationTracking?: boolean; // 是否启用操作链路记录
  operationInactivityThreshold?: number; // 操作链路无操作超时时间（毫秒），默认60000
  operationMaxDuration?: number; // 操作链路最大时长（毫秒），默认300000
}

// 声明全局Navigator接口扩展
declare global {
  interface Navigator {
    deviceMemory?: number;
  }
}

// 基础信息接口
export interface BaseInfo {
  ua: string;
  language: string;
  platform: string;
  deviceMemory: number | null;
  hardwareConcurrency: number | null;
  screen: {
    width: number;
    height: number;
  };
  ip: string | null;
  region: string | null;
  city: string | null;
}

// 自定义错误事件接口
export interface CustomErrorEvent {
  type: 'js_error' | 'promise_error' | 'resource_error';
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
}

// API监控事件接口
export interface APIEvent {
  type: 'api' | 'api_error';
  url: string;
  status?: number;
  duration?: number;
  error?: string;
  timestamp: number;
}

// 页面访问事件接口
export interface PageViewEvent {
  type: 'pv';
  page: string;
  timestamp: number;
}

// 页面可见性事件接口
export interface VisibilityEvent {
  type: 'page_hide' | 'page_show';
  timestamp: number;
}

// 页面离开事件接口
export interface LeaveEvent {
  type: 'leave';
  duration: number;
  maxScroll: number;
  timestamp: number;
}

// 自定义事件接口
export interface CustomEvent {
  type: 'custom';
  name: string;
  data: Record<string, any>;
  timestamp: number;
}

// 操作状态枚举
export enum OperationStatus {
  STARTED = 'started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  INTERRUPTED = 'interrupted'
}

// 操作步骤接口
export interface OperationStep {
  stepName: string;
  stepData: Record<string, any>;
  timestamp: number;
}

// 操作链路事件接口
export interface OperationEvent {
  type: 'operation';
  operationId: string;
  operationName: string;
  status: OperationStatus;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata: Record<string, any>;
  steps: OperationStep[];
  resultData?: Record<string, any>;
  cancelReason?: string;
  timestamp: number;
}

// 上报数据接口
export type ReportData = CustomErrorEvent | APIEvent | PageViewEvent | VisibilityEvent | LeaveEvent | CustomEvent | OperationEvent;
