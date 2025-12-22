# [GKB-20251220] 任务看板
> **环境**: Windows 11 (pwsh -NoLogo wrapper) | **框架**: Static HTML/CSS/JS | **档位**: 4档 (UI 升级)
> **已激活矩阵**: [模块 A: 视觉矫正] + [模块 E: 幽灵防御]

## 1. 需求镜像 (Requirement Mirroring)
> **我的理解**: 对项目进行原子级审查、修复、全站 UI 升级、功能扩展与文档美化并推送。
> **不做什么**: 不启动任何后台服务，不占用端口。

## 2. 进化知识库 (Evolutionary Knowledge - Ω)
- [!] (新发现) UI 升级需同步更新资源版本号，避免缓存未刷新。
- [!] (新发现) “最新更新”排序需依赖 data-updated 数据字段。
- [!] (新发现) 社区话题库筛选/收藏状态需落地到 localStorage，保证刷新不丢。

## 3. 执行清单 (Execution)
- [x] 1. 审查结构与可访问性问题
- [x] 2. 视觉系统升级（色板/背景/卡片/导航/按钮）
- [x] 3. 业务功能扩展（最近访问/笔记/攻略进度/排序修复）
- [x] 4. 数据补齐与模型更新（新游戏/攻略 + 新字段）
- [x] 5. 文档美化（README/CHANGELOG/DATA_MODEL/STYLE_GUIDE）
- [x] 6. bump 版本号 + 本地校验
- [x] 7. 提交并推送
- [ ] 8. （已取消）删除本地克隆：用户要求保留本地环境

---

# [GKB-20251222-R2] 第二轮递归进化：微交互 × 性能压榨
> **环境**: Windows 11 (pwsh -NoLogo wrapper) | **框架**: Static HTML/CSS/JS | **档位**: 4档 (性能 & 微交互)
> **已激活矩阵**: [模块 A: 视觉矫正] + [模块 E: 幽灵防御] + [模块 F: 靶向验证]

## 1. 需求镜像 (Requirement Mirroring)
> **我的理解**: 聚焦“用户体验微交互”与“深层性能压榨”，避免不必要的重渲染，并把 Node 单元测试覆盖率提升到 CI 阈值以上。
> **不做什么**: 不启动任何后台服务；不删除本地克隆；不抢占端口。

## 2. 执行清单 (Execution)
- [x] 1. Command Palette：搜索索引缓存 + 事件委托（减少重复绑定）
- [x] 2. 全站导航：Soft Navigation 跨页淡出（降级安全）+ BFCache 复位
- [x] 3. 列表页（攻略/社区）：Tag/收藏按钮事件委托，取消收藏不再触发全量重渲染
- [x] 4. All Games：排序回到“热门”可还原原始顺序 + 过滤 Chip 事件委托 + 避免重复排序
- [x] 5. 微交互：收藏星标弹性动效 + View Transition API（可用则启用，不可用自动降级）
- [x] 6. 工具链：补齐分支覆盖率，CI 覆盖率阈值通过（lines/functions/branches）
- [x] 7. bump 版本号：`20251221-2 -> 20251222-1` + 本地校验通过
- [x] 8. 提交并推送（已完成）

---

# [GKB-20251222-R3] 视觉与功能裂变：影院级动效 × 三大商业模块
> **环境**: Windows 11 (pwsh -NoLogo wrapper) | **框架**: Static HTML/CSS/JS | **档位**: 4档 (动效 & 产品模块)
> **已激活矩阵**: [模块 A: 视觉矫正] + [模块 E: 幽灵防御] + [模块 F: 需求镜像]

## 1. 需求镜像 (Requirement Mirroring)
> **我的理解**: 在保持“纯静态/无框架/无后台服务”的前提下，引入更高级动效编排（Motion / Framer 出品）并新增 3 个高商业价值模块（更新中心 / 路线规划 / 探索推荐），同时深度润色 README 加入动态演示图。
> **不做什么**: 不启动任何后台服务；不抢占端口；不删除本地克隆环境。

