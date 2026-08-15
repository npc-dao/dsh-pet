# 贡献指南

感谢你改进 dsh-pet。请先在 Issue 中描述较大的行为变化；修复明确缺陷或改进文档可直接提交 Pull Request。

## 开发环境

- Node.js 22.19，或 Node.js 24 及以上版本
- pnpm 11
- macOS、Linux 或 Windows；Codex Desktop 只用于可选的兼容性验证

```sh
pnpm install
pnpm run check
```

`pnpm run check` 是提交前的必跑门禁。它覆盖静态检查、类型检查、逐文件 100% 测试覆盖率、构建与 npm 包内容预检。修改可见界面时，请同时更新相关组件测试；修改导入协议、资源校验或 Host 路由时，请增加无效输入与生命周期测试。

## 提交范围

- 保持一个 Pull Request 只解决一个明确问题。
- 不提交本机 Codex 图集、`app.asar`、个人宠物目录、令牌或绝对路径。
- 修改 `src/` 后运行 `pnpm run build`，并提交更新后的 `lib/`。
- 中文是默认 README；面向用户的行为变化需要同步更新 `README.md` 与 `README.en.md`。
- 新的内置宠物必须使用静态 PNG 或 WebP，并符合版本 1 或版本 2 图集尺寸。

## 报告结果

Pull Request 描述中列出实际运行的命令及结果。不要只写“测试通过”；例如写明 `pnpm run check` 及测试数量。
