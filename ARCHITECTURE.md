# Wukong Dashboard - 技術架構文檔

## 系統架構圖

```mermaid
graph TB
    subgraph "用戶層"
        Browser["🌐 Web 瀏覽器"]
        Mobile["📱 移動設備"]
    end

    subgraph "前端層 - React 19"
        UI["UI 組件層<br/>shadcn/ui + Tailwind CSS"]
        Pages["頁面組件<br/>Dashboard, VMs, Snapshots, Quotas, Projects"]
        Hooks["React Hooks<br/>useAuth, useProject, useQuery"]
        State["狀態管理<br/>TanStack Query + tRPC"]
    end

    subgraph "API 網關層"
        Gateway["API 網關<br/>/api/trpc"]
        OAuth["OAuth 回調<br/>/api/oauth/callback"]
    end

    subgraph "Node.js 後端 - Express + tRPC"
        Auth["認證服務<br/>OAuth, JWT, MFA, Sessions"]
        VM["VM 管理<br/>CRUD, 狀態查詢"]
        Project["項目管理<br/>多租戶隔離"]
        Quota["配額管理<br/>檢查、限制"]
        Audit["審計日誌<br/>事件記錄"]
    end

    subgraph "Go 後端服務"
        K8sClient["Kubernetes 客戶端<br/>client-go"]
        VNC["VNC 代理<br/>控制台訪問"]
        WebSocket["WebSocket Hub<br/>實時狀態推送"]
        Handlers["API 處理器<br/>VM 操作"]
    end

    subgraph "數據層"
        MySQL["MySQL/TiDB<br/>關係數據庫"]
        Schema["數據庫架構<br/>11 個表"]
    end

    subgraph "Kubernetes 集群"
        KubeVirt["KubeVirt<br/>虛擬機管理"]
        VMOperator["VM 操作符<br/>自定義 CRD"]
        Networking["網絡層<br/>Multus, NMState"]
        Storage["存儲層<br/>快照, 備份"]
    end

    subgraph "外部服務"
        S3["S3 存儲<br/>文件上傳"]
        LLM["LLM 服務<br/>AI 助手"]
        Notification["通知服務<br/>郵件, Webhook"]
        Maps["地圖服務<br/>Google Maps"]
    end

    subgraph "安全層"
        JWT["JWT 令牌<br/>會話管理"]
        RBAC["RBAC<br/>角色權限"]
        MFA["MFA<br/>TOTP + 備份碼"]
        OIDC["OIDC<br/>企業認證"]
    end

    %% 前端連接
    Browser --> UI
    Mobile --> UI
    UI --> Pages
    Pages --> Hooks
    Hooks --> State
    State --> Gateway

    %% API 層連接
    Gateway --> Auth
    Gateway --> VM
    Gateway --> Project
    Gateway --> Quota
    OAuth --> Auth

    %% 認證流程
    Auth --> JWT
    Auth --> RBAC
    Auth --> MFA
    Auth --> OIDC

    %% Node.js 後端連接
    Auth --> MySQL
    VM --> MySQL
    Project --> MySQL
    Quota --> MySQL
    Audit --> MySQL

    %% Go 後端連接
    VM --> K8sClient
    K8sClient --> KubeVirt
    K8sClient --> VMOperator
    VNC -.-> Browser
    WebSocket --> Pages

    %% 外部服務連接
    Auth --> S3
    VM --> S3
    Handlers --> LLM
    Auth --> Notification
    Pages --> Maps

    %% Kubernetes 內部
    KubeVirt --> Networking
    KubeVirt --> Storage
    VMOperator --> KubeVirt

    %% 數據庫連接
    MySQL --> Schema

    style Browser fill:#e1f5ff
    style Mobile fill:#e1f5ff
    style UI fill:#f3e5f5
    style Pages fill:#f3e5f5
    style Hooks fill:#f3e5f5
    style State fill:#f3e5f5
    style Gateway fill:#fff3e0
    style OAuth fill:#fff3e0
    style Auth fill:#e8f5e9
    style VM fill:#e8f5e9
    style Project fill:#e8f5e9
    style Quota fill:#e8f5e9
    style Audit fill:#e8f5e9
    style K8sClient fill:#fce4ec
    style VNC fill:#fce4ec
    style WebSocket fill:#fce4ec
    style Handlers fill:#fce4ec
    style MySQL fill:#f1f8e9
    style Schema fill:#f1f8e9
    style KubeVirt fill:#e0f2f1
    style VMOperator fill:#e0f2f1
    style Networking fill:#e0f2f1
    style Storage fill:#e0f2f1
    style S3 fill:#ede7f6
    style LLM fill:#ede7f6
    style Notification fill:#ede7f6
    style Maps fill:#ede7f6
    style JWT fill:#ffebee
    style RBAC fill:#ffebee
    style MFA fill:#ffebee
    style OIDC fill:#ffebee
```