## 2. 执行清单 (Execution)
- [x] 1. 新模块：更新中心 `updates.html`（NEW/UPDATED 聚合 + 一键标为已读）
- [x] 2. 新模块：路线规划 `planner.html`（拖拽排序 + 分享链接导入/导出 + 进度汇总）
- [x] 3. 新模块：探索 `discover.html`（本地个性化推荐 + 一键生成路线）
- [x] 4. 动效升级：Command Palette 开合动效 + Toast 进出场动效（Motion）
- [x] 5. PWA：Manifest shortcuts + SW 预缓存补齐新入口页
- [x] 6. README：新增 3 张动态演示 SVG + 功能清单/架构图更新
- [x] 7. bump 版本号：`20251222-1 -> 20251222-2` + 本地校验通过（check-links/check-sw/validate-data）
- [x] 8. 提交并推送（已完成）

---

# [GKB-20251222-R4] 形变级跨页转场：View Transition Shared Element
> **环境**: Windows 11 (pwsh -NoLogo wrapper) | **框架**: Static HTML/CSS/JS | **档位**: 4档 (动效深化)
> **已激活矩阵**: [模块 A: 视觉矫正] + [模块 E: 幽灵防御] + [模块 F: 需求镜像]

## 1. 需求镜像 (Requirement Mirroring)
> **我的理解**: 用户选择 A：实现“跨文档 View Transition”的卡片→详情 Banner 形变级转场，并确保不支持的浏览器自动降级（不破坏现有跨页淡出）。
> **不做什么**: 不启动任何后台服务；不抢占端口；不删除本地克隆环境。

## 2. 进化知识库 (Evolutionary Knowledge - Ω)
- [!] (新发现) 跨文档 View Transition 必须保持“正常导航”，不能 `preventDefault` 或延迟跳转，否则浏览器无法捕获转场快照。
- [!] (新发现) 新页面需在首帧前应用 `view-transition-name`（用 `boot.js` 写入 `html[data-vt-kind]`），否则会错过映射时机。

## 3. 执行清单 (Execution)
- [x] 1. `boot.js`：读取 `sessionStorage(gkb-vt)`，首帧写入 `html[data-vt-kind]`（并清理 token）
- [x] 2. `scripts.js`：点击时为被点卡片写 `viewTransitionName` + 写入 token；支持 VT 时不再拦截导航
- [x] 3. `styles.css`：开启 `@view-transition { navigation: auto; }` + vt-card/vt-media/vt-title 电影感动效
- [x] 4. 版本号：`20251222-2 -> 20251222-3` + 校验通过（check-links/check-sw/validate-data）
- [x] 5. 单测与覆盖率：`npm test` / `npm run test:coverage` 通过
- [x] 6. 提交并推送（已完成）

---

# [GKB-20251222-R5] 微交互深挖：物理反馈 × 可回归动效规范
> **环境**: Windows 11 (pwsh -NoLogo wrapper) | **框架**: Static HTML/CSS/JS | **档位**: 4档 (微交互 & 质感)
> **已激活矩阵**: [模块 A: 视觉矫正] + [模块 E: 幽灵防御] + [模块 F: 需求镜像]

## 1. 需求镜像 (Requirement Mirroring)
> **我的理解**: 聚焦 C：把“按钮/收藏/列表重排/弹窗”做成更有物理感的微交互，同时把动效参数统一成可回归的规范（避免后续越改越散）。
> **不做什么**: 不启动任何后台服务；不抢占端口；不删除本地克隆环境。

