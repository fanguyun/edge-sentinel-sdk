/**
 * 错误监控模块
 */
import { CustomErrorEvent, ReportData } from '../types';
import Logger from './logger';

interface ErrorWithStack extends Error {
  stack?: string;
}

export default class ErrorMonitor {
  private reporter: (data: ReportData) => void;
  private initialized: boolean = false;
  private logger: Logger;

  constructor(reporter: (data: ReportData) => void) {
    this.reporter = reporter;
    this.logger = Logger.getInstance();
  }

  init(): void {
    try {
      if (this.initialized) return;

      try {
        this.trackJSErrors();
      } catch (err) {
        this.logger.error('JS错误监控初始化失败', err);
      }

      try {
        this.trackPromiseErrors();
      } catch (err) {
        this.logger.error('Promise错误监控初始化失败', err);
      }

      try {
        this.trackResourceErrors();
      } catch (err) {
        this.logger.error('资源错误监控初始化失败', err);
      }

      this.initialized = true;
      this.logger.info('错误监控模块初始化成功');
    } catch (err) {
      this.logger.error('错误监控模块初始化失败', err);
      // 即使初始化失败也不抛出异常，保证不影响业务应用
    }
  }

  private trackJSErrors(): void {
    window.addEventListener(
      'error',
      (e: ErrorEvent) => {
        try {
          // 过滤SDK自身的错误，避免无限循环
          if (e.filename && e.filename.includes('edge-sentinel-sdk')) {
            // 使用全局错误处理函数处理SDK内部错误
            if (window.__EDGE_SENTINEL_ERROR_HANDLER__) {
              window.__EDGE_SENTINEL_ERROR_HANDLER__(e.error, 'JS错误监控');
            }
            return;
          }

          const errorObj = e.error as ErrorWithStack;
          this.reporter({
            type: 'js_error',
            message: e.message || '未知JS错误',
            stack: errorObj?.stack,
            filename: e.filename,
            lineno: e.lineno,
            colno: e.colno,
            timestamp: Date.now(),
          });
        } catch (err) {
          this.logger.error('JS错误上报失败', err);
          // 即使上报失败也不抛出异常，保证不影响业务应用
        }
      },
      true,
    );
  }

  private trackPromiseErrors(): void {
    window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
      try {
        // 尝试判断是否为SDK自身的Promise错误
        const reasonStr = String(e.reason);
        if (reasonStr.includes('edge-sentinel-sdk')) {
          // 使用全局错误处理函数处理SDK内部错误
          if (window.__EDGE_SENTINEL_ERROR_HANDLER__) {
            window.__EDGE_SENTINEL_ERROR_HANDLER__(
              e.reason instanceof Error ? e.reason : new Error(reasonStr),
              'Promise错误监控',
            );
          }
          return;
        }

        this.reporter({
          type: 'promise_error',
          message: e.reason?.message || String(e.reason) || '未知Promise错误',
          stack: e.reason?.stack,
          timestamp: Date.now(),
        });
      } catch (err) {
        this.logger.error('Promise错误上报失败', err);
        // 即使上报失败也不抛出异常，保证不影响业务应用
      }
    });
  }

  private trackResourceErrors(): void {
    window.addEventListener(
      'error',
      (e: Event) => {
        try {
          const target = e.target as HTMLElement;
          if (target && (target.tagName === 'IMG' || target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
            // 获取资源URL
            let resourceUrl = '';
            try {
              resourceUrl =
                (target as HTMLImageElement | HTMLScriptElement).src || (target as HTMLLinkElement).href || '未知资源';
            } catch (urlErr) {
              resourceUrl = '无法获取资源URL';
              this.logger.warn('无法获取资源URL', urlErr);
            }

            // 过滤SDK自身的资源错误
            if (resourceUrl.includes('edge-sentinel-sdk')) {
              // 使用全局错误处理函数处理SDK内部错误
              if (window.__EDGE_SENTINEL_ERROR_HANDLER__) {
                window.__EDGE_SENTINEL_ERROR_HANDLER__(
                  new Error(`Failed to load SDK resource: ${resourceUrl}`),
                  '资源错误监控',
                );
              }
              return;
            }

            this.reporter({
              type: 'resource_error',
              message: `Failed to load ${target.tagName.toLowerCase()}: ${resourceUrl}`,
              timestamp: Date.now(),
            });
          }
        } catch (err) {
          this.logger.error('资源错误上报失败', err);
          // 即使上报失败也不抛出异常，保证不影响业务应用
        }
      },
      true,
    );
  }

  destroy(): void {
    try {
      // 移除错误监听器
      window.removeEventListener('error', this.trackJSErrors.bind(this), true);
      window.removeEventListener('unhandledrejection', this.trackPromiseErrors.bind(this));
      window.removeEventListener('error', this.trackResourceErrors.bind(this), true);

      this.initialized = false;
      this.logger.info('错误监控模块已销毁');
    } catch (err) {
      this.logger.error('错误监控模块销毁失败', err);
    }
  }
}
