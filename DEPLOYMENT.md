# 部署指南

本文檔說明如何在不同環境中部署 Wukong Dashboard。

## 📋 目錄

- [部署前檢查](#部署前檢查)
- [Docker 部署](#docker-部署)
- [Kubernetes 部署](#kubernetes-部署)
- [生產環境配置](#生產環境配置)
- [監控和日誌](#監控和日誌)
- [備份和恢復](#備份和恢復)
- [故障恢復](#故障恢復)

## ✅ 部署前檢查

### 環境要求
- [ ] Node.js 22.13.0+ 或 Docker
- [ ] MySQL 8.0+ 或 TiDB
- [ ] 足夠的磁盤空間（最少 20GB）
- [ ] 網絡連接正常
- [ ] SSL/TLS 證書已準備（生產環境）

### 代碼檢查
- [ ] 所有測試通過：`pnpm test`
- [ ] 代碼類型檢查通過：`pnpm type-check`
- [ ] 構建成功：`pnpm build`
- [ ] 沒有 console.error 或 console.warn 在生產代碼中

### 配置檢查
- [ ] 環境變量已配置
- [ ] 數據庫連接字符串正確
- [ ] OAuth 配置完成
- [ ] SSL/TLS 證書有效

## 🐳 Docker 部署

### 1. 構建 Docker 鏡像

#### 前端應用
```bash
# 在項目根目錄
docker build -t wukong-dashboard:latest .

# 或指定特定版本
docker build -t wukong-dashboard:1.0.0 .
```

#### Go 後端（可選）
```bash
cd go-backend
docker build -t wukong-dashboard-backend:latest .
cd ..
```

### 2. 本地測試

```bash
# 啟動 MySQL
docker run -d \
  --name mysql-test \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=wukong \
  -p 3306:3306 \
  mysql:8.0

# 等待 MySQL 啟動
sleep 10

# 運行應用
docker run -d \
  --name wukong-dashboard-test \
  --link mysql-test:mysql \
  -e DATABASE_URL="mysql://root:root@mysql:3306/wukong" \
  -e JWT_SECRET="test-secret" \
  -e VITE_APP_ID="test-app" \
  -e OAUTH_SERVER_URL="http://localhost:8080" \
  -p 3000:3000 \
  wukong-dashboard:latest

# 驗證應用
curl http://localhost:3000

# 清理
docker stop wukong-dashboard-test mysql-test
docker rm wukong-dashboard-test mysql-test
```

### 3. Docker Compose 部署

創建 `docker-compose.yml`：
```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
    ports:
      - "3306:3306"
    volumes:
      - mysql-data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      timeout: 20s
      retries: 10

  wukong-dashboard:
    build: .
    environment:
      DATABASE_URL: mysql://${DB_USER}:${DB_PASSWORD}@mysql:3306/${DB_NAME}
      JWT_SECRET: ${JWT_SECRET}
      VITE_APP_ID: ${VITE_APP_ID}
      OAUTH_SERVER_URL: ${OAUTH_SERVER_URL}
    ports:
      - "3000:3000"
    depends_on:
      mysql:
        condition: service_healthy
    restart: unless-stopped

  wukong-backend:
    build: ./go-backend
    environment:
      KUBERNETES_API_URL: ${KUBERNETES_API_URL}
      KUBERNETES_NAMESPACE: ${KUBERNETES_NAMESPACE}
    ports:
      - "8080:8080"
    depends_on:
      - wukong-dashboard
    restart: unless-stopped

volumes:
  mysql-data:
```

啟動服務：
```bash
# 創建 .env 文件
cat > .env << EOF
DB_ROOT_PASSWORD=root
DB_NAME=wukong
DB_USER=wukong
DB_PASSWORD=wukong_password
JWT_SECRET=your-secret-key
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://oauth.example.com
KUBERNETES_API_URL=https://kubernetes:6443
KUBERNETES_NAMESPACE=wukong
EOF

# 啟動
docker-compose up -d

# 查看日誌
docker-compose logs -f wukong-dashboard

# 停止
docker-compose down
```

## ☸️ Kubernetes 部署

### 1. 前置條件

```bash
# 檢查 Kubernetes 集群
kubectl cluster-info

# 檢查 KubeVirt 安裝
kubectl get crd | grep kubevirt

# 檢查 Multus CNI
kubectl get daemonset -n kube-system | grep multus
```

### 2. 創建命名空間和密鑰

```bash
# 創建命名空間
kubectl create namespace wukong

# 創建 MySQL 密鑰
kubectl create secret generic mysql-secret \
  --from-literal=root-password=root \
  --from-literal=password=wukong_password \
  -n wukong

# 創建應用密鑰
kubectl create secret generic wukong-secrets \
  --from-literal=database-url="mysql://wukong:wukong_password@mysql:3306/wukong" \
  --from-literal=jwt-secret="your-secret-key" \
  --from-literal=oauth-app-id="your-app-id" \
  -n wukong

# 創建 kubeconfig 密鑰（用於 Go 後端訪問 Kubernetes）
kubectl create secret generic kubeconfig \
  --from-file=config=/path/to/kubeconfig \
  -n wukong
```

### 3. 部署 MySQL

創建 `k8s/mysql-deployment.yaml`：
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mysql-config
  namespace: wukong
data:
  my.cnf: |
    [mysqld]
    character-set-server=utf8mb4
    collation-server=utf8mb4_unicode_ci
    max_connections=1000

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mysql
  namespace: wukong
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
      - name: mysql
        image: mysql:8.0
        ports:
        - containerPort: 3306
        env:
        - name: MYSQL_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mysql-secret
              key: root-password
        - name: MYSQL_DATABASE
          value: wukong
        - name: MYSQL_USER
          value: wukong
        - name: MYSQL_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mysql-secret
              key: password
        volumeMounts:
        - name: mysql-data
          mountPath: /var/lib/mysql
        - name: mysql-config
          mountPath: /etc/mysql/conf.d
        livenessProbe:
          exec:
            command:
            - mysqladmin
            - ping
            - -h
            - localhost
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - mysqladmin
            - ping
            - -h
            - localhost
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: mysql-data
        persistentVolumeClaim:
          claimName: mysql-pvc
      - name: mysql-config
        configMap:
          name: mysql-config

---
apiVersion: v1
kind: Service
metadata:
  name: mysql
  namespace: wukong
spec:
  selector:
    app: mysql
  ports:
  - port: 3306
    targetPort: 3306
  clusterIP: None

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mysql-pvc
  namespace: wukong
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
```

部署：
```bash
kubectl apply -f k8s/mysql-deployment.yaml
```

### 4. 部署應用

創建 `k8s/wukong-deployment.yaml`：
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wukong-dashboard
  namespace: wukong
spec:
  replicas: 2
  selector:
    matchLabels:
      app: wukong-dashboard
  template:
    metadata:
      labels:
        app: wukong-dashboard
    spec:
      containers:
      - name: wukong-dashboard
        image: wukong-dashboard:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: wukong-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: wukong-secrets
              key: jwt-secret
        - name: VITE_APP_ID
          valueFrom:
            secretKeyRef:
              name: wukong-secrets
              key: oauth-app-id
        - name: OAUTH_SERVER_URL
          value: "https://oauth.example.com"
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 1Gi
        livenessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: wukong-dashboard
  namespace: wukong
spec:
  selector:
    app: wukong-dashboard
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

部署：
```bash
kubectl apply -f k8s/wukong-deployment.yaml
```

### 5. 驗證部署

```bash
# 查看 Pod 狀態
kubectl get pods -n wukong

# 查看服務
kubectl get svc -n wukong

# 查看日誌
kubectl logs -f deployment/wukong-dashboard -n wukong

# 進入 Pod 調試
kubectl exec -it pod/wukong-dashboard-xxx -n wukong -- /bin/sh
```

## 🔒 生產環境配置

### 1. SSL/TLS 配置

#### 使用 Let's Encrypt
```bash
# 安裝 cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# 創建 ClusterIssuer
kubectl apply -f - << EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

#### 配置 Ingress
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: wukong-ingress
  namespace: wukong
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - dashboard.example.com
    secretName: wukong-tls
  rules:
  - host: dashboard.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: wukong-dashboard
            port:
              number: 80
```

### 2. 資源限制

```yaml
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 2000m
    memory: 2Gi
```

### 3. 自動擴展

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: wukong-hpa
  namespace: wukong
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: wukong-dashboard
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## 📊 監控和日誌

### 1. Prometheus 監控

```yaml
apiVersion: v1
kind: Service
metadata:
  name: wukong-metrics
  namespace: wukong
spec:
  selector:
    app: wukong-dashboard
  ports:
  - name: metrics
    port: 9090
    targetPort: 9090
```

### 2. ELK 日誌收集

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: filebeat-config
  namespace: wukong
data:
  filebeat.yml: |
    filebeat.inputs:
    - type: container
      paths:
        - '/var/lib/docker/containers/*/*.log'
    
    output.elasticsearch:
      hosts: ["elasticsearch:9200"]
```

### 3. 應用日誌配置

```typescript
// server/_core/index.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

## 💾 備份和恢復

### 1. 數據庫備份

```bash
# 定期備份
kubectl exec -it mysql-pod -n wukong -- \
  mysqldump -u root -p$MYSQL_ROOT_PASSWORD wukong > backup.sql

# 使用 CronJob 自動備份
kubectl apply -f - << EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: mysql-backup
  namespace: wukong
spec:
  schedule: "0 2 * * *"  # 每天 2:00 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: mysql:8.0
            command:
            - /bin/sh
            - -c
            - mysqldump -h mysql -u root -p$MYSQL_ROOT_PASSWORD wukong > /backup/wukong-$(date +%Y%m%d-%H%M%S).sql
            env:
            - name: MYSQL_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mysql-secret
                  key: root-password
            volumeMounts:
            - name: backup
              mountPath: /backup
          volumes:
          - name: backup
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure
EOF
```

### 2. 恢復數據庫

```bash
# 恢復備份
kubectl exec -i mysql-pod -n wukong -- \
  mysql -u root -p$MYSQL_ROOT_PASSWORD wukong < backup.sql
```

## 🔧 故障恢復

### 常見問題

#### Pod 無法啟動
```bash
# 查看 Pod 事件
kubectl describe pod wukong-dashboard-xxx -n wukong

# 查看日誌
kubectl logs wukong-dashboard-xxx -n wukong

# 檢查資源
kubectl top pod -n wukong
```

#### 數據庫連接失敗
```bash
# 測試連接
kubectl exec -it mysql-pod -n wukong -- \
  mysql -u wukong -p$DB_PASSWORD -h mysql wukong

# 檢查 DNS
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  nslookup mysql.wukong.svc.cluster.local
```

#### 應用無法訪問
```bash
# 檢查 Service
kubectl get svc -n wukong

# 檢查 Ingress
kubectl get ingress -n wukong

# 測試連接
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  wget -O- http://wukong-dashboard.wukong.svc.cluster.local
```

## 📋 部署檢查清單

部署前確保：
- [ ] 所有環境變量已配置
- [ ] 數據庫已初始化
- [ ] SSL/TLS 證書有效
- [ ] 備份已創建
- [ ] 監控已設置
- [ ] 日誌收集已配置
- [ ] 自動擴展已配置
- [ ] 資源限制已設置
- [ ] 健康檢查已配置
- [ ] 災難恢復計劃已制定

---

**最後更新：** 2026-01-10
