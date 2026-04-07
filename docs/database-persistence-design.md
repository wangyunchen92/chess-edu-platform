# 数据库持久化与防丢失方案设计

> 作者: architect-agent
> 日期: 2026-03-30
> 状态: 待评审

---

## 1. 现状分析

### 1.1 数据库概况

| 项目 | 值 |
|------|-----|
| 引擎 | SQLite 3 (开发和生产均为 SQLite) |
| 文件 | `/opt/chess-edu/backend/data.db` (生产) |
| 大小 | ~6MB |
| 表数 | 31 张 |
| 关键数据量 | users: 3, puzzles: 14,927, lessons: 55, courses: 4 |
| 服务器 | 阿里云 118.31.237.111, 2核3.5G, 与建筑ERP共用 |

### 1.2 现有备份机制

- cron 每日凌晨 3 点执行 `backup.sh`
- 部署前手动触发备份
- 备份目录: `/opt/chess-edu/backups/`, 保留 7 天
- **问题: 备份与数据库在同一台机器, 磁盘故障时一起丢失**

### 1.3 核心风险

| 风险 | 严重程度 | 说明 |
|------|---------|------|
| 磁盘故障全丢 | **致命** | SQLite 单文件 + 备份同机, 无异地容灾 |
| 并发写锁 | **高** | SQLite 写锁是数据库级别, 多用户同时写操作会排队甚至超时 |
| Schema 变更困难 | **中** | SQLite ALTER TABLE 不支持 DROP/RENAME COLUMN, 改字段类型需重建表 |
| 手工迁移脆弱 | **中** | `_run_migrations()` 是自研的简陋迁移, 无版本追踪, 无回滚 |
| 无监控告警 | **中** | 数据库损坏或磁盘满无人知晓 |

### 1.4 代码层兼容性摸底

**好消息 -- ORM 用得比较规范:**

- 全部使用 SQLAlchemy ORM 查询, 未发现原始 SQL 拼接 (除 `_run_migrations()` 的 ALTER TABLE)
- 使用 `func.count()`, `func.now()` 等标准 SQLAlchemy 函数
- Pydantic + SQLAlchemy 分层清晰

**需要处理的兼容性问题 (共 3 处):**

| 问题 | 文件 | 说明 |
|------|------|------|
| `func.random()` | `puzzle_service.py` (2处) | SQLite 用 `random()`, PostgreSQL 也用 `random()` -- **兼容, 无需改** |
| `func.date()` | `puzzle_service.py` (4处), `dashboard.py` (1处) | SQLite 的 `date()` 和 PostgreSQL 的 `date()` 行为一致 -- **兼容, 但建议改用 `cast(col, Date)`** |
| `_run_migrations()` | `database.py` | 手工 ALTER TABLE 逻辑, 迁移到 PG 后由 Alembic 接管 -- **需重构** |

**结论: 迁移工作量比预期小, 核心业务代码无需修改。**

---

## 2. 三个方案对比

### 方案 A: 迁移到 PostgreSQL

在服务器上通过 Docker 部署 PostgreSQL 15, 替换 SQLite。

| 维度 | 评估 |
|------|------|
| 工作量 | **中** (1-2天). 改 DATABASE_URL + 数据迁移脚本 + Alembic 初始化 + Docker 部署 |
| 并发能力 | **优秀**. 行级锁, MVCC, 支持数百并发连接 |
| Schema 变更 | **优秀**. 完整的 ALTER TABLE, 配合 Alembic 有版本化迁移和回滚 |
| 运维复杂度 | **中**. 多一个 Docker 容器, 但 PG 运维成熟, 工具链完善 |
| 数据安全 | **好**. WAL 日志 + pg_dump + 流复制, 防丢失手段丰富 |
| 风险点 | 迁移过程中需停服, 需验证所有查询兼容性 |
| 资源占用 | PG 空载约 30-50MB 内存, 2核3.5G 服务器可承受 |

### 方案 B: 保持 SQLite + 增强备份

不动数据库引擎, 仅加强备份和并发优化。

| 维度 | 评估 |
|------|------|
| 工作量 | **小** (半天). 开启 WAL + 写 OSS 备份脚本 |
| 并发能力 | **一般**. WAL 模式下可并发读, 但写仍是串行, 高峰期仍会卡 |
| Schema 变更 | **差**. 不改善, 仍然需要重建表来改字段 |
| 运维复杂度 | **低**. 维持现状 |
| 数据安全 | **改善**. 异地备份解决同机丢失问题 |
| 风险点 | 并发瓶颈随用户增长会暴露, 届时再迁移成本更高 |
| 资源占用 | 无额外开销 |

