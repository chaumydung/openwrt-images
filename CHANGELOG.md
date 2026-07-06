# 更新日志

本文件记录本项目所有值得注意的变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，
并且本项目遵循[语义化版本](https://semver.org/spec/v2.0.0.html)。

## [未发布]

### Added

- Completed test matrix design covering 17 modules and 8 test dimensions
- Generated 80 test cases covering 16 functional modules plus the PRD acceptance flows
- Generated Playwright E2E automated tests covering all P0 acceptance-flow cases (full custom build, quota block, device-page CTA prefill, anonymous download rail, SSR crawlability)

## [0.0.1] - 2026-07-06

### Added

- 项目已初始化，含基础工程配置
- 设备目录同步管线（`pnpm sync`，从官方 downloads 站生成 `data/catalog/`）
- SSR 首页设备搜索（Plan 01）
