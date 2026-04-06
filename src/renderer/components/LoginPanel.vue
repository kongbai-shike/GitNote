<script setup>
import { Cloud, Github, HardDriveDownload, Sparkles } from 'lucide-vue-next';

defineProps({
  t: { type: Function, required: true }
});
</script>

<template>
  <section class="login-panel">
    <div class="hero-copy">
      <p class="eyebrow">GitNote</p>
      <h1>{{ t('loginWorkspace') }}</h1>
      <p class="description">{{ t('welcomeDesc') }}</p>
    </div>

    <div class="hero-grid">
      <div class="glass-card hero-card">
        <div class="icon-wrap"><Sparkles :size="22" /></div>
        <h2>{{ t('welcomeTitle') }}</h2>
        <p>{{ t('workspaceHint') }}</p>
      </div>
      <div class="glass-card feature-card">
        <div class="feature-item"><Github :size="18" /><span>{{ t('githubSync') }}</span></div>
        <div class="feature-item"><HardDriveDownload :size="18" /><span>{{ t('localMode') }}</span></div>
        <div class="feature-item"><Cloud :size="18" /><span>{{ t('supportedFormats') }}</span></div>
      </div>
    </div>

    <div class="actions">
      <button class="primary" @click="$emit('github-login')"><Github :size="18" />{{ t('loginGithub') }}</button>
      <button class="secondary" @click="$emit('local-only')"><HardDriveDownload :size="18" />{{ t('localOnly') }}</button>
    </div>
  </section>
</template>

<style scoped>
.login-panel {
  width: min(980px, calc(100vw - 48px));
  display: grid;
  gap: 28px;
  padding: 40px;
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--panel-strong) 86%, transparent);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-panel);
}
.eyebrow {
  margin: 0 0 12px;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: .22em;
  font-size: 12px;
  font-weight: 700;
}
h1 { margin: 0; font-size: clamp(44px, 7vw, 76px); line-height: .96; max-width: 10ch; }
.description { max-width: 60ch; color: var(--muted); line-height: 1.7; font-size: 16px; }
.hero-grid { display: grid; grid-template-columns: 1.2fr .8fr; gap: 18px; }
.glass-card {
  display: grid;
  gap: 14px;
  padding: 22px;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-elevated) 86%, transparent);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-soft);
}
.icon-wrap {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: var(--accent-soft);
  color: var(--accent-strong);
}
.hero-card h2 { margin: 0; font-size: 22px; }
.hero-card p, .feature-card { color: var(--muted); line-height: 1.7; }
.feature-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; }
.actions { display: flex; gap: 14px; flex-wrap: wrap; }
.primary, .secondary {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: none;
  border-radius: 999px;
  padding: 14px 20px;
}
.primary { background: var(--accent); color: white; }
.secondary { background: var(--button-muted-bg); color: var(--button-muted-text); }
@media (max-width: 820px) {
  .login-panel { width: calc(100vw - 20px); padding: 24px; }
  .hero-grid { grid-template-columns: 1fr; }
}
</style>