---

## 數據流架構

```mermaid
sequenceDiagram
    participant User as 用戶
    participant Browser as 瀏覽器
    participant Frontend as React 前端
    participant tRPC as tRPC API
    participant Express as Express 後端
    participant Auth as 認證服務
    participant DB as 數據庫
    participant K8s as Kubernetes
    participant Go as Go 後端

    User->>Browser: 訪問 Dashboard
    Browser->>Frontend: 加載頁面
    Frontend->>tRPC: 調用 auth.me
    tRPC->>Express: 路由請求
    Express->>Auth: 驗證 JWT
    Auth->>DB: 查詢用戶信息
    DB-->>Auth: 返回用戶數據
    Auth-->>Express: 認證成功
    Express-->>tRPC: 返回用戶信息
    tRPC-->>Frontend: 更新狀態
    Frontend-->>Browser: 渲染儀表板

    User->>Browser: 創建虛擬機
    Browser->>Frontend: 提交表單
    Frontend->>tRPC: 調用 vm.create
    tRPC->>Express: 路由請求
    Express->>Auth: 檢查權限
    Express->>Quota: 檢查配額
    Quota->>DB: 查詢配額
    DB-->>Quota: 返回配額信息
    Quota-->>Express: 配額充足
    Express->>DB: 保存 VM 記錄
    Express->>K8s: 創建虛擬機
    K8s->>Go: 調用 Go 後端
    Go->>K8s: 創建 KubeVirt VM
    K8s-->>Go: 返回 VM ID
    Go-->>Express: 返回成功
    Express->>DB: 更新 VM 狀態
    Express-->>tRPC: 返回結果
    tRPC-->>Frontend: 更新 UI
    Frontend-->>Browser: 顯示成功消息
```

---

## 部署架構

```mermaid
graph LR
    subgraph "開發環境"
        DevLocal["本地開發<br/>pnpm dev"]
    end

    subgraph "生產環境"
        subgraph "容器化"
            DockerFrontend["Docker 鏡像<br/>前端"]
            DockerBackend["Docker 鏡像<br/>Node.js 後端"]
            DockerGo["Docker 鏡像<br/>Go 後端"]
        end

        subgraph "Kubernetes 集群"
            K8sFrontend["Pod<br/>React 前端"]
            K8sBackend["Pod<br/>Express 後端"]
            K8sGo["Pod<br/>Go 後端"]
            K8sDB["StatefulSet<br/>MySQL"]
            K8sVMs["虛擬機 Pod<br/>KubeVirt"]
        end

        subgraph "存儲"
            PVC["PersistentVolume<br/>數據庫存儲"]
            S3["S3 對象存儲<br/>文件備份"]
        end

        subgraph "網絡"
            Ingress["Ingress<br/>入口控制器"]
            Service["Service<br/>服務發現"]
            NetworkPolicy["NetworkPolicy<br/>網絡隔離"]
        end
    end

    subgraph "監控和日誌"
        Prometheus["Prometheus<br/>指標收集"]
        ELK["ELK Stack<br/>日誌分析"]
        Grafana["Grafana<br/>可視化"]
    end

    DevLocal --> DockerFrontend
    DevLocal --> DockerBackend
    DevLocal --> DockerGo

    DockerFrontend --> K8sFrontend
    DockerBackend --> K8sBackend
    DockerGo --> K8sGo

    K8sFrontend --> Ingress
    K8sBackend --> Service
    K8sGo --> Service

    K8sBackend --> K8sDB
    K8sDB --> PVC
    K8sBackend --> S3

    Service --> NetworkPolicy

    K8sFrontend --> Prometheus
    K8sBackend --> Prometheus
    K8sGo --> Prometheus

    K8sFrontend --> ELK
    K8sBackend --> ELK
    K8sGo --> ELK

    Prometheus --> Grafana

    style DevLocal fill:#e3f2fd
    style DockerFrontend fill:#f3e5f5
    style DockerBackend fill:#e8f5e9
    style DockerGo fill:#fce4ec
    style K8sFrontend fill:#f3e5f5
    style K8sBackend fill:#e8f5e9
    style K8sGo fill:#fce4ec
    style K8sDB fill:#f1f8e9
    style K8sVMs fill:#e0f2f1
    style PVC fill:#fff3e0
    style S3 fill:#fff3e0
    style Ingress fill:#ede7f6
    style Service fill:#ede7f6
    style NetworkPolicy fill:#ede7f6
    style Prometheus fill:#ffebee
    style ELK fill:#ffebee
    style Grafana fill:#ffebee
```

