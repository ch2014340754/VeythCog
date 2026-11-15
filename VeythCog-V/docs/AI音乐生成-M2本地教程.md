# 在 M2 / 32G 上自产 AI 音乐（VeythCog 曲库）

> 目标：在本机（Apple Silicon M2、32GB 统一内存、已装 LM Studio）批量产出可商用、可入库到 RustFS/S3 的中文 AI 歌曲，用于站点浮动音乐播放器。
> 结论前置：LM Studio 生成不了音乐，它只能跑 LLM；音乐本体用 **ACE-Step 1.5**（MIT 许可，官方支持 macOS/MLX）。

---

## 0. 先把工具分工定死

| 环节 | 工具 | 作用 |
|---|---|---|
| 作词 / 提示词 | **LM Studio**（本地 LLM） | 批量生成中文歌词、结构化风格 prompt、曲名 |
| 演唱 + 编曲 | **ACE-Step 1.5**（本地音乐模型） | text2music：歌词 + 风格 → 带人声的音频 |
| 后处理 | **ffmpeg** | wav → mp3、响度归一化、写 AI 标识元数据 |
| 入库 | **RustFS / S3** | 存音频 + 封面 + manifest |

为什么不用 Suno：免费档不给下载、不能商用；ACE-Step 是 MIT，**产出归你，无额度、无平台条款**。

---

## 1. 硬件与预期

- M2 32GB 统一内存，按"≥24GB"档位对待，具备跑 XL 模型的潜力，但 **Mac 上以官方 macOS 脚本为准，先跑通 2B turbo 再往上试**。
- 速度预期：官方数据 A100 <2s、3090 <10s 一首；**Mac 走 MLX 会慢一个量级**，40 秒片段按 1~3 分钟/首估，实测为准。
- 磁盘：核心模型约 10GB+，XL 模型再加十几 G，预留 40GB 比较稳妥。

---

## 2. 安装（两选一）

### 前置

- Python 3.11–3.12（稳定版，不要 rc 版）
- git：`xcode-select --install`
- **安装路径禁止中文、空格**（如 `/Users/dsy/ai-music/ACE-Step-1.5`）

### 路径 A：官方 macOS 便携包（最省事，推荐）

1. 下载 `ACE-Step-1.5.zip`（官方 Release 里的 macOS 包，已预装依赖并带 MLX 支持）
2. 解压到纯英文路径
3. 首次启动：

```bash
cd /Users/dsy/ai-music/ACE-Step-1.5
chmod +x start_gradio_ui_macos.sh start_api_server_macos.sh
./start_gradio_ui_macos.sh
```

打开 http://localhost:7860

### 路径 B：uv 源码安装（想跟版本更新/改代码）

```bash
# 1. 装 uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. 克隆
git clone https://github.com/ACE-Step/ACE-Step-1.5.git
cd ACE-Step-1.5

# 3. 安装依赖
uv sync

# 4. 用 macOS 脚本启动（脚本会自动设 ACESTEP_LM_BACKEND=mlx 与 --backend mlx）
chmod +x start_gradio_ui_macos.sh
./start_gradio_ui_macos.sh
```

不想用脚本、手搓启动：

```bash
uv run acestep --language zh --download-source modelscope --lm_model_path acestep-5Hz-lm-1.7B
```

### 国内网络必看

模型首跑自动下载，默认 HuggingFace。**国内建议一律加 `--download-source modelscope`**，否则会卡在下载：

```bash
uv run acestep-download --all --download-source modelscope
```

---

## 3. 配置：`.env`（跨版本升级不丢设置）

```bash
cp .env.example .env
```

`.env` 里改这几个就够：

```bash
LANGUAGE=zh
ACESTEP_DOWNLOAD_SOURCE=modelscope
ACESTEP_INIT_LLM=auto
ACESTEP_LM_MODEL_PATH=acestep-5Hz-lm-1.7B
# Mac 上若报显存/内存不足，强制 CPU offload
# ACESTEP_OFFLOAD_TO_CPU=true
```

模型选择建议（M2 32G 路线）：

| 阶段 | DiT | LM | 说明 |
|---|---|---|---|
| 跑通（第 1 天） | `acestep-v15-turbo` | `acestep-5Hz-lm-1.7B` | 稳、快，够用 |
| 提质（跑顺后） | `acestep-v15-xl-turbo` | `acestep-5Hz-lm-4B` | 音质更好，慢、吃内存，失败就退回 |
| 极简（内存紧张） | `acestep-v15-turbo` | `ACESTEP_INIT_LLM=false` | 纯 DiT，无 LLM 规划，速度最快 |

