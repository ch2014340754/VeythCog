import type { Conversation, Message } from '../types';

const now = Date.now();
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

function msg(id: string, role: 'user' | 'assistant', content: string, offset: number): Message {
  return { id, role, content, timestamp: now - offset };
}

const mockConversations: Conversation[] = [
  {
    id: 'conv-1',
    title: 'AI架构设计讨论',
    lastMessage: '微服务间的通信建议使用事件驱动模式，降低耦合度',
    knowledgeBaseId: 'kb-1',
    createdAt: now - 3 * DAY,
    updatedAt: now - 15 * MINUTE,
    messages: [
      msg('conv-1-msg-1', 'user', '我们正在规划一个新的AI平台，想讨论一下整体架构方案。系统需要支持多模态输入，包括文本、图片和语音，预计日活用户在10万级别。', 3 * HOUR),
      msg('conv-1-msg-2', 'assistant', '针对多模态AI平台的架构设计，我建议采用分层架构模式。接入层使用API网关统一处理请求，支持WebSocket长连接用于流式响应。计算层按模态拆分为独立的推理服务，通过消息队列解耦。存储层建议向量数据库与关系数据库混合使用，向量库存储embedding用于语义检索，关系库存储结构化元数据。', 2 * HOUR + 50 * MINUTE),
      msg('conv-1-msg-3', 'user', '微服务之间应该用同步调用还是异步消息？考虑到实时性要求比较高。', 45 * MINUTE),
      msg('conv-1-msg-4', 'assistant', '建议混合使用两种模式。对于需要即时响应的核心链路（如模型推理请求），使用gRPC同步调用，延迟可控制在10ms以内。对于非即时路径（如日志记录、模型缓存预热、用量统计），使用Kafka异步消息。关键是在网关层做统一的超时和熔断配置，避免级联故障。', 30 * MINUTE),
      msg('conv-1-msg-5', 'assistant', '另外补充一点，微服务间的通信建议使用事件驱动模式，降低耦合度。可以引入事件溯源机制，将状态变更以事件形式持久化，便于后续审计和回放。', 15 * MINUTE),
    ],
  },
  {
    id: 'conv-2',
    title: 'React性能优化',
    lastMessage: '使用React.memo和useMemo时要注意浅比较的陷阱，深层对象变化可能被忽略',
    knowledgeBaseId: null,
    createdAt: now - 2 * DAY,
    updatedAt: now - 2 * HOUR,
    messages: [
      msg('conv-2-msg-1', 'user', '我们的React应用在数据量增大后变得很卡，列表渲染1000+条数据时明显掉帧，有什么优化方案？', 3 * HOUR),
      msg('conv-2-msg-2', 'assistant', '针对大数据量列表渲染，最有效的方案是虚拟滚动。推荐使用react-window或react-virtuoso库，只渲染可视区域内的DOM节点，可将1000条数据的DOM节点数从1000+降到20-30个。配合React.memo避免不必要的重渲染，性能提升可达10倍以上。', 2 * HOUR + 45 * MINUTE),
      msg('conv-2-msg-3', 'user', '除了虚拟滚动，状态管理方面有什么建议吗？目前用的Redux，感觉每次更新都会触发大面积重渲染。', 2 * HOUR + 30 * MINUTE),
      msg('conv-2-msg-4', 'assistant', 'Redux的大面积重渲染问题可以从几个方面优化：1）使用createSelector创建记忆化selector，确保只有相关数据变化才触发组件更新；2）考虑使用Redux Toolkit的createEntityAdapter处理列表数据，它内置了高效的CRUD操作和selector；3）对于独立功能模块，可以拆分store slice，配合useSelector精确订阅。另外也可以考虑Zustand或Jotai这类原子化状态库，天然避免过度渲染。使用React.memo和useMemo时要注意浅比较的陷阱，深层对象变化可能被忽略。', 2 * HOUR),
    ],
  },
  {
    id: 'conv-3',
    title: '数据建模咨询',
    lastMessage: '建议在ER图基础上补充数据流图，明确数据的产生、流转和消费路径',
    knowledgeBaseId: 'kb-2',
    createdAt: now - 5 * DAY,
    updatedAt: now - 8 * HOUR,
    messages: [
      msg('conv-3-msg-1', 'user', '我们需要设计一个电商订单系统的数据模型，涉及用户、商品、订单、支付、物流等实体，能帮我梳理一下吗？', 9 * HOUR),
      msg('conv-3-msg-2', 'assistant', '电商订单系统的数据建模需要关注几个核心实体及其关系。用户表需包含基础信息和地址快照；商品表要支持SPU/SKU两级结构，SKU关联价格和库存；订单表是核心枢纽，通过订单明细关联SKU，通过支付单关联支付流水，通过物流单关联配送信息。关键设计原则：1）订单中的商品价格和用户地址必须做快照，不能仅存外键引用；2）金额字段统一用分存储避免浮点精度问题；3）状态机设计要覆盖正向和逆向全流程。', 8 * HOUR + 30 * MINUTE),
      msg('conv-3-msg-3', 'user', '库存扣减应该在下单时还是支付时？两种方案各有什么利弊？', 8 * HOUR + 15 * MINUTE),
      msg('conv-3-msg-4', 'assistant', '下单时扣库存（预扣）能防止超卖，但可能导致恶意占库存；支付时扣库存避免占库存问题，但高并发下易超卖。推荐折中方案：下单时预扣库存并设置超时时间（如30分钟），超时自动释放。同时引入库存流水表记录每次变动，配合分布式锁保证并发安全。建议在ER图基础上补充数据流图，明确数据的产生、流转和消费路径。', 8 * HOUR),
    ],
  },
  {
    id: 'conv-4',
    title: 'API网关方案',
    lastMessage: '建议网关层实现统一的限流熔断策略，使用令牌桶算法控制请求速率',
    knowledgeBaseId: 'kb-3',
    createdAt: now - 7 * DAY,
    updatedAt: now - 1 * DAY,
    messages: [
      msg('conv-4-msg-1', 'user', '我们团队在评估API网关技术选型，Kong、Spring Cloud Gateway和自建Nginx+Lua哪个更适合？', 26 * HOUR),
      msg('conv-4-msg-2', 'assistant', '三种方案各有适用场景。Kong基于OpenResty，插件生态丰富，适合需要快速集成认证、限流、日志等能力的团队；Spring Cloud Gateway适合纯Java技术栈，与Spring生态无缝集成但性能略逊；自建Nginx+Lua灵活度最高但维护成本大。如果团队技术栈多元且追求快速落地，推荐Kong；如果是Java单体/微服务体系，选Spring Cloud Gateway；如果有专门的平台工程团队且需求高度定制，可以考虑自建。', 25 * HOUR),
      msg('conv-4-msg-3', 'user', '网关层的认证方案怎么设计？目前有JWT和OAuth2两种候选。', 25 * HOUR - 30 * MINUTE),
      msg('conv-4-msg-4', 'assistant', 'JWT和OAuth2并不互斥，建议组合使用。对外暴露的API使用OAuth2授权码模式，支持第三方应用安全接入；内部微服务间调用使用JWT做身份传递，减少认证中心的压力。网关层统一验证JWT签名和过期时间，下游服务无需再认证。建议网关层实现统一的限流熔断策略，使用令牌桶算法控制请求速率，配合断路器模式防止级联故障。', 24 * HOUR),
    ],
  },
  {
    id: 'conv-5',
    title: '微服务拆分策略',
    lastMessage: '拆分粒度要平衡独立部署能力和运维复杂度，不是越细越好',
    knowledgeBaseId: null,
    createdAt: now - 10 * DAY,
    updatedAt: now - 3 * DAY,
    messages: [
      msg('conv-5-msg-1', 'user', '我们的单体应用已经到了需要拆分的时候，但团队对拆分边界有分歧，有什么方法论可以参考？', 74 * HOUR),
      msg('conv-5-msg-2', 'assistant', '微服务拆分有几个主流方法论：1）DDD领域驱动设计，通过事件风暴识别限界上下文，这是最系统化的方法；2）按业务能力拆分，参考组织架构（康威定律）；3）按数据变更频率拆分，高频变更的核心域与稳定的通用域分离。实操建议先做领域建模，识别聚合根和领域事件，然后以聚合为拆分单元。拆分时遵循渐进式原则，先用绞杀者模式逐步迁移，避免大爆炸重写。', 73 * HOUR),
      msg('conv-5-msg-3', 'user', '拆分后数据一致性怎么保证？原来在一个事务里的操作现在跨了多个服务。', 72 * HOUR),
      msg('conv-5-msg-4', 'assistant', '跨服务的数据一致性需要从强一致性思维转向最终一致性。推荐Saga模式：将分布式事务拆分为一系列本地事务，每个本地事务完成后发布事件触发下一个步骤，任一步骤失败则执行补偿操作。编排式Saga适合流程简单的场景，协调式Saga（引入中心协调器）适合复杂流程。同时要设计幂等接口，确保重试安全。拆分粒度要平衡独立部署能力和运维复杂度，不是越细越好。', 71 * HOUR),
    ],
  },
  {
    id: 'conv-6',
    title: '前端工程化实践',
    lastMessage: 'Monorepo配合TurboRepo可以显著提升构建效率，增量构建是关键',
    knowledgeBaseId: 'kb-4',
    createdAt: now - 14 * DAY,
    updatedAt: now - 5 * DAY,
    messages: [
      msg('conv-6-msg-1', 'user', '我们前端团队有5个产品线，代码各自独立，共享组件靠复制粘贴，想推进工程化改造，从哪里入手？', 130 * HOUR),
      msg('conv-6-msg-2', 'assistant', '前端工程化改造建议分三步走。第一步，搭建Monorepo统一代码仓库，使用pnpm workspace管理依赖，配合TurboRepo实现增量构建。第二步，抽取共享组件库和工具库为独立package，建立版本管理和发布流程。第三步，统一构建配置（Vite+TypeScript），引入ESLint+Prettier+Stylelint代码规范，配置Husky+lint-staged做提交检查。这样可以从根本上解决代码复用和一致性问题。', 128 * HOUR),
      msg('conv-6-msg-3', 'user', 'Monorepo的构建速度会不会成为瓶颈？我们的项目已经比较大了。', 126 * HOUR),
      msg('conv-6-msg-4', 'assistant', '构建速度确实是Monorepo的核心挑战。解决方案：1）TurboRepo的远程缓存，CI构建结果可被开发者复用，未修改的package直接跳过；2）配置合理的任务依赖图，让无依赖的任务并行执行；3）使用Vite的依赖预构建和HMR，开发体验接近单仓库。实测数据：一个包含20+package的Monorepo，全量构建从8分钟降到2分钟，增量构建只需30秒。Monorepo配合TurboRepo可以显著提升构建效率，增量构建是关键。', 125 * HOUR),
    ],
  },
];

