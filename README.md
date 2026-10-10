# 多巴胺口算（Dopa Drill）

**中文** | [English](README.en.md) | [日本語](README.ja.md)

每解一道算数题，演出和音乐就不断升级的口算练习。只在浏览器里运行。

吉祥物「多巴奇」会把你输入的数字搬进算式，答对了就为你庆祝。题目越往后，画面和声音越热闹，最后一题结束时整场像庆典一样。答错也不会打断气势，没有游戏结束。

## 特点

- 覆盖小学 1〜6 年级的 58 项计算技能（基于课程标准）。加法、减法、乘法、除法、竖式中途输入、小数、分数、百分数等
- 「我的等级」模式：从实力测试开始，按掌握程度逐步解锁后面的技能
- 按年级练习、复习、技能树画面
- 全部答对得 100 分。一次答对率在 80% 以上，还可以进入限时加时挑战，冲击超过 100 分的得分
- 音乐和音效全部用 Web Audio API 合成（不使用任何音频文件）
- 支持手机竖屏和电脑。电脑上可以用数字键和退格键输入
- 设置里可以调整动效强度，也可以静音
- 记录全部保存在设备本地（localStorage），不会发送到外部

## 界面语言

支持中文（默认）、English、日本語 三种语言。首次打开时：日语浏览器显示日语，其他语言一律默认中文。之后可以在「设置 → 语言」里随时切换，选择会保存在本机。

## 本地运行

无需构建。把 `app/` 目录静态托管即可。

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

浏览器打开 `http://localhost:8000/app/`。项目使用了 ES Modules，直接双击 HTML 文件（file://）无法运行。

Windows 下如果 `python -m http.server` 把 `.js` 发成 `text/plain` 导致模块无法加载，可以用自带的小服务器：

```bash
node tools/serve.mjs 8000 app
```

## 装到手机和平板上

游戏本身就是一个可直接安装的 PWA，不需要构建步骤。用任意静态服务器托管
`app/` 目录即可（例如 Cloudflare Pages、GitHub Pages，注意必须 HTTPS）。

- **Android / 桌面 Chrome**：地址栏或菜单里会出现"安装"入口。
- **iOS Safari**：分享 → 添加到主屏幕。iOS 不读 manifest，用的是
  `apple-touch-icon` 和 `apple-mobile-web-app-*` 这几个 meta 标签。

装好后是全屏无地址栏的独立应用，**完全离线可玩**：`app/sw.js` 会把
33 个运行时文件预缓存下来（含 5 个字体的子集）。发布新版本时
**必须改 `sw.js` 里的 `CACHE_VERSION`**，否则设备会继续用旧缓存——这是
唯一需要人工记住的一步。

`app/js/core.js` 的时钟会在页面隐藏时暂停，所以锁屏或切到其他应用不会让
计时跑掉；Android 的返回键会逐层关闭界面，而不是直接退出游戏。

### 打成应用商店的原生包

`mobile/` 是用 Capacitor 包的壳，`webDir` 指向 `../app`，同一份游戏代码
复制进原生工程，不改一行。适合需要上架、或需要 iOS 上不被系统回收存档的
场景（iOS 会清理长期未打开的 PWA 本地数据，原生容器不会）。

见 [mobile/README.md](mobile/README.md) 和
[mobile/IOS-AUDIO.md](mobile/IOS-AUDIO.md)（iOS 静音拨片会掐掉 Web Audio，
必须用原生代码改音频会话）。

## 测试

需要 Node.js 20 或更高版本。

```bash
node --test tests/*.test.mjs
```

## 目录结构

| 路径 | 内容 |
| --- | --- |
| `app/` | 游戏本体（无依赖的 ES Modules） |
| `app/js/i18n.js`、`app/js/lang/` | 国际化核心与 zh/en/ja 语言包 |
| `app/manifest.webmanifest`、`app/sw.js` | PWA 清单与离线预缓存 |
| `app/icons/` | 主屏图标（由 `tools/build_icons.mjs` 从 `app/icon.svg` 生成） |
| `docs/SPEC.md` | 说明书（中文）；`SPEC.ja.md` 为日文版 |
| `docs/curriculum.md` | 各年级课程与技能树设计（中文）；`curriculum.ja.md` 为日文版 |
| `docs/DESIGN.md` | 下一步功能的详细设计稿（中文，尚未实现）：无尽模式、成长页与错因归因 |
| `docs/dopakichi.svg` | 多巴奇造型的原稿 |
| `mobile/` | Capacitor 原生壳（不参与 web 版本运行） |
| `tests/` | 单元测试 |
| `tools/build_fonts.mjs` | 重新生成界面用字体子集（修改界面文字后运行） |
| `tools/build_icons.mjs` | 从 `app/icon.svg` 生成各尺寸 PNG 图标 |
| `tools/check-i18n.mjs` | 校验语言包完整性的审计脚本 |
| `tools/serve.mjs` | 带正确 MIME 的本地静态服务器 |

## 界面文字与字体

界面文案以中文为源语言（代码里的中文字符串即查找键），`app/js/lang/ja.js` 与 `app/js/lang/en.js` 提供日语、英语翻译。新增文案后运行：

```bash
node tools/check-i18n.mjs   # 校验 en/ja 语言包无缺失
node tools/build_fonts.mjs  # 重新生成中文字体子集（需先 cd tools && npm i）
```

## 许可证

- 源代码：MIT License
- 角色「多巴奇（ドパキチ）」以及「多巴胺口算／ドパドリル／Dopa Drill」的名称与标志：不适用 MIT。非营利用途下可自由进行二次创作
- 字体（`app/fonts/`）：SIL Open Font License 1.1

详见 [LICENSE](LICENSE)。
