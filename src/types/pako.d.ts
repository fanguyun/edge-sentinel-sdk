/**
 * pako模块的类型声明文件
 */
declare module 'pako' {
  /**
   * 压缩选项接口
   */
  export interface DeflateOptions {
    /**
     * 压缩级别 (0-9):
     * 0 - 不压缩
     * 1 - 最快速度
     * 6 - 默认值，平衡速度和压缩率
     * 9 - 最佳压缩率
     */
    level?: number;

    /**
     * 窗口大小的对数值 (8-15)，默认为15
     * 较大的值会提高压缩率但使用更多内存
     */
    windowBits?: number;

    /**
     * 内部状态使用的内存量 (1-9)，默认为8
     * 较大的值会提高速度但使用更多内存
     */
    memLevel?: number;

    /**
     * 压缩策略
     */
    strategy?: number;

    /**
     * 预设字典
     */
    dictionary?: Uint8Array | Array<number>;

    /**
     * 是否生成原始数据
     */
    raw?: boolean;

    /**
     * 输出格式
     */
    to?: 'string' | 'array';
  }

  /**
   * 解压选项接口
   */
  export interface InflateOptions {
    windowBits?: number;
    dictionary?: Uint8Array | Array<number>;
    raw?: boolean;
    to?: 'string' | 'array';
  }

  /**
   * 压缩数据
   * @param data 要压缩的数据
   * @param options 压缩选项
   * @returns 压缩后的数据
   */
  export function deflate(data: Uint8Array | string | Array<number>, options?: DeflateOptions): Uint8Array;
  export function deflateRaw(data: Uint8Array | string | Array<number>, options?: DeflateOptions): Uint8Array;
  export function gzip(data: Uint8Array | string | Array<number>, options?: DeflateOptions): Uint8Array;

  /**
   * 解压数据
   * @param data 要解压的数据
   * @param options 解压选项
   * @returns 解压后的数据
   */
  export function inflate(data: Uint8Array | Array<number>, options?: InflateOptions): Uint8Array;
  export function inflateRaw(data: Uint8Array | Array<number>, options?: InflateOptions): Uint8Array;
  export function ungzip(data: Uint8Array | Array<number>, options?: InflateOptions): Uint8Array;
}