### 方案 C: 混合方案 (先备份增强, 再迁 PG)

分两步走: 第一步立即增强备份 (1天), 第二步准备 PG 迁移 (1-2周内完成)。

| 维度 | 评估 |
|------|------|
| 工作量 | **中**. 总量与方案A相当, 但分散执行, 风险更低 |
| 并发能力 | 第一步: 一般 (WAL). 第二步完成后: 优秀 |
| Schema 变更 | 第二步完成后: 优秀 |
| 运维复杂度 | **中**. 最终状态与方案A一致 |
| 数据安全 | **最优**. 第一步就解决了最致命的"同机丢失"问题 |
| 风险点 | 无. 每一步都可独立验证, 不影响线上服务 |

---

## 3. 推荐方案: 方案 C (混合方案)

### 推荐理由

1. **解决最紧迫的问题**: 当前最大风险是"备份与数据同机", 方案 C 第一步半天就能解决
2. **不阻塞业务**: 异地备份上线不需要停服, 对用户零影响
3. **为规模化做好准备**: PG 迁移可以充分测试后再上线, 不需要赶工
4. **CLAUDE.md 已经预留了 PG 配置**: Docker Compose 和测试代码都已经用 PostgreSQL, 说明架构上早就规划了这一步
5. **当前数据量极小**: 3 个用户 + 6MB 数据, 迁移窗口非常安全, 越早迁越容易

---

## 4. 详细实施计划

### 第一步: 备份增强 (立即执行, 预计半天)

#### 4.1.1 开启 SQLite WAL 模式

在 `database.py` 的 engine 创建后执行:

```
PRAGMA journal_mode=WAL;
PRAGMA wal_autocheckpoint=1000;
```

效果: 读写分离, 读操作不再被写操作阻塞。写仍然串行, 但在当前 3 用户规模下足够。

#### 4.1.2 异地备份到阿里云 OSS

新增备份脚本 `/opt/chess-edu/backup_oss.sh`, 职责:

1. 使用 `sqlite3 .backup` 命令做热备份 (不需要停服, 不锁库)
2. gzip 压缩
3. 用 `ossutil` 上传到 OSS bucket `chess-edu` 的 `backups/` 目录
4. OSS 端设置生命周期规则: 30 天自动转低频存储, 90 天自动删除

cron 配置:
- 每日凌晨 3:05 执行 (在本地备份之后 5 分钟)
- 每次部署后也触发一次

#### 4.1.3 备份完整性验证

备份脚本需要在上传后做验证:
1. 下载刚上传的备份
2. `sqlite3 backup.db "PRAGMA integrity_check;"` 验证完整性
3. 验证失败则发告警 (写入日志 + 可选的钉钉/飞书通知)

### 第二步: PostgreSQL 迁移 (1-2 周内完成)

#### 4.2.1 服务器部署 PG

使用已有的 `docker-compose.yml`, 在服务器上启动 PostgreSQL 15:

```
docker compose up -d postgres
```

注意事项:
- 数据卷映射到宿主机 `/opt/chess-edu/pgdata/`, 不用 Docker 匿名卷
- 修改默认密码, 不用 `chess_pass`
- 限制 PG 内存: `shared_buffers=256MB`, `work_mem=4MB` (适配 3.5G 服务器)
- 只监听 localhost, 不暴露 5432 到公网

#### 4.2.2 数据迁移脚本思路

**方案: SQLite -> SQL dump -> PostgreSQL**

迁移脚本 `scripts/migrate_sqlite_to_pg.py` 的逻辑:

1. **连接源 (SQLite) 和目标 (PG)** -- 两个 SQLAlchemy engine
2. **按依赖顺序迁移表** -- 先迁无外键的表 (users, puzzles, courses...), 再迁有外键的表
3. **批量插入** -- 每 1000 行一批, 避免内存爆炸 (虽然当前数据量小, 但脚本要通用)
4. **类型适配**:
   - SQLite 的 `TEXT` 存的 datetime -> PG 的 `TIMESTAMP WITH TIME ZONE`
   - SQLite 的 `INTEGER` 主键 (自增) -> PG 的 `SERIAL` 或保持 UUID (当前用的是 UUID)
   - SQLite 的 `JSON` 字段 (实际存 TEXT) -> PG 的原生 `JSONB`
