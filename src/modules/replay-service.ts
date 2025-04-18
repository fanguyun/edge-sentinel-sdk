/**
 * 用户行为回放服务模块
 * 提供用户行为记录和回放功能，记录DOM变化和用户交互
 */
import Logger from './logger';
import Utils from './utils';
import { ReportData } from '../types';
import CompressionService from './compression-service';

/**
 * 回放事件类型枚举
 */
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

/**
 * 回放事件接口
 */
export interface ReplayEvent {
  type: ReplayEventType;
  timestamp: number;
  data: any;
}

/**
 * DOM变化记录接口
 */
export interface DomMutationRecord {
  type: 'addNode' | 'removeNode' | 'attributeChange' | 'textChange';
  target: string; // 序列化后的DOM路径
  attributes?: Record<string, string | null>; // 属性变化
  value?: string; // 文本变化的值
  nodeType?: number; // 节点类型
  tagName?: string; // 标签名
  addedNodes?: Array<{
    nodeType: number;
    tagName?: string;
    textContent?: string;
    attributes?: Record<string, string>;
  }>;
  removedNodes?: Array<{
    nodeType: number;
    tagName?: string;
    textContent?: string;
  }>;
}

/**
 * 回放会话接口
 */
export interface ReplaySession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  events: ReplayEvent[];
  metadata: {
    url: string;
    userAgent: string;
    screenWidth: number;
    screenHeight: number;
    [key: string]: any;
  };
}

/**
 * 回放配置接口
 */
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

export default class ReplayService {
  private logger: Logger;
  private reporter: (data: ReportData) => void;
  private options: ReplayOptions;
  private currentSession: ReplaySession | null = null;
  private isRecording: boolean = false;
  private mutationObserver: MutationObserver | null = null;
  private lastMouseMoveTime: number = 0;
  private lastScrollTime: number = 0;
  private boundHandleMouseMove: (e: MouseEvent) => void;
  private boundHandleClick: (e: MouseEvent) => void;
  private boundHandleScroll: (e: Event) => void;
  private boundHandleInput: (e: Event) => void;
  private boundHandleKeyPress: (e: KeyboardEvent) => void;
  private boundHandleNavigation: () => void;
  private boundHandleViewportResize: () => void;
  private sessionCheckInterval: number | null = null;

  constructor(reporter: (data: ReportData) => void, options: ReplayOptions = {}) {
    this.logger = Logger.getInstance();
    this.reporter = reporter;
    this.options = this.getDefaultOptions();
    this.updateOptions(options);

    // 绑定事件处理函数
    this.boundHandleMouseMove = this.handleMouseMove.bind(this);
    this.boundHandleClick = this.handleClick.bind(this);
    this.boundHandleScroll = this.handleScroll.bind(this);
    this.boundHandleInput = this.handleInput.bind(this);
    this.boundHandleKeyPress = this.handleKeyPress.bind(this);
    this.boundHandleNavigation = this.handleNavigation.bind(this);
    this.boundHandleViewportResize = this.handleViewportResize.bind(this);
  }

  /**
   * 获取默认配置
   */
  private getDefaultOptions(): ReplayOptions {
    return {
      captureMouseMove: true,
      mouseMoveThrottleMs: 100, // 100ms节流
      captureDomMutations: true,
      captureInputs: true,
      captureScroll: true,
      scrollThrottleMs: 100, // 100ms节流
      captureKeyPress: true,
      captureNavigation: true,
      captureViewportResize: true,
      maxSessionDuration: 30 * 60 * 1000, // 30分钟
      maxEventsPerSession: 10000, // 每个会话最多10000个事件
      ignoredElements: ['.sensitive', '[data-sensitive]'],
      sensitiveAttributes: ['password', 'token', 'secret', 'credential'],
      sensitiveInputs: ['[type=password]', '[name*=password]', '[name*=token]'],
      maskTextContent: false,
      maskInputValues: true,
      compressionEnabled: true,
      samplingRate: 1.0, // 默认全量采集
    };
  }

  /**
   * 更新配置
   * @param options 新的配置选项
   */
  updateOptions(options: Partial<ReplayOptions>): void {
    this.options = { ...this.options, ...options };

    // 如果正在记录，需要重新应用配置
    if (this.isRecording) {
      this.stopRecording();
      this.startRecording();
    }
  }

