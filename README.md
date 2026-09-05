# Summer Memories 网页版

这是从 RPG Maker MV 的 Windows 发布包中提取出的纯静态网页版本，可部署到 GitHub Pages，并通过 iframe 嵌入支持外链页面的网站。

## GitHub Pages

仓库推送到 GitHub 后，在 **Settings → Pages → Build and deployment → Source** 中选择 **Deploy from a branch**，分支选择 `main`，目录选择 `/(root)`。此方式会直接发布仓库中的静态文件，适合当前体积较大的游戏资源。

部署成功后的地址通常为：

```text
https://<GitHub 用户名>.github.io/<仓库名>/
```

## iframe 示例

```html
<iframe
  src="https://<GitHub 用户名>.github.io/<仓库名>/"
  title="Summer Memories"
  width="816"
  height="624"
  allow="autoplay; fullscreen; gamepad"
  allowfullscreen
  loading="eager"
  style="width:100%;max-width:816px;aspect-ratio:816/624;border:0;background:#000"
></iframe>
```

直接打开 GitHub Pages 时，存档会使用浏览器站点存储作为本地预览兜底。通过配套的角色卡 `index.html` 打开时，游戏会在启动前从平台 `dzmm.kv` 载入存档，并把 RMMV 的同步 `StorageManager` 调用转换成异步云端写入。

KV 存档采用索引 + 分块结构，每块 90,000 个字符，低于平台单值 5 MiB 限制。手动存档会使用 `{ flush: true }`，同时实现了平台的 `reset` 和 `prepareDeleteRecord` 存档生命周期动作。

由于 GitHub Pages 游戏是角色卡页面中的跨域子 iframe，`js/dzmm-parent-bridge.js` 会用 `postMessage` 把存档请求转交给角色卡外壳；角色卡外壳持有平台注入的 `window.dzmm`。

## 本地预览

不能直接双击 `index.html`。请在本目录启动静态 HTTP 服务，例如：

```powershell
python -m http.server 8789 --bind 127.0.0.1
```

然后访问 <http://127.0.0.1:8789/>。

## 发布内容

仓库根目录就是 RMMV 的原 `www` 目录。Windows 桌面运行时（`Game.exe`、NW.js DLL 等）不属于网站，没有复制进来。未被游戏引用的开发归档和 PSD 也已排除。

配套角色卡入口位于同级目录 `Summer Memories-游戏卡/index.html`，该文件单独上传到游戏平台，不放进 GitHub Pages 仓库。
