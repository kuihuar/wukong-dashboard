# 环境变量加载修复 ✅

## 问题

之前使用 `import "dotenv/config"` 时，只会自动加载 `.env` 文件，不会加载 `.env.local` 文件，导致环境变量配置无法生效。

## 解决方案

已修改 `server/_core/index.ts`，改为手动加载环境变量文件，按优先级顺序：

1. **`.env.local`** - 本地开发配置（最高优先级）
2. **`.env`** - 默认配置（较低优先级，不会覆盖 `.env.local`）

## 修改内容

```typescript
// 之前
import "dotenv/config";

// 现在
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

// 加载 .env.local（优先）
dotenv.config({ path: path.resolve(projectRoot, ".env.local") });
// 加载 .env（不会覆盖 .env.local）
dotenv.config({ path: path.resolve(projectRoot, ".env") });
```

## 验证

重启开发服务器后，应该能看到：

```
[Env] Loaded .env.local from /path/to/.env.local
Proxying Go backend requests to: http://192.168.1.141:8085
```

## 注意事项

1. **`.env.local` 文件格式**：确保所有环境变量的值都用引号括起来，例如：
   ```env
   GO_BACKEND_URL="http://192.168.1.141:8085"
   ```
   而不是：
   ```env
   GO_BACKEND_URL="http://192.168.1.141:8085  # 缺少结束引号
   ```

2. **文件位置**：`.env.local` 文件应该位于项目根目录，与 `package.json` 同级。

3. **优先级**：`.env.local` 中的变量会覆盖 `.env` 中的同名变量。

## 测试

运行以下命令验证环境变量是否正确加载：

```bash
# 启动开发服务器
pnpm dev

# 应该看到类似输出：
# [Env] Loaded .env.local from /path/to/.env.local
# Proxying Go backend requests to: http://192.168.1.141:8085
```

## 相关文件

- `server/_core/index.ts` - 环境变量加载逻辑
- `.env.local` - 本地开发环境变量（不提交到 Git）
- `.env.example` - 环境变量模板（提交到 Git）

---

**修复完成时间：** 2026-01-11

