/**
 * 存储服务模块
 * 提供本地缓存和批量上报功能
 */
import { openDB, IDBPDatabase } from 'idb';
import Logger from './logger';
import Utils from './utils';
import { ReportData } from '../types';

interface CachedItem {
  id?: number;
  data: ReportData;
  timestamp: number;
  retryCount: number;
}

export default class StorageService {
  private db: IDBPDatabase | null = null;
  private dbName = 'edge-sentinel-cache';
  private storeName = 'report-data';
  private logger: Logger;
  private maxRetryCount = 3;
  private isInitialized = false;

  constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * 初始化存储服务
   */
  async init(): Promise<boolean> {
    try {
      if (this.isInitialized) return true;

      this.db = await openDB(this.dbName, 1, {
        upgrade(db) {
          // 创建存储对象
          if (!db.objectStoreNames.contains('report-data')) {
            const store = db.createObjectStore('report-data', {
              keyPath: 'id',
              autoIncrement: true,
            });
            // 创建索引
            store.createIndex('timestamp', 'timestamp');
          }
        },
      });

      this.isInitialized = true;
      this.logger.info('存储服务初始化成功');
      return true;
    } catch (err) {
      this.logger.error('存储服务初始化失败', err);
      return false;
    }
  }

  /**
   * 保存数据到本地缓存
   * @param data 要缓存的数据
   */
  async saveData(data: ReportData): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.db) {
        await this.init();
      }

      if (!this.db) {
        throw new Error('数据库未初始化');
      }

      const item: CachedItem = {
        data,
        timestamp: Utils.now(),
        retryCount: 0,
      };

      await this.db.add(this.storeName, item);
      return true;
    } catch (err) {
      this.logger.error('保存数据到本地缓存失败', err);
      return false;
    }
  }

  /**
   * 获取待上报的数据
   * @param limit 获取数据的最大数量
   */
  async getBatchData(limit: number = 10): Promise<CachedItem[]> {
    try {
      if (!this.isInitialized || !this.db) {
        await this.init();
      }

      if (!this.db) {
        throw new Error('数据库未初始化');
      }

      // 按时间戳排序获取数据
      const tx = this.db.transaction(this.storeName, 'readonly');
      const index = tx.store.index('timestamp');
      const items = await index.getAll(null, limit);
      return items;
    } catch (err) {
      this.logger.error('获取批量数据失败', err);
      return [];
    }
  }

  /**
   * 删除已上报的数据
   * @param ids 要删除的数据ID列表
   */
  async removeData(ids: number[]): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.db) {
        await this.init();
      }

      if (!this.db) {
        throw new Error('数据库未初始化');
      }

      const tx = this.db.transaction(this.storeName, 'readwrite');
      for (const id of ids) {
        await tx.store.delete(id);
      }
      await tx.done;
      return true;
    } catch (err) {
      this.logger.error('删除缓存数据失败', err);
      return false;
    }
  }

  /**
   * 更新重试次数
   * @param id 数据ID
   */
  async updateRetryCount(id: number): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.db) {
        await this.init();
      }

      if (!this.db) {
        throw new Error('数据库未初始化');
      }

      const tx = this.db.transaction(this.storeName, 'readwrite');
      const item = await tx.store.get(id);
      if (item) {
        item.retryCount += 1;
        await tx.store.put(item);
      }
      await tx.done;
      return true;
    } catch (err) {
      this.logger.error('更新重试次数失败', err);
      return false;
    }
  }

  /**
   * 清除过期数据
   * @param maxAge 最大保留时间（毫秒）
   */
  async clearExpiredData(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.db) {
        await this.init();
      }

      if (!this.db) {
        throw new Error('数据库未初始化');
      }

      const now = Utils.now();
      const expireTime = now - maxAge;

      const tx = this.db.transaction(this.storeName, 'readwrite');
      const index = tx.store.index('timestamp');
      let cursor = await index.openCursor(IDBKeyRange.upperBound(expireTime));

      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }

      await tx.done;
      return true;
    } catch (err) {
      this.logger.error('清除过期数据失败', err);
      return false;
    }
  }

  /**
   * 获取缓存数据数量
   */
  async getCount(): Promise<number> {
    try {
      if (!this.isInitialized || !this.db) {
        await this.init();
      }

      if (!this.db) {
        throw new Error('数据库未初始化');
      }

      return await this.db.count(this.storeName);
    } catch (err) {
      this.logger.error('获取缓存数据数量失败', err);
      return 0;
    }
  }
}
