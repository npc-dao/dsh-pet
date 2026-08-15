# @deepseek-ai/dsh-pet

中文 | [English](README.en.md)

> 当前仓库保持私有。源代码采用 MIT 许可证；内置的小深鲸鱼资产适用单独的品牌衍生资产条款。参见[资产状态](assets/dsh/ASSET-LICENSE.md)和[声明](NOTICE.md)。

在 DSH Web 框架内显示宠物。该包自带始终可用的版本 2 **小深** DeepSeek 蓝鲸图集，发现本机已安装的兼容 Codex 图集，提供一份不透明 Host 目录，在可拖动的浏览器浮层中渲染所选图集，并贡献**宠物**设置分区。该包不包含宠物创建器、图像生成器、上传控件或远程 URL 安装器。

## 使用

Web 应用组合包将该包作为一个 Cordis 插件加载。小深无需 Codex Desktop 即可使用。打开**设置 → 宠物**即可启用或隐藏浮层、选择其他可用预设或导入宠物、在 80 到 224 个 CSS 像素之间设置宽度，或在修改 Codex home 下的文件后刷新目录。浮层始终位于浏览器视口内；当前页面可用指针拖动或方向键调整其位置。

宠物把 DSH 活动映射到 Codex 图集中的空闲、运行、等待用户输入、所选会话失败和已完成输出待查看等行。悬停和拖动使用兼容的跳跃与左右奔跑行。浏览器要求减少动态效果时，宠物会停在一帧，而不循环播放图集。

## 配置

该 Cordis 插件接受两个 Host 资源发现配置键：

| 配置键 | 默认值 | 行为 |
|---|---|---|
| `codexHome` | `$CODEX_HOME`，随后为 `~/.codex` | 包含现代 `pets/` 与旧版 `avatars/` 宠物包的目录。Host 会展开 `~`。显式配置的路径不存在或不是目录时，插件启动会失败。 |
| `appAsarPath` | 按平台发现 | 指向 Codex Desktop `app.asar` 的显式路径，用于读取内置图集。显式配置的归档不可读或格式错误时，插件启动会失败，而不是隐藏配置错误。 |

按平台发现时，macOS 检查 `/Applications/ChatGPT.app/Contents/Resources/app.asar`，Windows 检查 `%LOCALAPPDATA%\Programs\ChatGPT\resources\app.asar`。其他平台需要用 `appAsarPath` 启用 Codex 预设，但没有该配置也仍可使用小深和 Codex home 中的自定义宠物包。

```yaml
- id: dsh-pet
  config:
    codexHome: ~/.codex
    appAsarPath: /Applications/ChatGPT.app/Contents/Resources/app.asar
```

`dsh-pet` settings namespace 独立于这些 Host 路径存储浏览器偏好：

| 设置项 | 默认值 | 行为 |
|---|---|---|
| `enabled` | `true` | 显示或隐藏 Web 框架内浮层。 |
| `selectedId` | `dsh` | 选择内置 DSH id、Codex 预设 id，或发现时分配的不透明 `custom:<directory>` id。 |
| `size` | `112` | 以 CSS 像素表示的精灵宽度，校验范围为 80 到 224。 |

常规本地 settings 提供方把这些字段持久化到 `$DSH_HOME/settings.yaml`。回环浏览器可通过 Host settings API 写入这些值并读取本机宠物目录；远程浏览器的 authority 会从宠物目录与资源路由收到 `403`，因为这些响应投影了 Host 本机文件。

## 导入格式

导入指发现，不会复制文件。刷新时会扫描 `$CODEX_HOME/pets/<directory>/pet.json` 和旧版 `$CODEX_HOME/avatars/<directory>/avatar.json`；两个根目录存在相同目录名时，现代 `pets/` 宠物包优先。运行时身份始终为 `custom:<directory>`，因此 manifest 无法替换内置 id。

