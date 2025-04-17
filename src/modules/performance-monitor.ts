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
    }}

  private trackPV(): void {
    try {
      this.pageViews++;
      this.reporter({
        type: 'pv',
        page: location?.pathname || 'unknown',
        timestamp: Date.now()
      } as PageViewEvent);
    } catch (err) {
      this.logger.error('页面访问上报失败', err);
      // 即使上报失败也不抛出异常，保证不影响业务应用
    }}

  private trackAPI(): void {
    try {
      // 保存原始fetch方法
      const origFetch = window.fetch;
      
      // 确保原始fetch方法存在
      if (!origFetch) {
        this.logger.warn('Fetch API不可用，API监控将不会生效');
        return;
      }
      
      // 重写fetch方法
      window.fetch = (...args: Parameters<typeof fetch>): Promise<Response> => {
        try {
          const start = Date.now();
          let url = 'unknown';
          
          try {
            url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url || String(args[0]);
          } catch (urlErr) {
            this.logger.warn('无法获取请求URL', urlErr);
          }
          
          return origFetch(...args)
            .then((res: Response) => {
              try {
                // 过滤SDK自身的API请求
                if (!url.includes('edge-sentinel-sdk')) {
                  this.reporter({
                    type: 'api',
                    url,
                    status: res.status,
                    duration: Date.now() - start,
                    timestamp: Date.now()
                  } as APIEvent);
                }
              } catch (reportErr) {
                this.logger.error('API成功监控上报失败', reportErr);
              }
              return res;
            })
            .catch((err: Error) => {
              try {
                // 过滤SDK自身的API请求
                if (!url.includes('edge-sentinel-sdk')) {
                  this.reporter({
                    type: 'api_error',
                    url,
                    error: err.message || '未知API错误',
                    timestamp: Date.now()
                  } as APIEvent);
                }
              } catch (reportErr) {
                this.logger.error('API错误监控上报失败', reportErr);
              }
              throw err; // 重新抛出错误，不影响原有业务逻辑
            });
        } catch (err) {
          this.logger.error('API监控拦截器出错', err);
          // 如果监控过程出错，调用原始fetch方法，确保业务请求不受影响
          return origFetch(...args);
        }
      };
    } catch (err) {
      this.logger.error('API监控初始化失败', err);
      // 即使初始化失败也不抛出异常，保证不影响业务应用
    }}

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
            timestamp: Date.now()
          });
        } catch (err) {
          this.logger.error('页面可见性变化上报失败', err);
          // 即使上报失败也不抛出异常，保证不影响业务应用
        }
      });
    } catch (err) {
      this.logger.error('页面可见性监控初始化失败', err);
      // 即使初始化失败也不抛出异常，保证不影响业务应用
    }}

  private trackBeforeUnload(): void {
    try {
      window.addEventListener('beforeunload', () => {
        try {
          this.reporter({
            type: 'leave',
            duration: Date.now() - this.startTime,
            maxScroll: this.maxScroll,
            timestamp: Date.now()
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
}}