const mockAIReplies: string[] = [
  '这是一个很好的问题。从架构层面来看，建议采用分层设计，将业务逻辑与基础设施解耦。核心层定义领域模型和接口，基础设施层实现具体的技术细节，如数据库访问和外部服务调用。这样可以在不改变业务逻辑的前提下灵活替换技术实现。',
  '关于性能优化，建议从三个维度入手：首先是计算优化，使用Web Worker将CPU密集型任务移出主线程；其次是渲染优化，采用虚拟列表和懒加载减少DOM操作；最后是网络优化，利用HTTP/2多路复用和资源预加载策略。综合应用这些手段可以显著提升用户体验。',
  '在微服务架构中，服务间通信的选择需要权衡延迟和可靠性。同步调用适合需要即时响应的场景，推荐gRPC因其基于HTTP/2的高效传输；异步消息适合解耦和削峰填谷，Kafka在吞吐量方面表现优异。建议核心链路用同步+降级，辅助链路用异步+重试。',
  '数据一致性是分布式系统的核心挑战。推荐采用CQRS模式分离读写操作，写端使用事件溯源保证一致性，读端通过最终一致性视图提供查询。这种模式特别适合读多写少的业务场景，同时天然支持审计和时间旅行调试。',
  '关于CI/CD流水线设计，建议采用多阶段策略：代码提交触发快速检查（lint+单测，5分钟内），合并到主分支触发集成测试和构建（15分钟内），发布前执行端到端测试和安全扫描。配合特性开关（Feature Flag）可以实现代码部署与功能发布解耦，降低发布风险。',
  '容器化部署方面，建议使用多阶段构建优化镜像大小。基础镜像选择Alpine版本，构建阶段使用完整镜像编译，运行阶段只拷贝产物。配合K8s的HPA根据CPU/内存自动扩缩容，设置合理的requests和limits保证资源利用率。日志收集建议用Filebeat+ELK方案，监控用Prometheus+Grafana。',
  '前端状态管理的选型需要根据场景决定。全局共享状态用Zustand，轻量且TypeScript友好；服务端状态用TanStack Query，内置缓存和自动刷新；表单状态用React Hook Form，性能优秀且验证灵活。避免在Redux中存储服务端缓存数据，这会导致大量冗余的loading和error状态管理代码。',
  '代码质量保障体系建议建立三层防线：第一层是IDE实时检查，配置ESLint+TypeScript严格模式；第二层是Git提交检查，通过Husky+lint-staged拦截不规范代码；第三层是CI流水线检查，执行完整测试套件和覆盖率报告。同时引入SonarQube做持续代码质量分析，追踪技术债务趋势。',
  'API设计方面，RESTful风格适合CRUD为主的场景，GraphQL适合多端聚合查询。无论选择哪种，都要注意：1）版本化策略，URL路径版本比Header版本更直观；2）分页设计，游标分页比偏移分页更适合大数据量场景；3）错误响应标准化，包含错误码、消息和文档链接。建议使用OpenAPI规范自动生成文档和客户端SDK。',
  '安全架构设计需要纵深防御。网络层使用WAF过滤恶意请求，启用DDoS防护；应用层实现认证（JWT+刷新令牌）、授权（RBAC+ABAC混合）、输入验证和CSRF防护；数据层对敏感字段加密存储，传输全程TLS。定期进行安全扫描和渗透测试，建立漏洞响应SOP。安全不是一次性工作，而是持续运营的过程。',
];

export { mockConversations, mockAIReplies };