manifest 接受 `id`、`displayName`、可为空的 `description`、`spriteVersionNumber` 和 `spritesheetPath`。`spriteVersionNumber` 默认为 `1`，`spritesheetPath` 默认为 `spritesheet.webp`。显示名称依次回退到 `displayName`、`id` 与目录名。未知字段会被忽略。manifest 最大为 64 KiB。

版本 1 图集为 1536×1872 像素；版本 2 图集为 1536×2288 像素。两者都使用八列 192×208 单元格，可采用最大 20 MiB 的静态 PNG 或 WebP；动画 PNG 与 WebP 会被拒绝。Host 只有在完整解码图像后才会接纳它。图集路径在符号链接解析前后都必须留在自己的宠物目录内。格式错误、不可读、过大、逃逸目录、截断或尺寸不兼容的宠物包会被省略，不会遮蔽有效的相邻宠物包。

预设目录首先列出该包自带的版本 2 小深 WebP，该资产根据用户提供的 DeepSeek 图标生成；随后列出九个 Codex 宠物身份：Codex、Dewey、Fireball、Hoots、Rocky、Seedy、Stacky、BSOD 和 Null Signal。该仓库存储小深图集，但对 Codex 预设只存储 id、标签和版本 2 布局元数据。Host 在运行时从用户本机已安装的 Codex Desktop `app.asar` 中定位 Codex 带哈希名的图集；该包不会复制、vendor 或重新分发这些 OpenAI 二进制资源。没有可兼容的本机应用归档时，小深仍然可用，九个 Codex 条目则不可用。刷新成功后，本次目录 generation 会保留已校验的预设压缩图集，避免每个浏览器图像请求再次完整解码；下次刷新会重新读取 Codex 归档。

浏览器通过回环同源 HTTP 读取这些资源：`GET /dsh-pet/catalog`、`POST /dsh-pet/refresh`，以及 `GET` 或 `HEAD /dsh-pet/assets/<opaque-id>`。每个请求必须先通过 Connection 对 Host、Origin 与 Fetch-Metadata 的信任检查，才能到达目录。响应只暴露目录元数据和图像字节，不会暴露 Codex home 文件系统路径或 ASAR 成员名。首次发现与路由注册完成后，Host 插件才会报告激活成功。并发刷新请求按到达顺序执行；插件 teardown 会先注销路由，再等待已接收的请求结束。

## 模型体验

无。该包发现并渲染浏览器宠物；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **宠物属于 DSH Web 视口。** 它不是操作系统桌面浮层、Codex 原生集成、托盘伙伴或独立浮动窗口。
- **Codex 预设的可用性取决于本机 Codex 安装及其私有归档布局。** 自动发现的归档不再匹配受支持布局时，受影响的 Codex 条目会变为不可用，不影响小深；这不构成把上游二进制文件复制进该包的理由。
- **创建与分发不属于该包。** 这里没有编辑器、生成器、上传、深链接安装器或远程图片下载；请通过独立工作流准备兼容 Codex 的目录，再刷新此目录。
- **Host 本机宠物仅限回环访问。** 即使其他应用路由接受某个非回环 authority，通过该地址访问的 DSH Web 页面也不能读取该包的目录或图集。
- **只有所选会话向该映射提供详细失败状态。** 所选前台会话失败时可使用失败行；会话列表不携带后台会话的详细失败原因，因此已完成的后台会话只能使用待查看信号。

## 开发

仓库中的 `lib/` 文件是包导出实际使用的构建产物。源码开发目前依赖 DeepSeek Harness monorepo 提供的共享 TypeScript 与客户端打包预设。请把本仓库放到相匹配 Harness checkout 的 `packages/client/pet`，然后在其中运行包测试和 `pnpm --filter @deepseek-ai/dsh-pet bundle`。

## 许可证

源代码采用 [MIT 许可证](LICENSE)。内置小深图集不包含在该许可证中，参见其[资产专用状态](assets/dsh/ASSET-LICENSE.md)。本仓库不包含任何 Codex 或 OpenAI 二进制资产。