---

## 4. 生成参数怎么填

| 参数 | 建议 | 说明 |
|---|---|---|
| `prompt` | **用英文写**（模型识别更稳），如 `Chinese pop, bright female vocal, clean mix, warm piano` | 控制曲风/音色/配器 |
| `lyrics` | 中文歌词，必须带分段标记 `[Verse]` `[Chorus]` | 标记影响断句和换段，别写成一段大文本 |
| `duration` | 起步 **30–40s**，稳了再拉到 60–90s（官方档位上限其实给到 8 分钟，见附录 A） | 越长越容易爆音/失衡，质量收益在 2 分钟后明显衰减 |
| `seed` | 固定 seed 可复现 | 调 prompt 时只改一个变量 |
| `guidance_scale` | **7~9**（32G 可往 9 走） | 越高越贴 prompt，过高失真 |
| `batch_size` | 1~2 | Mac 上别贪，2 就够 |

**迭代方法**：先固定 seed → 只改 prompt 调风格 → 满意后再换 seed 出变体 → 一首至少留 3 个候选。

---

## 5. 用 LM Studio 批量作词（真正的省力点）

1. LM Studio → Developer → **Start Server**（默认 `http://localhost:1234`，OpenAI 兼容）
2. 加载一个中文强的模型（Qwen 系 7–14B，32G 内存跑 14B 没问题）
3. 跑下面脚本，一次生成 20 首的「曲名 / 英文风格 prompt / 带分段歌词」JSON，直接喂给 ACE-Step：

```python
import json, urllib.request

URL = "http://localhost:1234/v1/chat/completions"

SYSTEM = (
    "你是中文流行歌曲的词作者兼音乐总监。输出严格 JSON，不要解释。"
    "风格 prompt 必须用英文，包含 genre、vocal gender、instrumentation、mood、mix。"
    "歌词用中文，必须带 [Verse] / [Chorus] 分段标记，每段 3-6 行。"
)

USER = f"""为独立音乐网站生成 {20} 首歌，主题围绕：夜、城市、远方、安静生活。
输出 JSON 数组，每项字段：title(中文曲名), style_en(英文风格prompt), lyrics(带分段标记的中文歌词), duration_sec(30-60整数)。
歌曲之间风格要有区分度，避免全是抒情慢歌。"""

req = urllib.request.Request(
    URL,
    data=json.dumps({
        "model": "local-model",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": USER},
        ],
        "temperature": 0.9,
        "max_tokens": 8000,
    }).encode(),
    headers={"Content-Type": "application/json"},
)

with urllib.request.urlopen(req, timeout=600) as r:
    content = json.load(r)["choices"][0]["message"]["content"]

# 容错：剥掉可能的 ```json 包裹
content = content.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
songs = json.loads(content)

with open("songs.json", "w", encoding="utf-8") as f:
    json.dump(songs, f, ensure_ascii=False, indent=2)

print(f"生成 {len(songs)} 首 -> songs.json")
```

> 提示：LM Studio 的 `model` 字段随便填也行，它按已加载模型走；`temperature` 高一点（0.9）风格更散得开。

---

## 6. 生成 → 挑 → 重跑

1. Gradio UI 里选 `text2music` 任务
2. 把 `songs.json` 里一首的 `lyrics` + `style_en` 填进去，`duration` 用建议值，`seed` 记下来
3. 出 2~4 个 seed 变体，挑一个
4. **把挑中的曲目信息（title/seed/prompt/时长）立刻记进 manifest**，别回头补

---

## 7. 后处理：一次命令搞定转码 + 归一化 + AI 标识

```bash
#!/bin/bash
# 单个文件
IN="outputs/ace_test_01.wav"
TITLE="夜航"
SEED=6688
MODEL="acestep-v15-turbo"
DATE=$(date +%F)
OUT="mp3/$(basename "$IN" .wav).mp3"

ffmpeg -y -i "$IN" \
  -af "loudnorm=I=-16:LRA=11:TP=-1.5" \
  -c:a libmp3lame -b:a 192k \
  -metadata title="$TITLE" \
  -metadata artist="VeythCog" \
  -metadata album="AI Originals" \
  -metadata comment="AI-generated; model=$MODEL; seed=$SEED; date=$DATE" \
  -metadata encoding_tool="ACE-Step 1.5" \
  "$OUT"
