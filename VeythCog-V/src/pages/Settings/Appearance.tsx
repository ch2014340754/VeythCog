import React, { useState } from 'react';
import { Button, message, Segmented, Slider, Switch } from 'antd';
import { Icon } from '@iconify/react';
import sunIcon from '@iconify-icons/lucide/sun';
import moonIcon from '@iconify-icons/lucide/moon';
import monitorIcon from '@iconify-icons/lucide/monitor';
import glassIcon from '@iconify-icons/lucide/droplets';
import imageIcon from '@iconify-icons/lucide/image';
import checkIcon from '@iconify-icons/lucide/check';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettingsStore } from '@/stores/settingsStore';
import { useWallpaperStore } from '@/stores/wallpaperStore';
import { useSelectionAskStore } from '@/stores/selectionAskStore';
import { clearQuickAiCache as clearQuickAiRemoteCache } from '@/api/quickAi';
import { clearQuickAiLocalCache, countQuickAiLocalCache } from '@/utils/quickAiCache';
import textSelectIcon from '@iconify-icons/lucide/text-select';
import WallpaperManagerModal from '@/components/WallpaperManagerModal';
import WallpaperMedia from '@/components/WallpaperMedia';
import { getPreset, presetNames } from '@/styles/presets';
import { BUILTIN_BACKGROUNDS, parseBackground } from '@/styles/backgrounds';
import type { AppearanceMode } from '@/types';
import PageHeader from '@/components/PageHeader';