5. **序列重置** -- 如果有自增字段, 迁移后需要 `setval()` 到 max(id)+1
6. **校验** -- 迁移后逐表比对行数, 确保一致

**迁移顺序 (考虑外键依赖):**

```
第1批 (无外键): users, puzzles, courses, characters, achievements, membership_plans
第2批 (依赖第1批): user_profiles, user_ratings, user_streaks, user_daily_quotas,
                   lessons, character_dialogues, invite_codes
第3批 (依赖第2批): exercises, games, daily_puzzles, user_character_relations,
                   user_achievements, daily_train_plans, notifications,
                   lesson_progresses, adaptive_difficulty_configs, user_weakness_profiles
第4批 (依赖第3批): game_moves, puzzle_attempts, exercise_attempts,
                   daily_train_records, rating_histories, promotion_challenges,
                   weakness_recommendations, teacher_students
```

#### 4.2.3 代码改动清单

| 文件 | 改动 | 说明 |
|------|------|------|
| `backend/app/config.py` | `DATABASE_URL` 默认值改为 PG 连接串 | 环境变量覆盖, 开发环境可继续用 SQLite |
| `backend/app/database.py` | 删除 `_run_migrations()`, 改用 Alembic | 核心改动 |
| `backend/app/database.py` | engine 创建增加 `pool_size`/`max_overflow` 参数 | PG 需要连接池配置 |
| `backend/app/services/puzzle_service.py` | `func.date()` 改为 `cast(col, Date)` | 5 处, 可选但推荐 |
| `backend/app/routers/dashboard.py` | `func.date()` 改为 `cast(col, Date)` | 1 处, 同上 |
| `backend/migrations/` | 用 Alembic 生成 PG 的 initial migration | 替代手工 `_run_migrations()` |
| `.env` (生产) | `DATABASE_URL=postgresql://...` | 部署时配置 |
| `requirements.txt` | 添加 `psycopg2-binary` | PG 驱动 |

**不需要改的部分:**
- 所有 ORM 模型定义 (Column, relationship 等) -- SQLAlchemy 会自动适配
- 所有 service 层的 ORM 查询 -- `func.random()`, `func.count()` 等在 PG 下兼容
- 所有 router 和 schema -- 与数据库无关
- 前端 -- 完全无感

#### 4.2.4 迁移执行步骤 (约 30 分钟停服)

```
1. 公告维护 (提前)
2. 停服: systemctl stop chess-edu
3. 最终备份: sqlite3 data.db ".backup data_final.db" + 上传 OSS
4. 启动 PG 容器: docker compose up -d postgres
5. 初始化 PG schema: alembic upgrade head
6. 运行迁移脚本: python scripts/migrate_sqlite_to_pg.py
7. 校验数据: python scripts/verify_migration.py (逐表比对行数)
8. 修改 .env: DATABASE_URL=postgresql://chess_user:NEW_PASS@localhost:5432/chess_edu
9. 重启服务: systemctl restart chess-edu
10. 冒烟测试: 登录 + 看谜题 + 查 Dashboard
11. 确认正常后, 保留 data.db 不删 (至少保留 30 天)
```

#### 4.2.5 回滚方案

如果迁移后发现问题:

1. **快速回滚** (5 分钟): 将 `.env` 的 `DATABASE_URL` 改回 SQLite 路径, 重启服务
2. **data.db 保留原地**, 回滚不丢数据
3. **回滚条件**: 迁移后 1 小时内发现不可接受的问题
4. **回滚后果**: 迁移期间 (30 分钟停服) 的数据丢失, 但当前只有 3 用户, 影响可控

回滚之所以简单, 是因为:
- SQLAlchemy ORM 天然支持多数据库
- `DATABASE_URL` 是唯一的切换开关
- 旧的 SQLite 文件不删除

---

## 5. 备份增强方案 (迁移到 PG 后)

迁移到 PostgreSQL 后, 备份策略升级:

### 5.1 本地备份

```
pg_dump -Fc chess_edu > /opt/chess-edu/backups/chess_edu_$(date +%Y%m%d_%H%M%S).dump
```

- 格式: `custom` (-Fc), 支持选择性恢复, 压缩率高
- 频率: 每日凌晨 3 点
- 保留: 本地 7 天

### 5.2 异地备份 (OSS)

- 将 pg_dump 产物上传到 OSS
- OSS 生命周期: 30 天标准存储 -> 低频存储 -> 90 天删除
- 每次部署后也触发备份