## 2. 执行清单 (Execution)
- [x] 1. `scripts.js`：新增统一 Motion tokens + helper（`motionAnimate` / `motionPulse` / `motionSpark` / `motionFlash`）
- [x] 2. Planner：新增/移除/拖拽排序的物理反馈（drop 高亮 + remove collapse + drop pulse）
- [x] 3. Compare：对比弹窗开合动效升级（Motion 优先、CSS 兜底）+ 对比栏/Chip 更新反馈
- [x] 4. 收藏反馈：攻略库/话题库收藏星标弹性动效；详情页收藏按钮闪光反馈
- [x] 5. 规范：补齐 `docs/STYLE_GUIDE.md` 的动效与降级策略说明
- [x] 6. bump 版本号：`20251222-3 -> 20251222-4` + 校验/测试通过
- [x] 7. 提交并推送（已完成）

---

# [GKB-20251222-R6] 全路径融合：Topic VT × Root Transition × 离线包进度
> **环境**: Windows 11 (pwsh -NoLogo wrapper) | **框架**: Static HTML/CSS/JS | **档位**: 4档 (动效融合 & 性能压榨)
> **已激活矩阵**: [模块 A: 视觉矫正] + [模块 E: 幽灵防御] + [模块 F: 靶向验证]

## 1. 需求镜像 (Requirement Mirroring)
> **我的理解**: 合并 A/B/D 与潜在短板修复：扩展 VT 到“社区话题 → 话题页”，加入 root 级导演剪辑过渡，离线包缓存加入进度回执，并对交互热点做渲染/读写优化与动效收敛；同时保持单测覆盖率阈值通过。
> **不做什么**: 不启动任何后台服务；不抢占端口；不删除本地克隆环境。

## 2. 执行清单 (Execution)
- [x] 1. Topic Shared Element：`community.html` 话题卡片 → `forum-topic.html` Banner 形变（boot/sync/style 全链路）
- [x] 2. Root View Transition：全站轻量导演剪辑过渡（淡入淡出 + blur/scale）+ `prefers-reduced-motion` 降级
- [x] 3. 离线包进度：SW `postMessage(GKB_PRECACHE_PROGRESS)` + Toast 同 ID 更新（done/total/失败提示）
- [x] 4. 动效收敛：移除散落 `Motion.animate` 调用，统一走 `motionAnimate` / tokens
- [x] 5. 性能压榨：Command Palette 选中态差分更新；社区话题筛选预计算 search blob + 避免每次 apply 读 localStorage
- [x] 6. 单测覆盖：补齐外链资源检测与解析空输入分支，`npm test` / `npm run test:coverage` 通过
- [x] 7. bump 版本号：`20251222-4 -> 20251222-5` + 校验通过（check-links/check-sw/validate-data）
- [x] 8. 提交并推送

---

# [GKB-20251222-R7] 红蓝对抗：动效库瘦身 × Transform 兼容
> **环境**: Windows 11 (pwsh -NoLogo wrapper) | **框架**: Static HTML/CSS/JS | **档位**: 4档 (性能 & 体积压榨)
> **已激活矩阵**: [模块 E: 幽灵防御] + [模块 F: 靶向验证]

## 1. 需求镜像 (Requirement Mirroring)
> **我的理解**: 把“旧时代遗物”当作攻击面：扫描依赖与大文件，优先消灭体积/性能热点；在不牺牲动效体验的前提下用轻量实现替代臃肿库，并确保边缘场景（hover transform、WAAPI 不可用）可降级不崩。
> **不做什么**: 不启动任何后台服务；不抢占端口；不删除本地克隆环境。

## 2. 执行清单 (Execution)
- [x] 1. 依赖扫描：`node_modules` 不存在（项目无 NPM runtime 依赖）
- [x] 2. 动效库瘦身：将 `vendor/motion.js` 替换为 WAAPI 轻量适配层（保留 `Motion.animate/stagger` 接口）
- [x] 3. 边缘兼容：动效合成 transform 时尽量保留点击当下的 CSS transform（避免 hover 状态点击“跳一下”）
- [x] 4. 清理冗余：移除不再需要的 `vendor/motion.LICENSE.md`
- [x] 5. bump 版本号：`20251222-5 -> 20251222-6` + 本地校验/测试通过（check-links/check-sw/validate-data + coverage）
- [ ] 6. 提交并推送
