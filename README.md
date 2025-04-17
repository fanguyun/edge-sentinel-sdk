# Edge Sentinel SDK

前端监控与埋点 SDK，支持功能模块扩展。

## 功能特性

- 基础信息收集：自动收集用户设备、浏览器等基础信息
- 错误监控：捕获并上报 JavaScript 错误、Promise 异常和资源加载错误
- 性能监控：监控 API 请求、页面停留时间和访问深度
- 自定义事件：支持手动上报自定义事件和数据
- 操作链路记录：记录用户完整操作链路，支持操作步骤跟踪
- 模块化设计：各功能模块独立，便于扩展和维护

## 安装

```bash
npm install edge-sentinel-sdk
# 或
yarn add edge-sentinel-sdk
```

## 使用方法

### 基本用法

```javascript
import EdgeSentinelSDK from 'edge-sentinel-sdk';

// 初始化SDK
const sentinel = new EdgeSentinelSDK({
  appId: 'your-app-id',
  reportUrl: 'https://your-report-api.com/collect',
  userKey: 'user-unique-id',
  enableOperationTracking: true // 启用操作链路记录功能
});

// 手动上报自定义事件
sentinel.trackEvent('button_click', {
  buttonId: 'submit-btn',
  page: 'checkout'
});

// 记录用户操作链路示例
// 1. 开始一个操作
const operationId = sentinel.startOperation('checkout_process', {
  cartId: '12345',
  totalAmount: 99.99
});

// 2. 添加操作步骤
sentinel.addOperationStep(operationId, 'input_address', {
  addressType: 'shipping'
});

// 3. 添加更多步骤
sentinel.addOperationStep(operationId, 'select_payment', {
  method: 'credit_card'
});

// 4. 完成操作
sentinel.completeOperation(operationId, {
  orderId: 'ORD-123456',
  status: 'success'
}, true);

// 如果操作被取消
// sentinel.cancelOperation(operationId, '用户主动取消');
```

### 通过 CDN 使用

```html
<script src="https://cdn.example.com/edge-sentinel-sdk.min.js"></script>
<script>
  const sentinel = new EdgeSentinelSDK({
    appId: 'your-app-id',
    reportUrl: 'https://your-report-api.com/collect',
    userKey: 'user-unique-id'
  });
</script>
```

## API 文档

### 构造函数

```javascript
new EdgeSentinelSDK(options);
```

#### 参数

- `options.appId` (必填): 应用 ID
- `options.reportUrl` (必填): 数据上报接口地址
- `options.userKey` (必填): 用户唯一标识
- `options.enableOperationTracking` (可选): 是否启用操作链路记录功能，默认为 false

### 方法

#### trackEvent(eventName, eventData)

手动上报自定义事件

- `eventName`: 事件名称
- `eventData`: 事件相关数据，可选

#### getBaseInfo()

获取 SDK 收集的基础信息

#### startOperation(operationName, metadata)

开始记录一个操作链路

- `operationName`: 操作名称
- `metadata`: 操作相关元数据，可选
- 返回值: 操作ID，用于后续操作步骤的关联

#### addOperationStep(operationId, stepName, stepData)

添加操作步骤

- `operationId`: 操作ID，由 startOperation 返回
- `stepName`: 步骤名称
- `stepData`: 步骤相关数据，可选
- 返回值: 是否添加成功

#### completeOperation(operationId, resultData, isSuccess)

完成操作

- `operationId`: 操作ID，由 startOperation 返回
- `resultData`: 操作结果数据，可选
- `isSuccess`: 操作是否成功，默认为 true
- 返回值: 是否完成成功

#### cancelOperation(operationId, reason)

取消操作

- `operationId`: 操作ID，由 startOperation 返回
- `reason`: 取消原因，可选
- 返回值: 是否取消成功

#### getOperationStatus(operationId)

获取操作状态

- `operationId`: 操作ID，由 startOperation 返回
- 返回值: 操作状态，可能为 'started', 'in_progress', 'completed', 'failed', 'cancelled', 'interrupted'

## 自动收集的数据

- JavaScript 错误
- Promise 异常
- 资源加载错误
- API 请求信息
- 页面访问信息(PV)
- 页面停留时间
- 页面访问深度
- 用户操作链路（需启用）

## 上报数据示例

SDK 上报的数据结构如下所示：

```json
{
  "type": "event", // 上报类型，如 event（自定义事件）、error（错误）、performance（性能）、operation（操作链路）等
  "name": "button_click", // 事件名称或错误/操作名称
  "data": { // 事件或错误、性能、操作的详细数据
    "buttonId": "submit-btn",
    "page": "checkout"
  },
  "timestamp": 1718000000000, // 上报时间戳（毫秒）
  "appId": "your-app-id", // 应用ID
  "userKey": "user-unique-id", // 用户唯一标识
  "sessionId": "abcdef1234567890", // 会话ID，每次会话唯一
  "baseInfo": { // 设备和环境基础信息
    "userAgent": "Mozilla/5.0 ...",
    "platform": "MacIntel",
    "language": "zh-CN",
    "screen": "1440x900",
    "referrer": "https://example.com/"
  }
}
```

字段说明：
- `type`：上报数据类型，区分不同监控内容（如 event、error、performance、operation）。
- `name`：事件、错误或操作的名称。
- `data`：与本次上报相关的详细数据，结构因 type 不同而异。
- `timestamp`：上报数据生成的时间戳（毫秒）。
- `appId`：SDK 初始化时配置的应用唯一标识。
- `userKey`：用户唯一标识。
- `sessionId`：会话唯一标识，自动生成，用于区分用户会话。
- `baseInfo`：设备、浏览器等基础环境信息。

## 许可证

MIT