const AppearancePage: React.FC = () => {
  const { presetName, appearanceMode, isDark, setPreset, setAppearance } = useTheme();
  const glassEnabled = useSettingsStore((s) => s.glassEnabled);
  const setGlassEnabled = useSettingsStore((s) => s.setGlassEnabled);
  const glassOpacity = useSettingsStore((s) => s.glassOpacity);
  const setGlassOpacity = useSettingsStore((s) => s.setGlassOpacity);
  const background = useSettingsStore((s) => s.background);
  const setBackground = useSettingsStore((s) => s.setBackground);
  const overlayOpacity = useSettingsStore((s) => s.overlayOpacity);
  const setOverlayOpacity = useSettingsStore((s) => s.setOverlayOpacity);

  // 划词 AI：开关 + 缓存治理（本地 24h + 后端 TTL，两边一起清）
  const selectionAskEnabled = useSelectionAskStore((s) => s.enabled);
  const setSelectionAskEnabled = useSelectionAskStore((s) => s.setEnabled);
  const [cacheCount, setCacheCount] = useState(() => countQuickAiLocalCache());
  const [clearingCache, setClearingCache] = useState(false);

  const clearSelectionAskCache = async () => {
    setClearingCache(true);
    clearQuickAiLocalCache();
    try {
      await clearQuickAiRemoteCache();
    } catch {
      // 后端不可用时本地已清，够用；不打断用户
    }
    setCacheCount(0);
    setClearingCache(false);
    message.success('划词缓存已清空（本地 + 服务端）');
  };

  // 全站唯一壁纸（S3，与账号绑定）
  const activeWallpaper = useWallpaperStore((s) => s.active);
  const clearWallpaper = useWallpaperStore((s) => s.clear);
  const [wallpaperOpen, setWallpaperOpen] = useState(false);

  const parsedBg = parseBackground(background);

  /** 选择纯色/渐变兜底：同时清空壁纸，避免两套背景并存 */
  const applyFallback = (id: string | null) => {
    setBackground(id ? `preset:${id}` : 'none');
    if (activeWallpaper) clearWallpaper();
  };

  const appearanceOptions: { label: React.ReactNode; value: AppearanceMode }[] = [
    { label: (<span className="vc-seg-label"><Icon icon={sunIcon} width={14} /> 亮色</span>), value: 'light' },
    { label: (<span className="vc-seg-label"><Icon icon={moonIcon} width={14} /> 暗色</span>), value: 'dark' },
    { label: (<span className="vc-seg-label"><Icon icon={monitorIcon} width={14} /> 系统</span>), value: 'system' },
  ];

  const activePreset = getPreset(presetName, isDark);

  return (
    <div>
      <PageHeader
        title="外观"
        flow={false}
      />

      <div className="vc-stack">
        {/* 配色预设 */}
        <section className="vc-panel">
          <div className="vc-panel__head">
            <div>
              <h2 className="vc-panel__title">配色预设</h2>
              <p className="vc-panel__desc">预设同时包含亮色/暗色两套色板，切换后全站令牌同步更新</p>
            </div>
            <span className="vc-meta">共 {presetNames.length} 套 · 当前：{activePreset.label}</span>
          </div>
          <div className="vc-theme-row">
            {presetNames.map((name) => {
              const preset = getPreset(name, isDark);
              const active = presetName === name;
              return (
                <div key={name} className="vc-theme-item">
                  <button
                    type="button"
                    onClick={() => setPreset(name)}
                    className={`vc-theme-swatch${active ? ' is-active' : ''}`}
                    style={{
                      background: preset.primary,
                      borderColor: active ? 'var(--color-text)' : 'transparent',
                    }}
                    title={`${preset.label}（主色 + 撞色）`}
                    aria-label={preset.label}
                    aria-pressed={active}
                  >
                    {active && <Icon icon={checkIcon} width={16} color="var(--color-text-inverse)" />}
                    <span
                      className="vc-theme-swatch__accent"
                      style={{ background: preset.accent }}
                      aria-hidden
                    />
                  </button>
                  <span className={`vc-theme-name${active ? ' is-active' : ''}`}>{preset.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* 外观模式 */}
        <section className="vc-panel">
          <div className="vc-panel__head">
            <div>
              <h2 className="vc-panel__title">外观模式</h2>
              <p className="vc-panel__desc">「系统」模式跟随操作系统亮暗设置自动切换</p>
            </div>
          </div>
          <Segmented
            className="vc-segmented"
            value={appearanceMode}
            options={appearanceOptions}
            onChange={(val) => setAppearance(val as AppearanceMode)}
            block
          />
        </section>

        {/* 背景 */}
        <section className="vc-panel">
          <div className="vc-panel__head">
            <div>
              <h2 className="vc-panel__title">背景</h2>
              <p className="vc-panel__desc">壁纸与纯色兜底共用一套背景系统，二者互斥</p>
            </div>
          </div>

          <div className="vc-bg-current">
            <div className="vc-bg-current__preview">
              {activeWallpaper ? (
                <WallpaperMedia item={activeWallpaper} />
              ) : (
                <span className="vc-meta">纯色兜底</span>
              )}
            </div>
            <div className="vc-bg-current__info">
              <div className="vc-bg-current__title">
                {activeWallpaper ? (activeWallpaper.kind === 'video' ? '动态壁纸' : '静态壁纸') : '未设置壁纸'}
              </div>
              <div className="vc-meta">全站共用一张壁纸，切换页面不会变化；选好后保存到你的账号</div>
              <div className="vc-toolbar" style={{ marginTop: 10 }}>
                <Button type="primary" onClick={() => setWallpaperOpen(true)}>壁纸管理</Button>
                {activeWallpaper && <Button onClick={() => clearWallpaper()}>清除壁纸</Button>}
              </div>
            </div>
          </div>

          <div className="vc-field-label" style={{ marginTop: 4 }}>纯色兜底</div>
          <div className="vc-bg-row">
            <BgCard
              active={parsedBg.kind === 'none' && !activeWallpaper}
              label="默认"
              onClick={() => applyFallback(null)}
            >
              <div className="vc-bg-swatch__default">
                <Icon icon={imageIcon} width={16} />
              </div>
            </BgCard>
            {BUILTIN_BACKGROUNDS.map((bg) => {
              const active = parsedBg.kind === 'preset' && parsedBg.id === bg.id && !activeWallpaper;
              return (
                <BgCard key={bg.id} active={active} label={bg.label} onClick={() => applyFallback(bg.id)}>
                  <div
                    className="vc-bg-swatch__fill"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${bg.swatch[0]} 0%, ${bg.swatch[1]} 50%, ${bg.swatch[2]} 100%)`,
                    }}
                  />
                </BgCard>
              );
            })}
          </div>

          <div className="vc-setting-row" style={{ marginTop: 20 }}>
            <div className="vc-setting-row__label">
              <span>壁纸遮罩强度</span>
              <span className="vc-meta vc-num">{overlayOpacity}%</span>
            </div>
            <Slider min={0} max={100} value={overlayOpacity} onChange={setOverlayOpacity} />
            <div className="vc-hint">
              0 为完全不加遮罩；调高可压暗壁纸，确保文字清晰可读，对静态与动态壁纸都生效。
            </div>
          </div>
        </section>

        {/* 全局毛玻璃 */}
        <section className="vc-panel">
          <div className="vc-panel__head">
            <div className="vc-setting-row__title">
              <Icon icon={glassIcon} width={18} />
              <div>
                <h2 className="vc-panel__title">全局毛玻璃</h2>
                <p className="vc-panel__desc">
                  卡片、弹层启用毛玻璃质感；输入框与按钮 hover 仅做边缘毛玻璃，避免文字发虚
                </p>
              </div>
            </div>
            <Switch checked={glassEnabled} onChange={setGlassEnabled} />
          </div>
          <div className="vc-setting-row">
            <div className="vc-setting-row__label">
              <span>面板玻璃朦胧感</span>
              <span className="vc-meta vc-num">{glassOpacity}%</span>
            </div>
            <Slider min={0} max={90} value={glassOpacity} onChange={setGlassOpacity} />
            <div className="vc-hint">
              往左拖背景图越清晰，往右拖毛玻璃感越明显，背景始终隐约透出。
            </div>
          </div>
        </section>

        {/* 划词 AI */}
        <section className="vc-panel">
          <div className="vc-panel__head">
            <div className="vc-setting-row__title">
              <Icon icon={textSelectIcon} width={18} />
              <div>
                <h2 className="vc-panel__title">划词 AI</h2>
                <p className="vc-panel__desc">
                  选中任意文字后浮出「解释 / 翻译 / 润色 / 问 / 存入知识库」；只在有鼠标的设备生效
                </p>
              </div>
            </div>
            <Switch checked={selectionAskEnabled} onChange={setSelectionAskEnabled} />
          </div>
          <div className="vc-setting-row">
            <div className="vc-setting-row__label">
              <span>结果缓存</span>
              <span className="vc-meta vc-num">本地 {cacheCount} 条</span>
            </div>
            <div className="vc-hint">
              解释/翻译/润色的结果缓存 24 小时，同一段文字再选一次直接出结果，不重复花 token。
              「问」和开启知识库检索的答案不缓存。
            </div>
            <div className="vc-toolbar" style={{ marginTop: 8 }}>
              <Button size="small" loading={clearingCache} onClick={() => void clearSelectionAskCache()}>
                清空缓存
              </Button>
              <Button size="small" type="text" onClick={() => setCacheCount(countQuickAiLocalCache())}>
                刷新计数
              </Button>
            </div>
          </div>
        </section>
      </div>

      <WallpaperManagerModal open={wallpaperOpen} onClose={() => setWallpaperOpen(false)} />
    </div>
  );
};

/** 内置背景缩略图卡片 */
function BgCard(props: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const { active, label, onClick } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`vc-bg-swatch${active ? ' is-active' : ''}`}
      aria-label={label}
    >
      <div className="vc-bg-swatch__inner">{props.children}</div>
      {active && (
        <span className="vc-bg-swatch__check">
          <Icon icon={checkIcon} width={10} color="var(--color-text-inverse)" />
        </span>
      )}
    </button>
  );
}

export default AppearancePage;