  /**
   * 开始记录用户行为
   */
  startRecording(): void {
    try {
      if (this.isRecording) return;

      // 创建新会话
      this.currentSession = {
        sessionId: Utils.generateSessionId(),
        startTime: Utils.now(),
        events: [],
        metadata: {
          url: window.location.href,
          userAgent: navigator.userAgent,
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
          title: document.title,
          referrer: document.referrer,
        },
      };

      // 注册事件监听器
      this.registerEventListeners();

      // 启动会话检查定时器
      this.sessionCheckInterval = window.setInterval(() => {
        this.checkSessionLimits();
      }, 10000); // 每10秒检查一次

      this.isRecording = true;
      this.logger.info('用户行为回放记录已开始');
    } catch (err) {
      this.logger.error('开始记录用户行为失败', err);
    }
  }

  /**
   * 停止记录用户行为
   */
  stopRecording(): void {
    try {
      if (!this.isRecording) return;

      // 取消注册事件监听器
      this.unregisterEventListeners();

      // 清除会话检查定时器
      if (this.sessionCheckInterval !== null) {
        clearInterval(this.sessionCheckInterval);
        this.sessionCheckInterval = null;
      }

      // 完成当前会话
      if (this.currentSession) {
        this.currentSession.endTime = Utils.now();
        this.saveSession(this.currentSession);
        this.currentSession = null;
      }

      this.isRecording = false;
      this.logger.info('用户行为回放记录已停止');
    } catch (err) {
      this.logger.error('停止记录用户行为失败', err);
    }
  }

  /**
   * 注册事件监听器
   */
  private registerEventListeners(): void {
    try {
      // 鼠标移动
      if (this.options.captureMouseMove) {
        document.addEventListener('mousemove', this.boundHandleMouseMove, { passive: true });
      }

      // 鼠标点击
      document.addEventListener('click', this.boundHandleClick, { passive: true });

      // 滚动
      if (this.options.captureScroll) {
        window.addEventListener('scroll', this.boundHandleScroll, { passive: true });
      }

      // 输入
      if (this.options.captureInputs) {
        document.addEventListener('input', this.boundHandleInput, { passive: true });
        document.addEventListener('change', this.boundHandleInput, { passive: true });
      }

      // 键盘事件
      if (this.options.captureKeyPress) {
        document.addEventListener('keydown', this.boundHandleKeyPress, { passive: true });
      }

      // 导航事件
      if (this.options.captureNavigation) {
        window.addEventListener('popstate', this.boundHandleNavigation);
        window.addEventListener('hashchange', this.boundHandleNavigation);
      }

      // 视口大小变化
      if (this.options.captureViewportResize) {
        window.addEventListener('resize', this.boundHandleViewportResize, { passive: true });
      }

      // DOM变化
      if (this.options.captureDomMutations) {
        this.setupMutationObserver();
      }

      // 页面卸载前保存会话
      window.addEventListener('beforeunload', () => {
        this.stopRecording();
      });
    } catch (err) {
      this.logger.error('注册事件监听器失败', err);
    }
  }