---

## 數據庫架構

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : owns
    USERS ||--o{ USER_SESSIONS : has
    USERS ||--o{ USER_MFA_SETTINGS : has
    USERS ||--o{ USER_OIDC_IDENTITIES : has
    USERS ||--o{ AUDIT_LOGS : generates

    PROJECTS ||--o{ PROJECT_MEMBERS : contains
    PROJECTS ||--o{ RESOURCE_QUOTAS : has
    PROJECTS ||--o{ RESOURCE_USAGE : tracks

    RESOURCE_QUOTAS ||--o{ QUOTA_TEMPLATES : uses

    OIDC_PROVIDERS ||--o{ USER_OIDC_IDENTITIES : provides

    USERS {
        int id PK
        string openId UK
        string email UK
        string name
        string role
        timestamp createdAt
        timestamp updatedAt
    }

    PROJECTS {
        int id PK
        int ownerId FK
        string name UK
        string description
        string status
        timestamp createdAt
        timestamp updatedAt
    }

    PROJECT_MEMBERS {
        int id PK
        int projectId FK
        int userId FK
        string role
        timestamp joinedAt
    }

    RESOURCE_QUOTAS {
        int id PK
        int projectId FK
        int templateId FK
        int cpuLimit
        int memoryLimit
        int storageLimit
        int vmLimit
    }

    QUOTA_TEMPLATES {
        int id PK
        string name UK
        string description
        int cpuLimit
        int memoryLimit
        int storageLimit
        int vmLimit
    }

    RESOURCE_USAGE {
        int id PK
        int projectId FK
        int cpuUsed
        int memoryUsed
        int storageUsed
        int vmCount
        timestamp recordedAt
    }

    USER_SESSIONS {
        int id PK
        int userId FK
        string sessionToken UK
        string deviceName
        string userAgent
        string ipAddress
        timestamp lastActivityAt
        timestamp expiresAt
        boolean isActive
    }

    USER_MFA_SETTINGS {
        int id PK
        int userId FK
        boolean enabled
        string totpSecret
        string[] backupCodes
        timestamp createdAt
        timestamp updatedAt
    }

    OIDC_PROVIDERS {
        int id PK
        string name UK
        string clientId
        string clientSecret
        string discoveryUrl
        string[] scopes
        boolean enabled
    }

    USER_OIDC_IDENTITIES {
        int id PK
        int userId FK
        int providerId FK
        string externalId UK
        json metadata
        timestamp createdAt
    }

    AUDIT_LOGS {
        int id PK
        int userId FK
        string eventType
        string description
        string ipAddress
        string userAgent
        string severity
        timestamp createdAt
    }
```

---

## 認證流程

```mermaid
graph TD
    A["用戶訪問應用"] --> B["檢查 JWT Token"]
    B -->|Token 有效| C["加載儀表板"]
    B -->|Token 無效或缺失| D["重定向到登錄"]
    
    D --> E["用戶點擊登錄"]
    E --> F["重定向到 OAuth 提供商"]
    F --> G["用戶授權"]
    G --> H["OAuth 提供商返回授權碼"]
    H --> I["後端交換 Access Token"]
    I --> J["獲取用戶信息"]
    J --> K{用戶是否存在?}
    
    K -->|是| L["更新用戶信息"]
    K -->|否| M["創建新用戶"]
    M --> N["創建默認項目"]
    
    L --> O["生成 JWT Token"]
    N --> O
    O --> P["設置 Session Cookie"]
    P --> Q["重定向到儀表板"]
    Q --> C
    
    C --> R["檢查 MFA 是否啟用"]
    R -->|啟用| S["提示輸入 TOTP"]
    R -->|未啟用| T["完全登錄"]
    
    S --> U["驗證 TOTP 碼"]
    U -->|正確| T
    U -->|錯誤| S
    
    T --> V["記錄審計日誌"]
    V --> W["創建會話記錄"]
    W --> X["用戶可訪問資源"]

    style A fill:#e3f2fd
    style C fill:#c8e6c9
    style D fill:#ffccbc
    style T fill:#c8e6c9
    style X fill:#c8e6c9
```

---

## 配額檢查流程

```mermaid
graph TD
    A["用戶創建虛擬機"] --> B["提交 VM 配置"]
    B --> C["後端接收請求"]
    C --> D["驗證用戶權限"]
    D -->|無權限| E["返回 403 錯誤"]
    D -->|有權限| F["獲取項目配額"]
    
    F --> G["查詢當前使用情況"]
    G --> H["計算剩餘配額"]
    
    H --> I{配額是否充足?}
    I -->|不足| J["返回 400 錯誤<br/>提示配額不足"]
    I -->|充足| K["創建虛擬機"]
    
    K --> L["更新資源使用記錄"]
    L --> M["記錄審計日誌"]
    M --> N["返回成功響應"]
    N --> O["前端顯示成功消息"]

    style A fill:#e3f2fd
    style K fill:#c8e6c9
    style N fill:#c8e6c9
    style O fill:#c8e6c9
    style E fill:#ffccbc
    style J fill:#ffccbc
```

---

## 安全架構

```mermaid
graph TB
    subgraph "邊界安全"
        Firewall["防火牆"]
        WAF["Web 應用防火牆"]
        DDoS["DDoS 防護"]
    end

    subgraph "傳輸安全"
        TLS["TLS 1.3 加密"]
        HTTPS["HTTPS"]
        JWT["JWT 令牌"]
    end

    subgraph "應用安全"
        RBAC["RBAC 權限控制"]
        MFA["多因素認證"]
        SessionMgmt["會話管理"]
        InputValidation["輸入驗證"]
        CSRF["CSRF 防護"]
    end

    subgraph "數據安全"
        Encryption["數據加密"]
        Hashing["密碼哈希"]
        Audit["審計日誌"]
    end

    subgraph "基礎設施安全"
        NetworkPolicy["網絡隔離"]
        RBAC_K8s["Kubernetes RBAC"]
        SecretMgmt["密鑰管理"]
    end

    User["用戶"] --> Firewall
    Firewall --> WAF
    WAF --> DDoS
    DDoS --> HTTPS
    HTTPS --> TLS
    TLS --> JWT
    
    JWT --> RBAC
    RBAC --> MFA
    MFA --> SessionMgmt
    SessionMgmt --> InputValidation
    InputValidation --> CSRF
    
    CSRF --> Encryption
    Encryption --> Hashing
    Hashing --> Audit
    
    Audit --> NetworkPolicy
    NetworkPolicy --> RBAC_K8s
    RBAC_K8s --> SecretMgmt

    style Firewall fill:#ffccbc
    style WAF fill:#ffccbc
    style DDoS fill:#ffccbc
    style TLS fill:#ffe0b2
    style HTTPS fill:#ffe0b2
    style JWT fill:#ffe0b2
    style RBAC fill:#fff9c4
    style MFA fill:#fff9c4
    style SessionMgmt fill:#fff9c4
    style InputValidation fill:#fff9c4
    style CSRF fill:#fff9c4
    style Encryption fill:#c8e6c9
    style Hashing fill:#c8e6c9
    style Audit fill:#c8e6c9
    style NetworkPolicy fill:#b3e5fc
    style RBAC_K8s fill:#b3e5fc
    style SecretMgmt fill:#b3e5fc
```

---

## 擴展性架構

```mermaid
graph LR
    subgraph "水平擴展"
        LB["負載均衡器"]
        Frontend1["前端 Pod 1"]
        Frontend2["前端 Pod 2"]
        Backend1["後端 Pod 1"]
        Backend2["後端 Pod 2"]
        Go1["Go 後端 Pod 1"]
        Go2["Go 後端 Pod 2"]
    end

    subgraph "垂直擴展"
        HPA["Horizontal Pod Autoscaler"]
        VPA["Vertical Pod Autoscaler"]
        ResourceQuota["Resource Quota"]
    end

    subgraph "數據庫擴展"
        PrimaryDB["Primary MySQL"]
        ReplicaDB["Replica MySQL"]
        Sharding["數據分片"]
    end

    subgraph "緩存層"
        Redis["Redis 緩存"]
        CDN["CDN"]
    end

    LB --> Frontend1
    LB --> Frontend2
    LB --> Backend1
    LB --> Backend2
    LB --> Go1
    LB --> Go2

    HPA --> Frontend1
    HPA --> Backend1
    HPA --> Go1

    VPA --> Frontend1
    VPA --> Backend1

    ResourceQuota --> Frontend1
    ResourceQuota --> Backend1

    Backend1 --> PrimaryDB
    Backend2 --> PrimaryDB
    PrimaryDB --> ReplicaDB
    PrimaryDB --> Sharding

    Frontend1 --> Redis
    Backend1 --> Redis
    Frontend1 --> CDN

    style LB fill:#e3f2fd
    style Frontend1 fill:#f3e5f5
    style Frontend2 fill:#f3e5f5
    style Backend1 fill:#e8f5e9
    style Backend2 fill:#e8f5e9
    style Go1 fill:#fce4ec
    style Go2 fill:#fce4ec
    style HPA fill:#fff3e0
    style VPA fill:#fff3e0
    style ResourceQuota fill:#fff3e0
    style PrimaryDB fill:#f1f8e9
    style ReplicaDB fill:#f1f8e9
    style Sharding fill:#f1f8e9
    style Redis fill:#ede7f6
    style CDN fill:#ede7f6
```

---

## 監控和日誌架構

```mermaid
graph TB
    subgraph "應用層"
        Frontend["React 前端"]
        Backend["Express 後端"]
        Go["Go 後端"]
    end

    subgraph "收集層"
        Prometheus["Prometheus<br/>指標收集"]
        Fluentd["Fluentd<br/>日誌收集"]
        Jaeger["Jaeger<br/>分布式追蹤"]
    end

    subgraph "存儲層"
        PrometheusDB["Prometheus DB<br/>時間序列數據"]
        Elasticsearch["Elasticsearch<br/>日誌存儲"]
        JaegerDB["Jaeger Backend<br/>追蹤數據"]
    end

    subgraph "可視化層"
        Grafana["Grafana<br/>儀表板"]
        Kibana["Kibana<br/>日誌分析"]
        JaegerUI["Jaeger UI<br/>追蹤查看"]
    end

    subgraph "告警層"
        AlertManager["Alert Manager<br/>告警管理"]
        Slack["Slack<br/>通知"]
        Email["Email<br/>通知"]
    end

    Frontend --> Prometheus
    Backend --> Prometheus
    Go --> Prometheus

    Frontend --> Fluentd
    Backend --> Fluentd
    Go --> Fluentd

    Backend --> Jaeger
    Go --> Jaeger

    Prometheus --> PrometheusDB
    Fluentd --> Elasticsearch
    Jaeger --> JaegerDB

    PrometheusDB --> Grafana
    Elasticsearch --> Kibana
    JaegerDB --> JaegerUI

    Prometheus --> AlertManager
    AlertManager --> Slack
    AlertManager --> Email

    style Frontend fill:#f3e5f5
    style Backend fill:#e8f5e9
    style Go fill:#fce4ec
    style Prometheus fill:#fff3e0
    style Fluentd fill:#fff3e0
    style Jaeger fill:#fff3e0
    style PrometheusDB fill:#f1f8e9
    style Elasticsearch fill:#f1f8e9
    style JaegerDB fill:#f1f8e9
    style Grafana fill:#ede7f6
    style Kibana fill:#ede7f6
    style JaegerUI fill:#ede7f6
    style AlertManager fill:#ffccbc
    style Slack fill:#ffccbc
    style Email fill:#ffccbc
```

---

## 關鍵技術決策

| 決策 | 選擇 | 原因 |
|------|------|------|
| 前端框架 | React 19 | 生態成熟，組件豐富 |
| 後端框架 | Express + tRPC | 類型安全，開發效率高 |
| 數據庫 | MySQL/TiDB | 關係型數據，ACID 保證 |
| ORM | Drizzle | 類型安全，輕量級 |
| 認證 | OAuth 2.0 + JWT | 安全標準，易於集成 |
| 容器化 | Docker | 標準化部署 |
| 編排 | Kubernetes | 生產級別，自動擴展 |
| 虛擬化 | KubeVirt | 原生 Kubernetes 集成 |
| Go 後端 | Gin + client-go | 高性能，官方支持 |
| 測試 | Vitest | 快速，TypeScript 友好 |

---

## 性能指標目標

| 指標 | 目標 | 說明 |
|------|------|------|
| 首屏加載時間 | < 2s | 優化前端資源 |
| API 響應時間 | < 200ms | 99% 請求 |
| 數據庫查詢時間 | < 50ms | 平均查詢 |
| 系統可用性 | 99.9% | 月度 SLA |
| 最大並發用戶 | 10,000+ | 水平擴展 |
| 虛擬機創建時間 | < 30s | 端到端 |

---

## 災難恢復計劃

| 場景 | RTO | RPO | 恢復方案 |
|------|-----|-----|---------|
| 單個 Pod 故障 | 1 分鐘 | 0 | 自動重啟 |
| 節點故障 | 5 分鐘 | 0 | Pod 遷移 |
| 數據庫故障 | 10 分鐘 | 1 分鐘 | 主從切換 |
| 區域故障 | 1 小時 | 15 分鐘 | 跨區域恢復 |
| 完全故障 | 4 小時 | 1 小時 | 備份恢復 |

---

**最後更新：** 2026年1月11日
