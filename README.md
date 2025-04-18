# Edge Sentinel SDK

[![npm version](https://badge.fury.io/js/edge-sentinel-sdk.svg)](https://badge.fury.io/js/edge-sentinel-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 简介

Edge Sentinel SDK 是一个功能强大的前端监控与埋点 SDK，提供全面的性能监控、错误跟踪和用户行为分析能力。通过模块化设计，支持灵活的功能扩展和配置。

## 功能特性

- **基础信息收集**：自动采集用户设备、浏览器等环境信息
- **错误监控**：捕获并上报 JavaScript 错误、Promise 异常和资源加载错误
- **性能监控**：监控页面性能指标、API 请求和资源加载性能
- **操作链路记录**：自动记录用户行为轨迹，支持自定义操作步骤跟踪
- **数据采样**：支持灵活的数据采样策略，优化上报流量
- **离线缓存**：支持离线数据存储，网络恢复后自动重传
- **数据压缩**：支持数据压缩传输，减少网络带宽占用
- **用户行为回放**：支持记录用户行为并进行回放分析（可选功能）

## 安装

### NPM

```bash
npm install edge-sentinel-sdk
```

### CDN

```html
<script src="https://cdn.example.com/edge-sentinel-sdk.min.js"></script>
```

## 快速开始

### 基础配置

```javascript
import EdgeSentinelSDK from 'edge-sentinel-sdk';

const sentinel = new EdgeSentinelSDK({
  appId: 'your-app-id', // 应用标识
  reportUrl: 'your-report-url', // 数据上报地址
  userKey: 'user-unique-id', // 用户唯一标识
  enableOperationTracking: true, // 启用操作链路记录
  enableCompression: true, // 启用数据压缩
  enableOfflineCache: true, // 启用离线缓存
  reportStrategy: 'batch', // 上报策略：immediate/batch/periodic
  batchSize: 10, // 批量上报数量阈值
  reportInterval: 5000, // 定时上报间隔（毫秒）
  debugMode: false, // 调试模式
});
```

### 自定义事件上报

```javascript
// 上报自定义事件
sentinel.trackEvent('button_click', {
  buttonId: 'submit-btn',
  page: 'checkout',
  timestamp: Date.now(),
});
```

### 操作链路记录

```javascript
// 自动记录模式下无需手动调用API
// SDK会自动记录用户交互行为

// 手动记录模式
const operationId = sentinel.startOperation('checkout_process', {
  cartId: '12345',
  totalAmount: 99.99,
});

sentinel.addOperationStep(operationId, 'input_address', {
  addressType: 'shipping',
});

sentinel.addOperationStep(operationId, 'select_payment', {
  method: 'credit_card',
});

sentinel.completeOperation(operationId, {
  orderId: 'ORD-123456',
  status: 'success',
});
```

## 数据上报示例

### 错误监控数据

```json
{
  "type": "error",
  "subType": "js_error",
  "message": "Uncaught TypeError: Cannot read property 'data' of undefined",
  "stack": "TypeError: Cannot read property 'data' of undefined\n    at processData (app.js:123)\n    at handleClick (app.js:45)",
  "timestamp": 1678234567890,
  "url": "https://example.com/page",
  "userAgent": "Mozilla/5.0 ..."
}
```

### 性能监控数据

```json
{
  "type": "performance",
  "metrics": {
    "fcp": 1200,
    "lcp": 2500,
    "fid": 100,
    "cls": 0.1,
    "ttfb": 500
  },
  "navigationTiming": {
    "dnsLookup": 100,
    "tcpConnect": 150,
    "sslNegotiation": 200,
    "domInteractive": 1000,
    "domComplete": 1500
  },
  "timestamp": 1678234567890
}
```

### 操作链路数据

```json
{
  "type": "operation",
  "operationId": "op_1234567890",
  "name": "checkout_process",
  "status": "completed",
  "startTime": 1678234567890,
  "endTime": 1678234569890,
  "duration": 2000,
  "steps": [
    {
      "name": "input_address",
      "timestamp": 1678234568000,
      "data": {
        "addressType": "shipping"
      }
    },
    {
      "name": "select_payment",
      "timestamp": 1678234569000,
      "data": {
        "method": "credit_card"
      }
    }
  ],
  "result": {
    "orderId": "ORD-123456",
    "status": "success"
  }
}
```

## API 文档

### 核心方法

- `trackEvent(eventName: string, eventData: object)`: 上报自定义事件
- `setLogLevel(level: LogLevel)`: 设置日志级别
- `getLogs()`: 获取 SDK 日志

### 操作链路 API

- `startOperation(name: string, data?: object)`: 开始一个操作
- `addOperationStep(operationId: string, stepName: string, data?: object)`: 添加操作步骤
- `completeOperation(operationId: string, result?: object)`: 完成操作
- `cancelOperation(operationId: string, reason?: string)`: 取消操作

## 配置选项

| 参数名                  | 类型    | 必填 | 默认值      | 说明                               |
| ----------------------- | ------- | ---- | ----------- | ---------------------------------- |
| appId                   | string  | 是   | -           | 应用标识                           |
| reportUrl               | string  | 是   | -           | 数据上报地址                       |
| userKey                 | string  | 是   | -           | 用户唯一标识                       |
| enableOperationTracking | boolean | 否   | false       | 是否启用操作链路记录               |
| enableCompression       | boolean | 否   | false       | 是否启用数据压缩                   |
| enableOfflineCache      | boolean | 否   | false       | 是否启用离线缓存                   |
| reportStrategy          | string  | 否   | 'immediate' | 上报策略：immediate/batch/periodic |
| batchSize               | number  | 否   | 10          | 批量上报数量阈值                   |
| reportInterval          | number  | 否   | 5000        | 定时上报间隔（毫秒）               |
| debugMode               | boolean | 否   | false       | 是否启用调试模式                   |

## 浏览器支持

- Chrome >= 55
- Firefox >= 52
- Safari >= 11
- Edge >= 79

## 许可证

[MIT](LICENSE)
