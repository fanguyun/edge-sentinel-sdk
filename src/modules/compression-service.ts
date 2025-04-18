/**
 * 数据压缩服务模块
 * 提供数据压缩和解压功能，支持压缩级别配置和自动识别压缩数据
 */
import pako from 'pako';
import Logger from './logger';

// 压缩数据标识前缀，用于标识数据是否已被压缩
const COMPRESSION_PREFIX = 'EDGECOMPR:';

/**
 * 压缩级别枚举
 */
export enum CompressionLevel {
  NONE = 0, // 不压缩
  FAST = 1, // 快速压缩，压缩率低
  BALANCED = 6, // 平衡压缩率和性能
  BEST = 9, // 最佳压缩率，性能较低
}

/**
 * 压缩配置接口
 */
export interface CompressionOptions {
  level?: CompressionLevel; // 压缩级别
  addPrefix?: boolean; // 是否添加压缩标识前缀
}

export default class CompressionService {
  private logger: Logger;
  private defaultOptions: CompressionOptions = {
    level: CompressionLevel.BALANCED,
    addPrefix: true,
  };

  constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * 压缩数据
   * @param data 要压缩的数据字符串
   * @param options 压缩选项
   * @returns 压缩后的Base64编码字符串，失败则返回原始数据
   */
  compress(data: string, options?: Partial<CompressionOptions>): string {
    // 如果数据为空，直接返回
    if (!data || data.length === 0) {
      return data;
    }

    // 合并选项
    const mergedOptions: CompressionOptions = {
      ...this.defaultOptions,
      ...options,
    };

    try {
      // 检查数据是否已经被压缩
      if (this.isCompressed(data)) {
        return data; // 已压缩，直接返回
      }

      // 将字符串转换为Uint8Array
      const uint8Array = new TextEncoder().encode(data);

      // 使用pako进行压缩，应用压缩级别
      const compressed = pako.deflate(uint8Array, {
        level: mergedOptions.level,
      });

      // 将压缩后的数据转换为Base64编码
      let result = this.uint8ArrayToBase64(compressed);

      // 添加压缩标识前缀
      if (mergedOptions.addPrefix) {
        result = COMPRESSION_PREFIX + result;
      }

      return result;
    } catch (err: unknown) {
      this.logger.error('数据压缩失败', err);
      // 压缩失败时返回原始数据
      return data;
    }
  }

  /**
   * 解压数据
   * @param data 要解压的Base64编码字符串
   * @returns 解压后的字符串，失败则返回原始数据
   */
  decompress(data: string): string {
    // 如果数据为空，直接返回
    if (!data || data.length === 0) {
      return data;
    }

    try {
      // 检查数据是否被压缩
      if (!this.isCompressed(data)) {
        return data; // 未压缩，直接返回
      }

      // 移除压缩标识前缀
      let processedData = data;
      if (data.startsWith(COMPRESSION_PREFIX)) {
        processedData = data.substring(COMPRESSION_PREFIX.length);
      }

      // 检查是否为Base64编码的压缩数据
      if (!this.isBase64(processedData)) {
        return data;
      }

      // 将Base64编码转换为Uint8Array
      const uint8Array = this.base64ToUint8Array(processedData);

      // 使用pako进行解压
      const decompressed = pako.inflate(uint8Array);

      // 将解压后的数据转换为字符串
      return new TextDecoder().decode(decompressed);
    } catch (err: unknown) {
      this.logger.error('数据解压失败', err);
      // 解压失败时返回原始数据
      return data;
    }
  }

  /**
   * 将Uint8Array转换为Base64编码
   * @param uint8Array Uint8Array数据
   * @returns Base64编码字符串
   */
  private uint8ArrayToBase64(uint8Array: Uint8Array): string {
    try {
      let binary = '';
      const len = uint8Array.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      return btoa(binary);
    } catch (err: unknown) {
      this.logger.error('Uint8Array转Base64失败', err);
      throw err;
    }
  }

  /**
   * 将Base64编码转换为Uint8Array
   * @param base64 Base64编码字符串
   * @returns Uint8Array数据
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    try {
      const binary = atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } catch (err: unknown) {
      this.logger.error('Base64转Uint8Array失败', err);
      throw err;
    }
  }

  /**
   * 检查字符串是否为Base64编码
   * @param str 要检查的字符串
   * @returns 是否为Base64编码
   */
  private isBase64(str: string): boolean {
    try {
      return btoa(atob(str)) === str;
    } catch (err: unknown) {
      return false;
    }
  }

  /**
   * 检查数据是否已被压缩
   * @param data 要检查的数据
   * @returns 是否已被压缩
   */
  private isCompressed(data: string): boolean {
    // 检查是否有压缩标识前缀
    if (data.startsWith(COMPRESSION_PREFIX)) {
      return true;
    }

    // 尝试解压，如果成功则说明是压缩数据
    try {
      if (this.isBase64(data)) {
        const uint8Array = this.base64ToUint8Array(data);
        pako.inflate(uint8Array);
        return true;
      }
    } catch (err: unknown) {
      // 解压失败，说明不是压缩数据
    }

    return false;
  }

  /**
   * 设置默认压缩选项
   * @param options 压缩选项
   */
  setDefaultOptions(options: Partial<CompressionOptions>): void {
    this.defaultOptions = {
      ...this.defaultOptions,
      ...options,
    };
  }
}
