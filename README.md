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

存档保存在浏览器的站点存储中。同一浏览器下只要 Pages 地址（用户名、仓库名和协议）不变，刷新或重新打开 iframe 后可以继续读取存档。

## 本地预览

不能直接双击 `index.html`。请在本目录启动静态 HTTP 服务，例如：

```powershell
python -m http.server 8789 --bind 127.0.0.1
```

然后访问 <http://127.0.0.1:8789/>。

## 发布内容

仓库根目录就是 RMMV 的原 `www` 目录。Windows 桌面运行时（`Game.exe`、NW.js DLL 等）不属于网站，没有复制进来。未被游戏引用的开发归档和 PSD 也已排除。