### 5.3 WAL 归档 (可选, 用户量大时启用)

PostgreSQL 的 WAL (Write-Ahead Log) 可以实现增量备份和 PITR (Point-In-Time Recovery):

- `archive_mode = on`
- WAL 文件归档到 OSS
- 配合 pg_basebackup 可恢复到任意时间点
- **当前规模不需要**, 日活超过 100 时再启用

### 5.4 备份验证

每周自动执行一次恢复验证:

1. 从 OSS 下载最新备份
2. 恢复到临时数据库
3. 执行行数比对
4. 清理临时数据库
5. 验证失败则告警

---

## 6. 监控告警建议

### 6.1 基础监控 (立即实施)

| 监控项 | 方式 | 告警阈值 |
|--------|------|---------|
| 磁盘使用率 | cron + 脚本 | > 80% |
| 服务存活 | `curl http://localhost:8001/api/v1/health` | 连续 3 次失败 |
| 备份成功 | 备份脚本退出码 | 非 0 告警 |
| 数据库连接 | FastAPI health check 加 DB ping | 连接失败告警 |

### 6.2 PG 迁移后增加的监控

| 监控项 | 方式 | 告警阈值 |
|--------|------|---------|
| 连接数 | `pg_stat_activity` | > 80% max_connections |
| 慢查询 | `log_min_duration_statement = 1000` | > 1s 的查询记录日志 |
| 表膨胀 | `pg_stat_user_tables` 的 dead tuple 比例 | > 20% |
| WAL 堆积 | `pg_stat_replication` | WAL 大小 > 1GB |
| 备份年龄 | 检查最新备份时间戳 | > 26 小时无新备份 |

### 6.3 告警通道

当前阶段, 最简方案:

1. **cron 脚本** 检测异常, 写入 `/var/log/chess-edu/alert.log`
2. **钉钉/飞书 Webhook** 发送告警消息 (一个 curl 调用即可)
3. 未来用户量上来后, 考虑接入阿里云云监控 (CloudMonitor)

---

## 7. 时间线与里程碑

```
第1天 (立即):
  [x] 方案评审通过
  [ ] 开启 SQLite WAL 模式
  [ ] 部署 OSS 异地备份脚本
  [ ] 添加基础监控 (磁盘 + 服务存活 + 备份)

第2-3天:
  [ ] 本地开发环境搭建 PG (docker compose up)
  [ ] 编写数据迁移脚本 + 校验脚本
  [ ] 本地测试: SQLite -> PG 迁移, 全量功能验证

第4-5天:
  [ ] 代码改动: database.py + config.py + Alembic 初始化
  [ ] func.date() -> cast() 适配 (可选)
  [ ] 本地跑全部 E2E 测试 (PG 环境)

第6-7天:
  [ ] 服务器部署 PG 容器
  [ ] 生产迁移 (30 分钟停服窗口)
  [ ] 冒烟测试 + 回滚方案验证
  [ ] PG 备份策略上线
  [ ] 更新 CLAUDE.md 中数据库相关文档
```

---

## 8. 服务器资源评估

当前服务器: 2 核 3.5GB, 已运行建筑 ERP。

| 服务 | 内存占用 (预估) |
|------|----------------|
| 建筑 ERP 后端 | ~200MB |
| 棋育 FastAPI | ~100MB |
| Nginx | ~20MB |
| PostgreSQL | ~300MB (shared_buffers=256MB) |
| Docker daemon | ~50MB |
| 系统 + 其他 | ~500MB |
| **合计** | **~1.2GB** |
| **剩余** | **~2.3GB** |

结论: **够用**, 但建议 PG 的 `shared_buffers` 不要超过 256MB, `max_connections` 设为 50 (默认 100 太多)。

如果后续加 Redis, 再占 50-100MB, 仍然在安全范围内。

---

## 9. 决策要点总结

1. **最紧迫**: 异地备份, 半天搞定, 立即消除"磁盘故障全丢"的致命风险
2. **必须做**: PostgreSQL 迁移, 1 周内完成, 为规模化扫清并发和 Schema 变更障碍
3. **代码改动小**: ORM 用得规范, 核心业务代码不需要改, 主要改 `database.py` 和配置
4. **回滚安全**: SQLite 文件保留 30 天, 改一行环境变量即可回滚
5. **服务器能撑住**: PG 新增约 300MB 内存, 2核3.5G 的服务器没有问题