  /**
   * 取消注册事件监听器
   */
  private unregisterEventListeners(): void {
    try {
      // 鼠标移动
      document.removeEventListener('mousemove', this.boundHandleMouseMove);

      // 鼠标点击
      document.removeEventListener('click', this.boundHandleClick);

      // 滚动
      window.removeEventListener('scroll', this.boundHandleScroll);

      // 输入
      document.removeEventListener('input', this.boundHandleInput);
      document.removeEventListener('change', this.boundHandleInput);

      // 键盘事件
      document.removeEventListener('keydown', this.boundHandleKeyPress);

      // 导航事件
      window.removeEventListener('popstate', this.boundHandleNavigation);
      window.removeEventListener('hashchange', this.boundHandleNavigation);

      // 视口大小变化
      window.removeEventListener('resize', this.boundHandleViewportResize);

      // DOM变化
      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
        this.mutationObserver = null;
      }
    } catch (err) {
      this.logger.error('取消注册事件监听器失败', err);
    }
  }

  /**
   * 设置DOM变化观察器
   */
  private setupMutationObserver(): void {
    try {
      if (!window.MutationObserver) {
        this.logger.warn('当前浏览器不支持MutationObserver，DOM变化记录功能将被禁用');
        return;
      }

      this.mutationObserver = new MutationObserver((mutations) => {
        this.handleDomMutations(mutations);
      });

      this.mutationObserver.observe(document.documentElement, {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true,
        attributeOldValue: true,
        characterDataOldValue: true,
      });
    } catch (err) {
      this.logger.error('设置DOM变化观察器失败', err);
    }
  }

  /**
   * 处理鼠标移动事件
   */
  private handleMouseMove(e: MouseEvent): void {
    try {
      const now = Utils.now();

      // 节流处理
      if (now - this.lastMouseMoveTime < (this.options.mouseMoveThrottleMs || 100)) {
        return;
      }

      this.lastMouseMoveTime = now;

      // 应用采样率
      if (Math.random() > (this.options.samplingRate || 1)) {
        return;
      }

      this.addEvent({
        type: ReplayEventType.MOUSE_MOVE,
        timestamp: now,
        data: {
          x: e.clientX,
          y: e.clientY,
          pageX: e.pageX,
          pageY: e.pageY,
        },
      });
    } catch (err) {
      this.logger.error('处理鼠标移动事件失败', err);
    }
  }

  /**
   * 处理点击事件
   */
  private handleClick(e: MouseEvent): void {
    try {
      // 获取点击的元素
      const target = e.target as HTMLElement;

      // 检查是否为忽略的元素
      if (this.shouldIgnoreElement(target)) {
        return;
      }

      this.addEvent({
        type: ReplayEventType.MOUSE_CLICK,
        timestamp: Utils.now(),
        data: {
          x: e.clientX,
          y: e.clientY,
          pageX: e.pageX,
          pageY: e.pageY,
          elementType: target.tagName.toLowerCase(),
          elementId: target.id,
          elementClasses: target.className,
          path: this.getElementPath(target),
        },
      });
    } catch (err) {
      this.logger.error('处理点击事件失败', err);
    }
  }

  /**
   * 处理滚动事件
   */
  private handleScroll(e: Event): void {
    try {
      const now = Utils.now();

      // 节流处理
      if (now - this.lastScrollTime < (this.options.scrollThrottleMs || 100)) {
        return;
      }

      this.lastScrollTime = now;

      // 应用采样率
      if (Math.random() > (this.options.samplingRate || 1)) {
        return;
      }

      this.addEvent({
        type: ReplayEventType.SCROLL,
        timestamp: now,
        data: {
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          maxScrollX: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - window.innerWidth,
          maxScrollY: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight,
        },
      });
    } catch (err) {
      this.logger.error('处理滚动事件失败', err);
    }
  }

  /**
   * 处理输入事件
   */
  private handleInput(e: Event): void {
    try {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

      // 检查是否为忽略的元素
      if (this.shouldIgnoreElement(target)) {
        return;
      }

      // 获取输入值（可能需要脱敏）
      let value = target.value;

      // 检查是否需要掩码输入值
      if (this.options.maskInputValues || this.isSensitiveInput(target)) {
        value = this.maskValue(value);
      }

      this.addEvent({
        type: ReplayEventType.INPUT,
        timestamp: Utils.now(),
        data: {
          elementType: target.tagName.toLowerCase(),
          elementId: target.id,
          elementName: target.name,
          value: value,
          path: this.getElementPath(target),
        },
      });
    } catch (err) {
      this.logger.error('处理输入事件失败', err);
    }
  }

  /**
   * 处理键盘事件
   */
  private handleKeyPress(e: KeyboardEvent): void {
    try {
      const target = e.target as HTMLElement;

      // 检查是否为忽略的元素
      if (this.shouldIgnoreElement(target)) {
        return;
      }

      // 不记录具体按键值，只记录按键事件发生
      this.addEvent({
        type: ReplayEventType.KEY_PRESS,
        timestamp: Utils.now(),
        data: {
          elementType: target.tagName.toLowerCase(),
          elementId: target.id,
          path: this.getElementPath(target),
          // 只记录特殊键，不记录具体字符
          isCtrl: e.ctrlKey,
          isAlt: e.altKey,
          isShift: e.shiftKey,
          isMeta: e.metaKey,
          keyCode: e.keyCode,
        },
      });
    } catch (err) {
      this.logger.error('处理键盘事件失败', err);
    }
  }

  /**
   * 处理导航事件
   */
  private handleNavigation(): void {
    try {
      this.addEvent({
        type: ReplayEventType.NAVIGATION,
        timestamp: Utils.now(),
        data: {
          url: window.location.href,
          title: document.title,
          referrer: document.referrer,
        },
      });
    } catch (err) {
      this.logger.error('处理导航事件失败', err);
    }
  }

  /**
   * 处理视口大小变化事件
   */
  private handleViewportResize(): void {
    try {
      this.addEvent({
        type: ReplayEventType.VIEWPORT_RESIZE,
        timestamp: Utils.now(),
        data: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      });
    } catch (err) {
      this.logger.error('处理视口大小变化事件失败', err);
    }
  }

  /**
   * 处理DOM变化
   */
  private handleDomMutations(mutations: MutationRecord[]): void {
    try {
      // 应用采样率
      if (Math.random() > (this.options.samplingRate || 1)) {
        return;
      }

      const records: DomMutationRecord[] = [];

      for (const mutation of mutations) {
        // 检查是否为忽略的元素
        if (this.shouldIgnoreElement(mutation.target as HTMLElement)) {
          continue;
        }

        if (mutation.type === 'attributes') {
          // 属性变化
          const attributeName = mutation.attributeName as string;

          // 检查是否为敏感属性
          if (this.isSensitiveAttribute(attributeName)) {
            continue;
          }

          const newValue = (mutation.target as HTMLElement).getAttribute(attributeName);

          records.push({
            type: 'attributeChange',
            target: this.getElementPath(mutation.target as HTMLElement),
            attributes: { [attributeName]: newValue },
          });
        } else if (mutation.type === 'characterData') {
          // 文本变化
          let value = mutation.target.nodeValue || '';

          // 检查是否需要掩码文本内容
          if (this.options.maskTextContent) {
            value = this.maskValue(value);
          }

          records.push({
            type: 'textChange',
            target: this.getElementPath(mutation.target as HTMLElement),
            value: value,
          });
        } else if (mutation.type === 'childList') {
          // 子节点变化
          if (mutation.addedNodes.length > 0) {
            const addedNodes = Array.from(mutation.addedNodes)
              .filter((node) => !this.shouldIgnoreElement(node as HTMLElement))
              .map((node) => this.serializeNode(node));

            if (addedNodes.length > 0) {
              records.push({
                type: 'addNode',
                target: this.getElementPath(mutation.target as HTMLElement),
                addedNodes: addedNodes,
              });
            }
          }

          if (mutation.removedNodes.length > 0) {
            const removedNodes = Array.from(mutation.removedNodes)
              .filter((node) => !this.shouldIgnoreElement(node as HTMLElement))
              .map((node) => this.serializeNode(node));

            if (removedNodes.length > 0) {
              records.push({
                type: 'removeNode',
                target: this.getElementPath(mutation.target as HTMLElement),
                removedNodes: removedNodes,
              });
            }
          }
        }
      }

      if (records.length > 0) {
        this.addEvent({
          type: ReplayEventType.DOM_MUTATION,
          timestamp: Utils.now(),
          data: { records },
        });
      }
    } catch (err) {
      this.logger.error('处理DOM变化失败', err);
    }
  }

  /**
   * 添加事件到当前会话
   */
  private addEvent(event: ReplayEvent): void {
    if (!this.isRecording || !this.currentSession) return;

    this.currentSession.events.push(event);

    // 检查是否达到最大事件数
    this.checkSessionLimits();
  }

  /**
   * 检查会话是否达到限制
   */
  private checkSessionLimits(): void {
    if (!this.currentSession) return;

    const now = Utils.now();
    const sessionDuration = now - this.currentSession.startTime;
    const maxDuration = this.options.maxSessionDuration || 30 * 60 * 1000; // 默认30分钟
    const maxEvents = this.options.maxEventsPerSession || 10000;

    // 检查会话时长
    if (sessionDuration >= maxDuration) {
      this.logger.info(`会话已达到最大时长 ${maxDuration}ms，开始新会话`);
      this.stopRecording();
      this.startRecording();
      return;
    }

    // 检查事件数量
    if (this.currentSession.events.length >= maxEvents) {
      this.logger.info(`会话已达到最大事件数 ${maxEvents}，开始新会话`);
      this.stopRecording();
      this.startRecording();
      return;
    }
  }

  /**
   * 保存会话数据
   */
  private saveSession(session: ReplaySession): void {
    try {
      // 创建自定义事件数据
      const replayData: ReportData = {
        type: 'replay_session',
        sessionId: session.sessionId,
        startTime: session.startTime,
        endTime: session.endTime || Utils.now(),
        duration: (session.endTime || Utils.now()) - session.startTime,
        eventCount: session.events.length,
        metadata: session.metadata,
        events: session.events,
        timestamp: Utils.now(),
      };

      // 如果启用了压缩，则压缩事件数据
      if (this.options.compressionEnabled) {
        const compressionService = new CompressionService();
        replayData.events = JSON.parse(
          compressionService.decompress(compressionService.compress(JSON.stringify(session.events))),
        );
      }

      // 上报数据
      this.reporter(replayData);
    } catch (err) {
      this.logger.error('保存会话数据失败', err);
    }
  }

  /**
   * 获取元素路径
   */
  private getElementPath(element: HTMLElement | Node): string {
    try {
      if (!element || element.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const htmlElement = element as HTMLElement;
      let path = '';
      let currentElement: HTMLElement | null = htmlElement;

      while (currentElement && currentElement !== document.documentElement) {
        let selector = currentElement.tagName.toLowerCase();

        if (currentElement.id) {
          selector += `#${currentElement.id}`;
          // ID选择器通常是唯一的，可以直接返回
          path = selector + (path ? ' > ' + path : '');
          break;
        } else {
          // 添加类名
          if (currentElement.className) {
            const classes = currentElement.className.split(/\s+/).filter((c) => c);
            selector += classes.map((c) => `.${c}`).join('');
          }

          // 添加位置索引
          const siblings = currentElement.parentElement ? Array.from(currentElement.parentElement.children) : [];
          if (siblings.length > 1) {
            const index = siblings.indexOf(currentElement) + 1;
            selector += `:nth-child(${index})`;
          }
        }

        path = selector + (path ? ' > ' + path : '');
        currentElement = currentElement.parentElement;
      }

      return path;
    } catch (err) {
      this.logger.error('获取元素路径失败', err);
      return '';
    }
  }

  /**
   * 序列化节点
   */
  private serializeNode(node: Node): any {
    try {
      const result: any = {
        nodeType: node.nodeType,
      };

      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        result.tagName = element.tagName.toLowerCase();

        // 收集属性
        const attributes: Record<string, string> = {};
        for (let i = 0; i < element.attributes.length; i++) {
          const attr = element.attributes[i];
          // 检查是否为敏感属性
          if (!this.isSensitiveAttribute(attr.name)) {
            attributes[attr.name] = attr.value;
          }
        }

        if (Object.keys(attributes).length > 0) {
          result.attributes = attributes;
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        let textContent = node.textContent || '';

        // 检查是否需要掩码文本内容
        if (this.options.maskTextContent) {
          textContent = this.maskValue(textContent);
        }

        result.textContent = textContent;
      }

      return result;
    } catch (err) {
      this.logger.error('序列化节点失败', err);
      return { nodeType: node.nodeType };
    }
  }

  /**
   * 检查元素是否应该被忽略
   */
  private shouldIgnoreElement(element: HTMLElement | Node | null): boolean {
    try {
      if (!element) return true;

      // 忽略非元素节点
      if (element.nodeType !== Node.ELEMENT_NODE) return false;

      const htmlElement = element as HTMLElement;
      const ignoredSelectors = this.options.ignoredElements || [];

      // 检查元素是否匹配忽略选择器
      for (const selector of ignoredSelectors) {
        try {
          if (htmlElement.matches && htmlElement.matches(selector)) {
            return true;
          }
        } catch (e) {
          // 忽略无效的选择器
        }
      }

      return false;
    } catch (err) {
      this.logger.error('检查元素是否应该被忽略时出错', err);
      return false;
    }
  }

  /**
   * 检查属性是否敏感
   */
  private isSensitiveAttribute(attributeName: string): boolean {
    try {
      const sensitiveAttributes = this.options.sensitiveAttributes || [];
      const lowerAttrName = attributeName.toLowerCase();

      // 检查属性名是否包含敏感关键词
      for (const sensitiveAttr of sensitiveAttributes) {
        if (lowerAttrName.includes(sensitiveAttr.toLowerCase())) {
          return true;
        }
      }

      return false;
    } catch (err) {
      this.logger.error('检查属性是否敏感时出错', err);
      return false;
    }
  }

  /**
   * 检查输入元素是否敏感
   */
  private isSensitiveInput(element: HTMLElement): boolean {
    try {
      const sensitiveInputs = this.options.sensitiveInputs || [];

      // 检查元素是否匹配敏感输入选择器
      for (const selector of sensitiveInputs) {
        try {
          if (element.matches && element.matches(selector)) {
            return true;
          }
        } catch (e) {
          // 忽略无效的选择器
        }
      }

      return false;
    } catch (err) {
      this.logger.error('检查输入元素是否敏感时出错', err);
      return false;
    }
  }

  /**
   * 掩码敏感值
   */
  private maskValue(value: string): string {
    if (!value) return value;

    // 如果值很短，直接用星号替换
    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }

    // 保留前两个和后两个字符，中间用星号替换
    const prefix = value.substring(0, 2);
    const suffix = value.substring(value.length - 2);
    const maskedLength = Math.min(value.length - 4, 5); // 最多显示5个星号

    return `${prefix}${'*'.repeat(maskedLength)}${suffix}`;
  }

  /**
   * 添加自定义事件
   */
  addCustomEvent(eventName: string, data: any): void {
    try {
      if (!this.isRecording) return;

      this.addEvent({
        type: ReplayEventType.CUSTOM,
        timestamp: Utils.now(),
        data: {
          name: eventName,
          ...data,
        },
      });
    } catch (err) {
      this.logger.error('添加自定义事件失败', err);
    }
  }
}
