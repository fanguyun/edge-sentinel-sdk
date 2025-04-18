/**
 * SDK类型定义文件
 */

// SDK配置选项接口
import { LogLevel } from './modules/logger';

// 上报策略类型
export type ReportStrategy = 'immediate' | 'batch' | 'periodic';

// 地理位置服务提供商类型
export type GeoLocationProvider = 'ipify' | 'ipinfo' | 'custom';

// 地理位置服务配置
export interface GeoLocationServiceConfig {
  provider: GeoLocationProvider;
  apiKey?: string;
  endpoint?: string; // 自定义服务端点
}

export interface SDKOptions {
  appId: string;
  reportUrl: string;
  userKey: string;
  logLevel?: LogLevel;
  maxRetries?: number;
  enableOperationTracking?: boolean; // 是否启用操作链路记录
  operationInactivityThreshold?: number; // 操作链路无操作超时时间（毫秒），默认60000
  operationMaxDuration?: number; // 操作链路最大时长（毫秒），默认300000

  // 数据压缩配置
  enableCompression?: boolean; // 是否启用数据压缩

  // 批量上报配置
  reportStrategy?: ReportStrategy; // 上报策略
  batchSize?: number; // 批量上报的数量阈值
  reportInterval?: number; // 定时上报的时间间隔（毫秒）
  enableOfflineCache?: boolean; // 是否启用离线缓存
  maxCacheSize?: number; // 最大缓存数量
  maxCacheAge?: number; // 缓存数据最大保留时间（毫秒）

  // 地理位置服务配置
  geoLocationService?: GeoLocationServiceConfig;

  // 调试模式配置
  debugMode?: boolean; // 是否启用调试模式
  debugCallback?: (eventType: string, data: any) => void; // 调试回调函数

  // 数据脱敏配置
  sensitiveFields?: string[]; // 需要脱敏的字段名列表
  customSensitiveHandler?: (key: string, value: any) => any; // 自定义脱敏处理函数

  // 数据采样配置
  enableSampling?: boolean; // 是否启用数据采样
  samplingConfig?: Record<string, SamplingOptions>; // 各事件类型的采样配置
  defaultSamplingRate?: number; // 默认采样率 (0-1)

  // 用户行为回放配置
  enableReplay?: boolean; // 是否启用用户行为回放
  replayOptions?: ReplayOptions; // 回放配置选项
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
  url: string;
  networkInfo: {
    effectiveType: string | null;
    downlink: number | null;
    rtt: number | null;
    saveData: boolean | null;
  };
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
  request?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  };
  response?: {
    headers?: Record<string, string>;
    body?: string;
  };
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
  INTERRUPTED = 'interrupted',
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

// 性能指标事件接口
export interface PerformanceEvent {
  type: 'performance';
  name: string;
  value: number;
  id: string;
  navigationType: string | null;
  rating: string;
  timestamp: number;
}

// 采样策略枚举
export enum SamplingStrategy {
  RANDOM = 'random', // 随机采样
  CONSISTENT = 'consistent', // 一致性采样（相同特征的事件采样结果一致）
  RATE_LIMITING = 'rate_limiting', // 频率限制采样（限制单位时间内的事件数量）
}

// 采样配置接口
export interface SamplingOptions {
  strategy: SamplingStrategy; // 采样策略
  rate: number; // 采样率 (0-1)
  consistentKey?: string; // 一致性采样的键名
  timeWindow?: number; // 频率限制采样的时间窗口（毫秒）
  maxEventsPerWindow?: number; // 频率限制采样的最大事件数
}

// 回放事件类型枚举
export enum ReplayEventType {
  MOUSE_MOVE = 'mouse_move',
  MOUSE_CLICK = 'mouse_click',
  SCROLL = 'scroll',
  INPUT = 'input',
  KEY_PRESS = 'key_press',
  DOM_MUTATION = 'dom_mutation',
  NAVIGATION = 'navigation',
  VIEWPORT_RESIZE = 'viewport_resize',
  CUSTOM = 'custom',
}

// 回放配置接口
export interface ReplayOptions {
  captureMouseMove?: boolean; // 是否捕获鼠标移动
  mouseMoveThrottleMs?: number; // 鼠标移动事件节流时间（毫秒）
  captureDomMutations?: boolean; // 是否捕获DOM变化
  captureInputs?: boolean; // 是否捕获输入事件
  captureScroll?: boolean; // 是否捕获滚动事件
  scrollThrottleMs?: number; // 滚动事件节流时间（毫秒）
  captureKeyPress?: boolean; // 是否捕获键盘事件
  captureNavigation?: boolean; // 是否捕获导航事件
  captureViewportResize?: boolean; // 是否捕获视口大小变化
  maxSessionDuration?: number; // 最大会话时长（毫秒）
  maxEventsPerSession?: number; // 每个会话最大事件数
  ignoredElements?: string[]; // 忽略的元素选择器
  sensitiveAttributes?: string[]; // 敏感属性列表
  sensitiveInputs?: string[]; // 敏感输入字段选择器
  maskTextContent?: boolean; // 是否掩码文本内容
  maskInputValues?: boolean; // 是否掩码输入值
  compressionEnabled?: boolean; // 是否启用压缩
  samplingRate?: number; // 采样率 (0-1)
}

// 回放会话事件接口
export interface ReplaySessionEvent {
  type: 'replay_session';
  sessionId: string;
  startTime: number;
  endTime: number;
  duration: number;
  eventCount: number;
  metadata: Record<string, any>;
  events: any;
  timestamp: number;
}

// 上报数据接口
export type ReportData =
  | CustomErrorEvent
  | APIEvent
  | PageViewEvent
  | VisibilityEvent
  | LeaveEvent
  | CustomEvent
  | OperationEvent
  | PerformanceEvent
  | ReplaySessionEvent;