```

批量：

```bash
mkdir -p mp3
for f in outputs/*.wav; do
  ffmpeg -y -i "$f" \
    -af "loudnorm=I=-16:LRA=11:TP=-1.5" \
    -c:a libmp3lame -b:a 192k \
    -metadata comment="AI-generated; model=acestep-v15-turbo" \
    "mp3/$(basename "${f%.wav}").mp3"
done
```

- `loudnorm -16 LUFS` 是流媒体通用响度，站点播放器不轰耳。
- `comment` 里的 AI 标识就是《人工智能生成合成内容标识办法》要求的"隐式标识"落地方式。

---

## 8. 入库 RustFS / S3

目录约定（与后端 `/api/music/tracks` 对齐）：

```
music/
├── audio/{track_id}.mp3
├── cover/{track_id}.jpg
└── manifest.jsonl
```

`manifest.jsonl` 每行一首：

```json
{"track_id":"ai-0001","title":"夜航","artist":"VeythCog AI","source":"AI_GEN",
 "ai_model":"acestep-v15-turbo","ai_seed":6688,"prompt":"Chinese pop, bright female vocal...",
 "license":"AI_GEN","ai_disclosure":true,"duration":42,"loudness":"-16LUFS",
 "file":"audio/ai-0001.mp3","sha256":"...","created_at":"2026-11-15"}
```

上传（示例，按你实际 RustFS 配置改）：

```bash
aws s3 cp mp3/ s3://veythcog/music/audio/ --recursive --endpoint-url http://127.0.0.1:9000
```

前端播放器卡片记得展示 `AI 生成 · ACE-Step 1.5`（显式标识走"界面提示"这一支，不用给音频加提示音）。

---

## 9. 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 启动报 "No GPU detected" 或走 CPU | macOS 要用 `start_gradio_ui_macos.sh`（自动 `--backend mlx`），别直接用 `uv run acestep` |
| 内存不足 / 进程被杀 | `.env` 里 `ACESTEP_OFFLOAD_TO_CPU=true`，或降级 LM 到 `0.6B`，或 `ACESTEP_INIT_LLM=false` |
| 下载卡住 | 一律加 `--download-source modelscope` |
| 权重加载失败 | 检查路径有无中文/空格/特殊字符 |
| 爆音、伴奏与人声失衡 | 降 `guidance_scale` 到 7；后期用 `loudnorm` + 手动混音 |
| 中文咬字/断句错 | 重排 `[Verse]`/`[Chorus]` 分段，单段别超过 6 行 |
| 长歌拼接处断层 | 分段生成后拼是最后手段，优先直接生成整段（32G 能扛到 60s+） |
| 端口占用 | `--port 7861` |
| 生成结果没保存 | 统一输出到 `outputs/`，后处理前先确认文件存在 |

---

## 10. 合规边界（必读）

- ACE-Step 是 **MIT**，模型产出无附加限制，商用无争议；但**生成式内容必须标识**（界面标 + 元数据标）。
- prompt 里**不要写"模仿某某歌手/某首歌"**——风格致敬可以，复刻音色/旋律会踩人格权与不正当竞争。
- 每首保留 `prompt / seed / model / 日期`，就是你的权利链证据。
- 别把全站音频押在一个模型上：至少保留 20% 来自 CC 曲库（Jamendo/爱给 CC）作为兜底。

---

## 11. 第一天的验收清单

- [ ] `./start_gradio_ui_macos.sh` 起得来，7860 打得开，UI 是中文
- [ ] 用内置示例出一首 30s 中文歌，人声能听清
- [ ] LM Studio server 起来，`songs.json` 成功生成 20 首
- [ ] 3 首挑中的曲目跑完 ffmpeg，mp3 带 `comment` 元数据
- [ ] 1 首传进 RustFS，`manifest.jsonl` 字段齐全
- [ ] 播放器卡片能显示"AI 生成"

---

## 附录 A：要不要改用 RTX 5070（12GB / Tier 5）？

**结论：生产主力换 5070，M2 退居审听 + 后处理 + 上传。**

### 官方档位实况（12–16GB = Tier 5）

| 项 | Tier 5（5070 12GB） | M2 32GB（MLX） |
|---|---|---|
| LM 后端 | **vllm**（仅 CUDA 可用，最快） | mlx（慢一个量级） |
| 可用 LM | 0.6B / **1.7B（推荐）** | 1.7B 可用，4B 未见稳定 |
| XL(4B) DiT | ⚠️ **勉强**：必须 offload + INT8 + 降 batch | 统一内存够大，但 MLX 后端支持未验证 |
| 最大时长 | **8 分钟（带 LM）/ 10 分钟（纯 DiT）** | 受后端限制，实际按 1 分钟评估 |
| 最大 batch | 4 / 4 | 建议 1~2 |
| 卸载/量化 | CPU offload + INT8 默认开 | 视内存情况 |

### 5070 的优势

1. **vllm 后端只有 CUDA 能吃**，LM（Chain-of-Thought 规划）速度差距是量级级别。
2. 官方有 **Windows 便携包**（已锁 CUDA 12.8），解压即用，不用折腾 Python 环境。
3. 生态完整：ComfyUI、LoRA 训练、量化工具全都按 CUDA 走的。
4. 时长上限 8 分钟，比 Mac 路径宽松得多。

### 5070 的短板

1. **12GB 天花板**：XL 4B DiT 只是"勉强可用"，要顶配音质还是不够，真想要就得上 16GB+。
2. 显存是和桌面共享的——**开游戏/浏览器硬件加速会直接被吃**，批量生成时务必关掉。
3. 长歌靠 offload，速度会掉。

### Blackwell（RTX 50 系）必踩的坑

5070 是 `sm_120` 架构，**老版 PyTorch（cu126 及以下）会直接报**：

```
CUDA error: no kernel image is available for execution on the device
```

处理：
- 首选**官方 Windows 便携包**（内置 CUDA 12.8，天生支持 sm_120）
- 自己装的话必须确认 torch 是 **cu128 或 cu130** 轮子，驱动 ≥ 570

### Windows 侧启动

```bat
REM 解压官方 ACE-Step-1.5.7z 后
set LANGUAGE=zh
set DOWNLOAD_SOURCE=--download-source modelscope
set LM_MODEL_PATH=--lm_model_path acestep-5Hz-lm-1.7B
start_gradio_ui.bat
```

12GB 卡不要删 `PYTORCH_CUDA_ALLOC_CONF`，保留分片策略更稳：

```bat
set PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
```

### 两台机器的分工

| 机器 | 角色 |
|---|---|
| 5070 台式机 | 批量生成（一晚 40~60 首）、跑 XL 试验、LoRA 训练 |
| M2 | 审听挑片、ffmpeg 后处理、上传 RustFS/S3、外出时轻量生成 |

---

## 附录 B：零乐理也能出"能听"的歌

### 为什么不需要乐理

模型已经把**编曲、配器、人声演唱、混音**全部吃掉，你只负责两件事：

1. **点菜**：用风格词告诉它要什么味道（prompt）
2. **给词**：提供中文歌词（lyrics）

乐理是用来"判断和微调"的，不是入场券。判断标准就一条：**你自己愿不愿意循环听**。

### prompt 就是点菜单：五个槽位

| 槽位 | 填什么 | 常用词 |
|---|---|---|
| genre | 曲风 | `chinese pop` / `mandopop ballad` / `city pop` / `lofi` / `folk` / `ambient` / `electronic` / `r&b` |
| era | 年代感 | `80s` / `90s` / `2010s` / `modern` / `retro` |
| vocal | 人声 | `female vocal` / `male vocal` / `breathy female` / `warm male` / `instrumental (no vocal)` |
| instrumentation | 乐器 | `piano` / `acoustic guitar` / `strings` / `synth pad` / `bass + drums` / `minimal` |
| mood + mix | 情绪与混音 | `calm` / `nostalgic` / `upbeat` / `melancholic` + `clean studio mix` / `warm mix` |

拼起来就是一条能用的 prompt，例如：

```
mandopop ballad, 2010s, breathy female vocal, piano and strings, melancholic, clean studio mix
```

### 四步工作流

1. 从上面模板挑一条（不用自己想）
2. `lyrics` 换成本次要唱的中文词（用 LM Studio 批量生成）
3. 固定 `seed`，先出 3 个候选
4. **只改一个槽位**（比如 vocal 从 female 换 male），再出 3 个——这样才能知道是哪个词起了作用

### 不懂乐理也能判断的四件事

- 人声是否清楚压过伴奏（混音失衡就降 `guidance_scale` 重跑）
- 有没有爆音/电流声（有就弃）
- 副歌和主歌有没有区分（没有就调整歌词分段标记）
- 2 分钟以后是不是开始糊（是就缩短时长）

---

## 附录 C：喜欢的歌，能给 AI "套"吗？

分三条线，一条能走、一条别走、一条红线。

### ✅ 可以：把它拆成形容词

**音乐风格本身不受著作权保护**，所以"我要一首像某首歌那种味道的歌"是合法的。做法是把原曲拆成属性：

| 你喜欢的点 | 对应 prompt 槽位 |
|---|---|
| 听着很怀旧、慢 | `mood: nostalgic, slow` |
| 有钢琴和提琴 | `instrumentation: piano + strings` |
| 女声气声唱法 | `vocal: breathy female` |
| 像十年前的华语抒情 | `genre: mandopop ballad, era: 2010s` |
| 编曲干净不吵 | `mix: clean studio mix` |

得到的是**新歌**，只是气质接近。这就是合法的"套"。

### ⚠️ 别走：喂原曲音频 / 用原歌词

- 把原曲 mp3 当参考音频喂给模型（ACE-Step 有 extract / lego / complete 这类音频编辑能力，技术上做得到）——对他人版权录音做参考，属于复制/改编风险。
- 直接拿原曲歌词来唱——**歌词是文字作品**，单独有著作权，跟曲子是两回事。想唱就只能自己写或让 LM Studio 写。

### ❌ 红线：这四种一定别碰

1. 旋律走向做到"一听就是那首歌"（改编权）
2. 复刻某位歌手的音色（人格权 + 不正当竞争，这是最容易被投诉的一种）
3. 直接混用原曲音频片段
4. prompt 里写"模仿某某歌手 / 某某歌曲"

### 你的实际做法

想用某首歌的感觉，就把歌名告诉我，我帮你把它拆成上表那五个槽位——**你拿到的是一组形容词，不是那首歌**。这条路零乐理、零风险，效果还比硬套好。

---

## 附录 D：案例拆解 —— 周深《浮光》

### 原曲事实（拆解依据）

- 原曲是纯音乐 **《The History》**（Jannik 作曲，2019 年发行），2023-12-31 由唐思淼、邹念慈填词、**曾吴秋杰编曲**、周深演唱成单曲《浮光》
- 编曲思路是"古与今的融合"：在原有电子元素上加入**管弦乐、箫、笛子**，用来托住副歌的大气恢弘
- 演唱：弱混声 + 头声铺出缥缈感，副歌转强声穿透，真假音无缝切换
- 结构：空灵吟唱前奏 → 叙事感主歌 → 层层递进的副歌 → 反复记号尾声；BPM 120，中快板
- 你被打动的"间奏"，本质是**箫/笛与管弦乐层层攀升的推进段**

### 槽位拆解

| 槽位 | 值 | 为什么这么写 |
|---|---|---|
| genre | `cinematic mandopop, orchestral pop` | 电影感 + 流行底子，对应"大气恢弘" |
| instrumentation | `piano, full strings, xiao flute, dizi flute, subtle synth pad` | 箫/笛是关键辨识点，synth 对应"古与今" |
| vocal | `ethereal male vocal, breathy mix voice, seamless falsetto` | 弱混声 + 头声 + 真假音 |
| mood | `majestic, nostalgic, vast, uplifting` | 燃与柔并存 |
| mix | `wide cinematic mix, deep reverb, dynamic build` | 副歌要能"炸开" |
| era / tempo | `modern, mid-tempo` | BPM 120 附近 |

### 整首歌 prompt（可直接粘贴）

```
cinematic mandopop with orchestral pop backing, ethereal male vocal with breathy mix
voice and seamless falsetto, piano bed, full string section, xiao and dizi flute lines,
subtle synth pad underneath, majestic and nostalgic, dynamic build into powerful chorus,
wide cinematic mix with deep reverb, mid-tempo
```

歌词自己写（原词不可用），`guidance_scale` 7.5–8.5，`duration` 90–120s。

### 只做"间奏"的纯器乐 prompt（更推荐先试这个）

你想复刻的是那段的推进感，那就干脆做纯器乐——**没有歌词，也没有人声模仿风险**：

```
instrumental only, no vocal, cinematic orchestral interlude, xiao and dizi flute melody
rising over full strings, piano pulse underneath, layered crescendo, ancient-meets-modern
texture with subtle electronic pad, wide reverb, majestic and uplifting swell
```

参数：`duration` 45–60s，`guidance_scale` 8–9，固定 `seed` 出 4 版挑一版。这首原曲本来就是纯音乐改编的，**做器乐版既最像、也最安全**。

### 提醒

- 不要用原曲歌词，也不要把原曲音频喂给模型当参考
- 不要把"周深"写进 prompt（复刻音色是红线），用"ethereal male vocal, breathy mix voice"描述即可


