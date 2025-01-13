# 扩展 eliza : 构建你的第一个 Plugin

## 1.1 简介 plugin

每一个 `eliza` 的插件都是一个 `npm` 包，插件的入口模块是 `index.ts`。
插件的入口模块需要导出 一个 `Plugin` 对象,plugin 扩展结构:

```ts
/**
 * Plugin for extending agent functionality
 */
export type Plugin = {
    /** Plugin name */
    name: string;

    /** Plugin description */
    description: string;

    /** Optional actions */
    actions?: Action[];

    /** Optional providers */
    providers?: Provider[];

    /** Optional evaluators */
    evaluators?: Evaluator[];

    /** Optional services */
    services?: Service[];

    /** Optional clients */
    clients?: Client[];
};
```

- actions 为插件的核心部分，定义了插件的执行逻辑
- services 类比操作系统中的服务程序，属于常驻模块
- providers 提供基础的GET 方法，用于对外输出数据
- evaluators 评估器，agent 根据评估器中定义的规则，触发 agent 本身的行为，比如：存储更新

### Action 基本结构

```ts
export interface Action {
    /** Similar action descriptions */
    similes: string[];

    /** Detailed description */
    description: string;

    /** Example usages */
    examples: ActionExample[][];

    /** Handler function */
    handler: Handler;

    /** Action name */
    name: string;

    /** Validation function */
    validate: Validator;

    /** Whether to suppress the initial message when this action is used */
    suppressInitialMessage?: boolean;
}
```

- examples  （必选）为 Chat 的一些实例， Agent 将交互Example 传递给 LLM, 用于评估执行接下来的Action。
- validate 验证方法，Agent 会根据 `validate` 的结果决定，这个Action 是否可以执行。
- handler 执行的方法，内部可以完成动作的相关逻辑。


### Service 基本结构

```ts
export abstract class Service {
    private static instance: Service | null = null;

    static get serviceType(): ServiceType {
        throw new Error("Service must implement static serviceType getter");
    }

    public static getInstance<T extends Service>(): T {
        if (!Service.instance) {
            Service.instance = new (this as any)();
        }
        return Service.instance as T;
    }

    get serviceType(): ServiceType {
        return (this.constructor as typeof Service).serviceType;
    }

    // Add abstract initialize method that must be implemented by derived classes
    abstract initialize(runtime: IAgentRuntime): Promise<void>;
}
```

Service 是常驻模块，在 `runtime` 中初始化，在 `runtime` 中调用，为单例模式，按照 类型来识别。入口为 : initialize。
同时，不同的 Service 可以添加不同的服务方法，供 `eliza` 调用。

## 1.2 runtime 中调用

[https://github.com/elizaOS/eliza/blob/develop/packages/core/src/runtime.ts](https://github.com/elizaOS/eliza/blob/develop/packages/core/src/runtime.ts)

plugin 各个模块注册:

[https://github.com/elizaOS/eliza/blob/d5a56c9d647669653a20c2d184de20dc93846774/packages/core/src/runtime.ts#L379C3-L395C12](https://github.com/elizaOS/eliza/blob/d5a56c9d647669653a20c2d184de20dc93846774/packages/core/src/runtime.ts#L379C3-L395C12)

```ts
this.plugins.forEach((plugin) => {
    plugin.actions?.forEach((action) => {
        this.registerAction(action);
    });

    plugin.evaluators?.forEach((evaluator) => {
        this.registerEvaluator(evaluator);
    });

    plugin.services?.forEach((service) => {
        this.registerService(service);
    });

    plugin.providers?.forEach((provider) => {
        this.registerContextProvider(provider);
    });
});
```

service 模块初始化 (真实启动):

[https://github.com/elizaOS/eliza/blob/d5a56c9d647669653a20c2d184de20dc93846774/packages/core/src/runtime.ts#L429](https://github.com/elizaOS/eliza/blob/d5a56c9d647669653a20c2d184de20dc93846774/packages/core/src/runtime.ts#L429)

```ts
for (const plugin of this.plugins) {
    if (plugin.services)
        await Promise.all(
            plugin.services?.map((service) => service.initialize(this))
        );
}
```

## 1.3 插件中互相调用

### 调用其他插件的 Service


插件中获取 service 实例方法:

```ts

getService<T extends Service>(service: ServiceType): T | null {
    const serviceInstance = this.services.get(service);
    if (!serviceInstance) {
        elizaLogger.error(`Service ${service} not found`);
        return null;
    }
    return serviceInstance as T;
}

```

获取到对应的实例以后，就可以使用实例的方法了。

### Action 中互相调用

Action hander 中签名如下:

```ts
handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    state: State,
    _options: any,
    callback: HandlerCallback
) 
```

其中,callback 用于把消息返回给 `agent` 的 `chat` 中。

HandlerCallback 签名:

```ts
/**
 * Callback function type for handlers
 */
export type HandlerCallback = (
    response: Content,
    files?: any
) => Promise<Memory[]>;
```

Content 的类型如下:

```ts
export interface Content {
    /** The main text content */
    text: string;

    /** Optional action associated with the message */
    action?: string;

    /** Optional source/origin of the content */
    source?: string;

    /** URL of the original message/post (e.g. tweet URL, Discord message link) */
    url?: string;

    /** UUID of parent message if this is a reply/thread */
    inReplyTo?: UUID;

    /** Array of media attachments */
    attachments?: Media[];

    /** Additional dynamic properties */
    [key: string]: unknown;
}
```

在 Content 中，指定 其他 Action 的ID ，就可以把消息路由给其他的插件 Action 模块。