/**
 * 可视化配置界面模块
 * 提供一个简单的可视化界面，方便开发者调整监控参数
 */
import Logger from './logger';
import { SDKOptions, SamplingStrategy, ReplayOptions } from '../types';

export default class ConfigUI {
  private logger: Logger;
  private container: HTMLElement | null = null;
  private isVisible: boolean = false;
  private options: SDKOptions;
  private onSave: (options: SDKOptions) => void;
  private toggleButton: HTMLElement | null = null;

  constructor(options: SDKOptions, onSave: (options: SDKOptions) => void) {
    this.logger = Logger.getInstance();
    this.options = { ...options };
    this.onSave = onSave;
  }

  /**
   * 初始化配置界面
   */
  init(): void {
    try {
      // 创建悬浮按钮
      this.createToggleButton();
    } catch (err) {
      this.logger.error('初始化配置界面失败', err);
    }
  }

  /**
   * 创建悬浮切换按钮
   */
  private createToggleButton(): void {
    try {
      // 检查是否已存在
      if (this.toggleButton) return;

      // 创建按钮
      this.toggleButton = document.createElement('div');
      this.toggleButton.id = 'edge-sentinel-config-toggle';
      this.toggleButton.innerHTML = 'ES';
      this.toggleButton.title = 'Edge Sentinel 配置';

      // 设置样式
      Object.assign(this.toggleButton.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        backgroundColor: '#4a6cf7',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        cursor: 'pointer',
        zIndex: '9999',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        transition: 'all 0.3s ease',
      });

      // 添加悬停效果
      this.toggleButton.addEventListener('mouseover', () => {
        if (this.toggleButton) {
          this.toggleButton.style.transform = 'scale(1.1)';
        }
      });

      this.toggleButton.addEventListener('mouseout', () => {
        if (this.toggleButton) {
          this.toggleButton.style.transform = 'scale(1)';
        }
      });

      // 添加点击事件
      this.toggleButton.addEventListener('click', () => {
        this.toggleConfigPanel();
      });

      // 添加到文档
      document.body.appendChild(this.toggleButton);
    } catch (err) {
      this.logger.error('创建配置切换按钮失败', err);
    }
  }

  /**
   * 切换配置面板显示状态
   */
  toggleConfigPanel(): void {
    if (this.isVisible) {
      this.hideConfigPanel();
    } else {
      this.showConfigPanel();
    }
  }

  /**
   * 显示配置面板
   */
  showConfigPanel(): void {
    try {
      if (this.isVisible) return;

      // 创建配置面板容器
      this.container = document.createElement('div');
      this.container.id = 'edge-sentinel-config-panel';

      // 设置样式
      Object.assign(this.container.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        maxWidth: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        zIndex: '10000',
        padding: '20px',
        fontFamily: 'Arial, sans-serif',
        color: '#333',
      });

      // 创建配置面板内容
      this.renderConfigPanel();

      // 添加到文档
      document.body.appendChild(this.container);
      this.isVisible = true;

      // 添加点击外部关闭功能
      document.addEventListener('click', this.handleOutsideClick);
    } catch (err) {
      this.logger.error('显示配置面板失败', err);
    }
  }

  /**
   * 隐藏配置面板
   */
  hideConfigPanel(): void {
    try {
      if (!this.isVisible || !this.container) return;

      // 移除面板
      document.body.removeChild(this.container);
      this.container = null;
      this.isVisible = false;

      // 移除点击外部关闭事件
      document.removeEventListener('click', this.handleOutsideClick);
    } catch (err) {
      this.logger.error('隐藏配置面板失败', err);
    }
  }

  /**
   * 处理点击外部事件
   */
  private handleOutsideClick = (e: MouseEvent): void => {
    if (
      this.container &&
      !this.container.contains(e.target as Node) &&
      this.toggleButton &&
      !this.toggleButton.contains(e.target as Node)
    ) {
      this.hideConfigPanel();
    }
  };

  /**
   * 渲染配置面板内容
   */
  private renderConfigPanel(): void {
    if (!this.container) return;

    // 标题
    const title = document.createElement('h2');
    title.textContent = 'Edge Sentinel 配置';
    title.style.marginBottom = '20px';
    title.style.borderBottom = '1px solid #eee';
    title.style.paddingBottom = '10px';
    this.container.appendChild(title);

    // 创建表单
    const form = document.createElement('form');
    form.style.display = 'grid';
    form.style.gridTemplateColumns = '1fr 1fr';
    form.style.gap = '15px';
    this.container.appendChild(form);

    // 基础配置
    this.addSectionTitle(form, '基础配置', 2);

    // 日志级别
    this.addSelect(
      form,
      'logLevel',
      '日志级别',
      {
        ERROR: '错误',
        WARN: '警告',
        INFO: '信息',
        DEBUG: '调试',
      },
      this.options.logLevel || 'WARN',
    );

    // 调试模式
    this.addCheckbox(form, 'debugMode', '启用调试模式', this.options.debugMode || false);

    // 操作链路记录
    this.addSectionTitle(form, '操作链路记录', 2);
    this.addCheckbox(
      form,
      'enableOperationTracking',
      '启用操作链路记录',
      this.options.enableOperationTracking || false,
    );
    this.addInput(
      form,
      'operationInactivityThreshold',
      '无操作超时时间(毫秒)',
      this.options.operationInactivityThreshold || 60000,
      'number',
    );
    this.addInput(
      form,
      'operationMaxDuration',
      '最大操作时长(毫秒)',
      this.options.operationMaxDuration || 300000,
      'number',
    );

    // 数据压缩配置
    this.addSectionTitle(form, '数据压缩', 2);
    this.addCheckbox(form, 'enableCompression', '启用数据压缩', this.options.enableCompression || false);

    // 上报策略配置
    this.addSectionTitle(form, '上报策略', 2);
    this.addSelect(
      form,
      'reportStrategy',
      '上报策略',
      {
        immediate: '立即上报',
        batch: '批量上报',
        periodic: '定时上报',
      },
      this.options.reportStrategy || 'immediate',
    );
    this.addInput(form, 'batchSize', '批量上报数量阈值', this.options.batchSize || 10, 'number');
    this.addInput(form, 'reportInterval', '定时上报间隔(毫秒)', this.options.reportInterval || 5000, 'number');
    this.addCheckbox(form, 'enableOfflineCache', '启用离线缓存', this.options.enableOfflineCache || false);
    this.addInput(form, 'maxCacheSize', '最大缓存数量', this.options.maxCacheSize || 100, 'number');
    this.addInput(form, 'maxCacheAge', '缓存最大保留时间(毫秒)', this.options.maxCacheAge || 86400000, 'number');

    // 数据采样配置
    this.addSectionTitle(form, '数据采样', 2);
    this.addCheckbox(form, 'enableSampling', '启用数据采样', this.options.enableSampling || false);
    this.addInput(form, 'defaultSamplingRate', '默认采样率(0-1)', this.options.defaultSamplingRate || 1.0, 'number', {
      min: 0,
      max: 1,
      step: 0.01,
    });

    // 用户行为回放配置
    this.addSectionTitle(form, '用户行为回放', 2);
    this.addCheckbox(form, 'enableReplay', '启用用户行为回放', this.options.enableReplay || false);

    if (this.options.enableReplay) {
      const replayOptions = this.options.replayOptions || {};
      this.addCheckbox(
        form,
        'replayOptions.captureMouseMove',
        '记录鼠标移动',
        replayOptions.captureMouseMove !== false,
      );
      this.addCheckbox(
        form,
        'replayOptions.captureDomMutations',
        '记录DOM变化',
        replayOptions.captureDomMutations !== false,
      );
      this.addCheckbox(form, 'replayOptions.captureInputs', '记录输入事件', replayOptions.captureInputs !== false);
      this.addCheckbox(form, 'replayOptions.maskInputValues', '掩码输入值', replayOptions.maskInputValues !== false);
      this.addInput(
        form,
        'replayOptions.samplingRate',
        '回放采样率(0-1)',
        replayOptions.samplingRate || 1.0,
        'number',
        { min: 0, max: 1, step: 0.01 },
      );
    }

    // 数据脱敏配置
    this.addSectionTitle(form, '数据脱敏', 2);
    this.addTextarea(form, 'sensitiveFields', '敏感字段列表(逗号分隔)', (this.options.sensitiveFields || []).join(','));

    // 按钮区域
    const buttonContainer = document.createElement('div');
    buttonContainer.style.gridColumn = '1 / span 2';
    buttonContainer.style.marginTop = '20px';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '10px';
    form.appendChild(buttonContainer);

    // 取消按钮
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '取消';
    cancelButton.type = 'button';
    this.styleButton(cancelButton, false);
    cancelButton.addEventListener('click', () => this.hideConfigPanel());
    buttonContainer.appendChild(cancelButton);

    // 保存按钮
    const saveButton = document.createElement('button');
    saveButton.textContent = '保存';
    saveButton.type = 'button';
    this.styleButton(saveButton, true);
    saveButton.addEventListener('click', () => this.saveConfig(form));
    buttonContainer.appendChild(saveButton);
  }

  /**
   * 添加分节标题
   */
  private addSectionTitle(parent: HTMLElement, title: string, span: number = 1): void {
    const titleElement = document.createElement('h3');
    titleElement.textContent = title;
    titleElement.style.gridColumn = `1 / span ${span}`;
    titleElement.style.marginTop = '15px';
    titleElement.style.marginBottom = '5px';
    titleElement.style.borderBottom = '1px solid #eee';
    titleElement.style.paddingBottom = '5px';
    parent.appendChild(titleElement);
  }

  /**
   * 添加输入框
   */
  private addInput(
    parent: HTMLElement,
    name: string,
    label: string,
    value: any,
    type: string = 'text',
    attrs: Record<string, any> = {},
  ): void {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    parent.appendChild(container);

    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.style.marginBottom = '5px';
    labelElement.style.fontSize = '14px';
    container.appendChild(labelElement);

    const input = document.createElement('input');
    input.type = type;
    input.name = name;
    input.value = value;
    input.style.padding = '8px';
    input.style.borderRadius = '4px';
    input.style.border = '1px solid #ddd';

    // 添加额外属性
    for (const [key, val] of Object.entries(attrs)) {
      input.setAttribute(key, val);
    }

    container.appendChild(input);
  }

  /**
   * 添加复选框
   */
  private addCheckbox(parent: HTMLElement, name: string, label: string, checked: boolean): void {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    parent.appendChild(container);

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = name;
    input.checked = checked;
    input.style.marginRight = '8px';
    container.appendChild(input);

    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.style.fontSize = '14px';
    container.appendChild(labelElement);
  }

  /**
   * 添加下拉选择框
   */
  private addSelect(
    parent: HTMLElement,
    name: string,
    label: string,
    options: Record<string, string>,
    value: string,
  ): void {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    parent.appendChild(container);

    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.style.marginBottom = '5px';
    labelElement.style.fontSize = '14px';
    container.appendChild(labelElement);

    const select = document.createElement('select');
    select.name = name;
    select.style.padding = '8px';
    select.style.borderRadius = '4px';
    select.style.border = '1px solid #ddd';

    for (const [optionValue, optionLabel] of Object.entries(options)) {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionLabel;
      option.selected = optionValue === value;
      select.appendChild(option);
    }

    container.appendChild(select);
  }

  /**
   * 添加文本区域
   */
  private addTextarea(parent: HTMLElement, name: string, label: string, value: string): void {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gridColumn = '1 / span 2';
    parent.appendChild(container);

    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.style.marginBottom = '5px';
    labelElement.style.fontSize = '14px';
    container.appendChild(labelElement);

    const textarea = document.createElement('textarea');
    textarea.name = name;
    textarea.value = value;
    textarea.style.padding = '8px';
    textarea.style.borderRadius = '4px';
    textarea.style.border = '1px solid #ddd';
    textarea.style.minHeight = '80px';
    textarea.style.resize = 'vertical';
    container.appendChild(textarea);
  }

  /**
   * 设置按钮样式
   */
  private styleButton(button: HTMLButtonElement, isPrimary: boolean): void {
    Object.assign(button.style, {
      padding: '8px 16px',
      borderRadius: '4px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: 'bold',
      backgroundColor: isPrimary ? '#4a6cf7' : '#f5f5f5',
      color: isPrimary ? 'white' : '#333',
    });

    // 添加悬停效果
    button.addEventListener('mouseover', () => {
      button.style.backgroundColor = isPrimary ? '#3a5ce7' : '#e5e5e5';
    });

    button.addEventListener('mouseout', () => {
      button.style.backgroundColor = isPrimary ? '#4a6cf7' : '#f5f5f5';
    });
  }

  /**
   * 保存配置
   */
  private saveConfig(form: HTMLFormElement): void {
    try {
      const newOptions: SDKOptions = { ...this.options };
      const formData = new FormData(form);

      // 处理基础配置
      newOptions.logLevel = (formData.get('logLevel') as any) || 'WARN';
      newOptions.debugMode = formData.get('debugMode') === 'on';

      // 处理操作链路配置
      newOptions.enableOperationTracking = formData.get('enableOperationTracking') === 'on';
      newOptions.operationInactivityThreshold = Number(formData.get('operationInactivityThreshold')) || 60000;
      newOptions.operationMaxDuration = Number(formData.get('operationMaxDuration')) || 300000;

      // 处理数据压缩配置
      newOptions.enableCompression = formData.get('enableCompression') === 'on';

      // 处理上报策略配置
      newOptions.reportStrategy = (formData.get('reportStrategy') as any) || 'immediate';
      newOptions.batchSize = Number(formData.get('batchSize')) || 10;
      newOptions.reportInterval = Number(formData.get('reportInterval')) || 5000;
      newOptions.enableOfflineCache = formData.get('enableOfflineCache') === 'on';
      newOptions.maxCacheSize = Number(formData.get('maxCacheSize')) || 100;
      newOptions.maxCacheAge = Number(formData.get('maxCacheAge')) || 86400000;

      // 处理数据采样配置
      newOptions.enableSampling = formData.get('enableSampling') === 'on';
      newOptions.defaultSamplingRate = Number(formData.get('defaultSamplingRate')) || 1.0;

      // 处理用户行为回放配置
      newOptions.enableReplay = formData.get('enableReplay') === 'on';
      if (newOptions.enableReplay) {
        newOptions.replayOptions = newOptions.replayOptions || {};
        newOptions.replayOptions.captureMouseMove = formData.get('replayOptions.captureMouseMove') === 'on';
        newOptions.replayOptions.captureDomMutations = formData.get('replayOptions.captureDomMutations') === 'on';
        newOptions.replayOptions.captureInputs = formData.get('replayOptions.captureInputs') === 'on';
        newOptions.replayOptions.maskInputValues = formData.get('replayOptions.maskInputValues') === 'on';
        newOptions.replayOptions.samplingRate = Number(formData.get('replayOptions.samplingRate')) || 1.0;
      }

      // 处理数据脱敏配置
      const sensitiveFieldsStr = (formData.get('sensitiveFields') as string) || '';
      newOptions.sensitiveFields = sensitiveFieldsStr
        .split(',')
        .map((field) => field.trim())
        .filter(Boolean);

      // 调用保存回调
      this.onSave(newOptions);

      // 更新当前选项
      this.options = newOptions;

      // 隐藏面板
      this.hideConfigPanel();

      // 显示保存成功提示
      this.showToast('配置已保存');
    } catch (err) {
      this.logger.error('保存配置失败', err);
      this.showToast('保存配置失败', true);
    }
  }

  /**
   * 显示提示消息
   */
  private showToast(message: string, isError: boolean = false): void {
    try {
      const toast = document.createElement('div');

      // 设置样式
      Object.assign(toast.style, {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: isError ? '#f44336' : '#4CAF50',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '4px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        zIndex: '10001',
        opacity: '0',
        transition: 'opacity 0.3s ease',
      });

      toast.textContent = message;
      document.body.appendChild(toast);

      // 显示提示
      setTimeout(() => {
        toast.style.opacity = '1';
      }, 10);

      // 自动隐藏
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
          if (toast.parentNode) {
            document.body.removeChild(toast);
          }
        }, 300);
      }, 3000);
    } catch (err) {
      this.logger.error('显示提示消息失败', err);
    }
  }

  /**
   * 销毁配置界面
   */
  destroy(): void {
    try {
      // 隐藏配置面板
      this.hideConfigPanel();

      // 移除悬浮按钮
      if (this.toggleButton && this.toggleButton.parentNode) {
        this.toggleButton.parentNode.removeChild(this.toggleButton);
        this.toggleButton = null;
      }
    } catch (err) {
      this.logger.error('销毁配置界面失败', err);
    }
  }
}
