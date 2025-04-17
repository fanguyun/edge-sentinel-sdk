/**
 * 日志系统模块
 * 用于记录SDK内部错误，避免将错误暴露给业务应用
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  NONE = 'none'
}

export interface LoggerOptions {
  level?: LogLevel;
  maxLogCount?: number;
  reportErrors?: boolean;
}

export default class Logger {
  private static instance: Logger;
  private level: LogLevel;
  private logs: Array<{level: LogLevel; message: string; details?: any; timestamp: number}>;
  private maxLogCount: number;
  private reportErrors: boolean;

  private constructor(options: LoggerOptions = {}) {
    this.level = options.level || LogLevel.WARN;
    this.maxLogCount = options.maxLogCount || 100;
    this.reportErrors = options.reportErrors !== undefined ? options.reportErrors : true;
    this.logs = [];
  }

  /**
   * 获取Logger单例
   */
  public static getInstance(options?: LoggerOptions): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(options);
    }
    return Logger.instance;
  }

  /**
   * 设置日志级别
   */
  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 记录调试日志
   */
  public debug(message: string, details?: any): void {
    this.log(LogLevel.DEBUG, message, details);
  }

  /**
   * 记录信息日志
   */
  public info(message: string, details?: any): void {
    this.log(LogLevel.INFO, message, details);
  }

  /**
   * 记录警告日志
   */
  public warn(message: string, details?: any): void {
    this.log(LogLevel.WARN, message, details);
  }

  /**
   * 记录错误日志
   */
  public error(message: string, details?: any): void {
    this.log(LogLevel.ERROR, message, details);
  }

  /**
   * 获取所有日志
   */
  public getLogs(): Array<{level: LogLevel; message: string; details?: any; timestamp: number}> {
    return [...this.logs];
  }

  /**
   * 清空日志
   */
  public clearLogs(): void {
    this.logs = [];
  }

  /**
   * 记录日志的内部方法
   */
  private log(level: LogLevel, message: string, details?: any): void {
    // 根据设置的日志级别过滤
    if (this.shouldLog(level)) {
      const logEntry = {
        level,
        message,
        details,
        timestamp: Date.now()
      };

      // 添加日志到内存中
      this.logs.push(logEntry);

      // 如果超过最大日志数量，删除最旧的日志
      if (this.logs.length > this.maxLogCount) {
        this.logs.shift();
      }

      // 在控制台输出日志（仅在非生产环境）
      if (process.env.NODE_ENV !== 'production') {
        const logMethod = this.getConsoleMethod(level);
        console[logMethod](`[EdgeSentinel] ${message}`, details || '');
      }
    }
  }

  /**
   * 判断是否应该记录该级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.level);
    const targetLevelIndex = levels.indexOf(level);
    
    return currentLevelIndex <= targetLevelIndex && this.level !== LogLevel.NONE;
  }

  /**
   * 获取对应日志级别的控制台方法
   */
  private getConsoleMethod(level: LogLevel): 'debug' | 'info' | 'warn' | 'error' {
    switch (level) {
      case LogLevel.DEBUG:
        return 'debug';
      case LogLevel.INFO:
        return 'info';
      case LogLevel.WARN:
        return 'warn';
      case LogLevel.ERROR:
        return 'error';
      default:
        return 'info';
    }
  }
}