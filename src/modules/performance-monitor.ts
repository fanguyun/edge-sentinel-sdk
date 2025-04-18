/**
 * 性能监控模块
 */
import { APIEvent, PageViewEvent, ReportData } from '../types';
import Logger from './logger';

export default class PerformanceMonitor {
  private reporter: (data: ReportData) => void;
  private initialized: boolean = false;
  private startTime: number;
  private pageViews: number = 0;
  private maxScroll: number = 0;
  private logger: Logger;

  constructor(reporter: (data: ReportData) => void) {
    this.reporter = reporter;
    this.startTime = Date.now();
    this.logger = Logger.getInstance();
  }

  init(): void {
    try {
      if (this.initialized) return;

      try {
        this.trackAPI();
      } catch (err) {
        this.logger.error('API监控初始化失败', err);
      }

      try {
        this.trackPV();
      } catch (err) {
        this.logger.error('页面访问监控初始化失败', err);
      }

      try {
        this.trackVisitDepth();
      } catch (err) {
        this.logger.error('访问深度监控初始化失败', err);
      }

      try {
        this.trackVisibility();
      } catch (err) {
        this.logger.error('页面可见性监控初始化失败', err);
      }

      try {
        this.trackBeforeUnload();
      } catch (err) {
        this.logger.error('页面离开监控初始化失败', err);
      }

      this.initialized = true;
      this.logger.info('性能监控模块初始化成功');
    } catch (err) {
      this.logger.error('性能监控模块初始化失败', err);
      // 即使初始化失败也不抛出异常，保证不影响业务应用
    }
  }

  private trackPV(): void {
    try {
      this.pageViews++;
      this.reporter({
        type: 'pv',
        page: location?.pathname || 'unknown',
        timestamp: Date.now(),
      } as PageViewEvent);
    } catch (err) {
      this.logger.error('页面访问上报失败', err);
      // 即使上报失败也不抛出异常，保证不影响业务应用
    }
  }

  private trackAPI(): void {
    try {
      // 保存原始fetch方法
      const origFetch = window.fetch;

      // 请求频率限制
      const requestMap = new Map<string, { count: number; timestamp: number }>();
      const REQUEST_LIMIT = 5; // 相同URL在5秒内最多上报5次
      const LIMIT_DURATION = 5000; // 5秒

      // 清理过期的记录
      const cleanExpiredRecords = () => {
        const now = Date.now();
        requestMap.forEach((value, key) => {
          if (now - value.timestamp >= LIMIT_DURATION) {
            requestMap.delete(key);
          }
        });
      };

      // 确保原始fetch方法存在
      if (!origFetch) {
        this.logger.warn('Fetch API不可用，API监控将不会生效');
        return;
      }

      // 重写fetch方法
      window.fetch = async (input: RequestInfo, init?: RequestInit) => {
        const startTime = Date.now();
        const url = typeof input === 'string' ? input : input.url;

        try {
          const response = await origFetch(input, init);
          const endTime = Date.now();

          // 检查请求频率限制
          const key = `${url}`;
          const record = requestMap.get(key);
          if (record) {
            if (Date.now() - record.timestamp < LIMIT_DURATION) {
              if (record.count >= REQUEST_LIMIT) {
                return response;
              }
              record.count++;
            } else {
              record.count = 1;
              record.timestamp = Date.now();
            }
          } else {
            requestMap.set(key, { count: 1, timestamp: Date.now() });
          }

          // 清理过期记录
          cleanExpiredRecords();

          // 上报API性能数据
          this.reporter({
            type: 'api',
            url,
            method: init?.method || 'GET',
            status: response.status,
            duration: endTime - startTime,
            timestamp: startTime,
          } as APIEvent);

          return response;
        } catch (error) {
          const endTime = Date.now();

          // 上报API错误数据
          this.reporter({
            type: 'api_error',
            url,
            method: init?.method || 'GET',
            error: error instanceof Error ? error.message : String(error),
            duration: endTime - startTime,
            timestamp: startTime,
          });

          throw error;
        }
      };
    } catch (err) {
      this.logger.error('API监控初始化失败', err);
    }
  }

  destroy(): void {
    try {
      // 移除页面可见性监听器
      document.removeEventListener('visibilitychange', this.trackVisibility.bind(this));

      // 移除页面离开监听器
      window.removeEventListener('beforeunload', this.trackBeforeUnload.bind(this));

      // 移除访问深度监听器
      window.removeEventListener('scroll', this.trackVisitDepth.bind(this));

      // 恢复原始fetch方法
      if (window.fetch && window.fetch !== this.trackAPI) {
        window.fetch = window.fetch;
      }

      this.initialized = false;
      this.logger.info('性能监控模块已销毁');
    } catch (err) {
      this.logger.error('性能监控模块销毁失败', err);
    }
  }

  private trackVisitDepth(): void {
    try {
      let scrolling = false;
      window.addEventListener('scroll', () => {
        try {
          if (!scrolling) {
            window.requestAnimationFrame(() => {
              try {
                // 使用安全的方式获取滚动信息
                let scrollTop = 0;
                let scrollHeight = 0;
                let clientHeight = 0;

                try {
                  scrollTop = document.documentElement?.scrollTop || document.body?.scrollTop || 0;
                  scrollHeight = document.documentElement?.scrollHeight || document.body?.scrollHeight || 0;
                  clientHeight = document.documentElement?.clientHeight || window.innerHeight || 0;
                } catch (domErr) {
                  this.logger.warn('获取DOM滚动信息失败', domErr);
                }

                // 防止除以零错误
                if (scrollHeight <= clientHeight) {
                  scrolling = false;
                  return;
                }

                const scrollPercentage = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);

                if (scrollPercentage > this.maxScroll) {
                  this.maxScroll = scrollPercentage;
                }

                scrolling = false;
              } catch (frameErr) {
                this.logger.error('滚动深度计算失败', frameErr);
                scrolling = false;
              }
            });
            scrolling = true;
          }
        } catch (scrollErr) {
          this.logger.error('滚动事件处理失败', scrollErr);
          // 即使处理失败也不抛出异常，保证不影响业务应用
        }
      });
    } catch (err) {
      this.logger.error('访问深度监控初始化失败', err);
      // 即使初始化失败也不抛出异常，保证不影响业务应用
    }
  }
  private trackVisibility(): void {
    try {
      document.addEventListener('visibilitychange', () => {
        try {
          this.reporter({
            type: document.visibilityState === 'hidden' ? 'page_hide' : 'page_show',
            timestamp: Date.now(),
          });
        } catch (err) {
          this.logger.error('页面可见性变化上报失败', err);
          // 即使上报失败也不抛出异常，保证不影响业务应用
        }
      });
    } catch (err) {
      this.logger.error('页面可见性监控初始化失败', err);
      // 即使初始化失败也不抛出异常，保证不影响业务应用
    }
  }

  private trackBeforeUnload(): void {
    try {
      window.addEventListener('beforeunload', () => {
        try {
          this.reporter({
            type: 'leave',
            duration: Date.now() - this.startTime,
            maxScroll: this.maxScroll,
            timestamp: Date.now(),
          });
        } catch (err) {
          this.logger.error('页面离开上报失败', err);
          // 即使上报失败也不抛出异常，保证不影响业务应用
        }
      });
    } catch (err) {
      this.logger.error('页面离开监控初始化失败', err);
      // 即使初始化失败也不抛出异常，保证不影响业务应用
    }
  }
}
