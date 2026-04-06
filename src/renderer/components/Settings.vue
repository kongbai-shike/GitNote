<script setup>
import { ref, watch } from 'vue';
import { FolderOpen, Globe, Monitor, Moon, Paintbrush2, RefreshCw, Sun, UserRound } from 'lucide-vue-next';

const props = defineProps({
  open: Boolean,
  t: { type: Function, required: true },
  settings: { type: Object, required: true },
  auth: { type: Object, required: true }
});

const emit = defineEmits(['close', 'save', 'choose-directory', 'logout']);
const draft = ref({ ...props.settings });

watch(() => props.settings, (value) => { draft.value = { ...value }; }, { deep: true });

function saveDraft() {
  emit('save', {
    ...draft.value,
    syncIntervalMinutes: Number(draft.value.syncIntervalMinutes) > 0 ? Number(draft.value.syncIntervalMinutes) : 2,
    repoRoot: draft.value.repoRoot?.trim() || props.settings.repoRoot || '',
    language: draft.value.language || 'zh-CN',
    backgroundTheme: draft.value.backgroundTheme || 'paper-dawn',
    themeMode: draft.value.themeMode || 'system'
  });
}
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <section class="panel">
      <header class="panel-head">
        <div>
          <p class="eyebrow">{{ t('settings') }}</p>
          <h2>{{ t('settingsTitle') }}</h2>
        </div>
        <button class="ghost" @click="emit('close')">{{ t('close') }}</button>
      </header>

      <div class="settings-grid">
        <label class="field">
          <span class="field-label"><RefreshCw :size="16" />{{ t('interval') }}</span>
          <input v-model.number="draft.syncIntervalMinutes" min="1" type="number" />
        </label>

        <label class="field field-wide">
          <span class="field-label"><FolderOpen :size="16" />{{ t('repoRoot') }}</span>
          <div class="path-row">
            <input v-model="draft.repoRoot" type="text" />
            <button class="ghost" @click="emit('choose-directory')">{{ t('browse') }}</button>
          </div>
        </label>

        <label class="field">
          <span class="field-label"><Globe :size="16" />{{ t('language') }}</span>
          <select v-model="draft.language">
            <option value="zh-CN">{{ t('langZh') }}</option>
            <option value="en">{{ t('langEn') }}</option>
          </select>
        </label>

        <label class="field">
          <span class="field-label"><Paintbrush2 :size="16" />{{ t('background') }}</span>
          <select v-model="draft.backgroundTheme">
            <option value="paper-dawn">{{ t('themeDawn') }}</option>
            <option value="forest-mist">{{ t('themeForest') }}</option>
            <option value="night-desk">{{ t('themeNight') }}</option>
          </select>
        </label>

        <div class="field field-wide">
          <span class="field-label"><Monitor :size="16" />{{ t('themeMode') }}</span>
          <div class="theme-mode-row">
            <button :class="['mode-chip', { active: draft.themeMode === 'light' }]" @click="draft.themeMode = 'light'"><Sun :size="16" />{{ t('themeLight') }}</button>
            <button :class="['mode-chip', { active: draft.themeMode === 'dark' }]" @click="draft.themeMode = 'dark'"><Moon :size="16" />{{ t('themeDark') }}</button>
            <button :class="['mode-chip', { active: draft.themeMode === 'system' }]" @click="draft.themeMode = 'system'"><Monitor :size="16" />{{ t('themeSystem') }}</button>
          </div>
        </div>
      </div>

      <section v-if="auth.isLoggedIn" class="account">
        <img :src="auth.user?.avatarUrl" alt="" />
        <div class="account-copy">
          <p class="eyebrow">{{ t('githubSync') }}</p>
          <strong><UserRound :size="16" />{{ auth.user?.login }}</strong>
          <p>{{ t('accountHint') }}</p>
        </div>
      </section>

      <div class="actions">
        <button class="ghost" @click="emit('close')">{{ t('cancel') }}</button>
        <button v-if="auth.isLoggedIn" class="danger" @click="emit('logout')">{{ t('logout') }}</button>
        <button class="primary" @click="saveDraft">{{ t('save') }}</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(2, 6, 23, 0.48); backdrop-filter: blur(10px); z-index: 70; }
.panel {
  width: min(720px, calc(100vw - 40px));
  max-height: calc(100vh - 40px);
  overflow: auto;
  display: grid;
  gap: 22px;
  padding: 28px;
  border-radius: var(--radius-xl);
  background: var(--panel-strong);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-panel);
}
.panel-head, .actions, .path-row, .theme-mode-row, .field-label, .account strong { display: flex; align-items: center; gap: 10px; }
.panel-head, .actions { justify-content: space-between; }
.eyebrow { margin: 0 0 6px; color: var(--accent); text-transform: uppercase; letter-spacing: .18em; font-size: 11px; font-weight: 700; }
h2 { margin: 0; }
.settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.field { display: grid; gap: 10px; }
.field-wide { grid-column: 1 / -1; }
.field-label { color: var(--muted); font-size: 13px; font-weight: 600; }
input, select {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  background: var(--field-bg);
  color: var(--field-text);
  outline: none;
}
input:focus, select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.mode-chip, .ghost, .primary, .danger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: 999px;
  padding: 11px 16px;
}
.mode-chip { background: var(--button-muted-bg); color: var(--button-muted-text); }
.mode-chip.active { background: var(--accent-soft); color: var(--accent-strong); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 32%, transparent); }
.account {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 16px;
  padding: 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: color-mix(in srgb, var(--panel) 86%, transparent);
}
.account img { width: 64px; height: 64px; border-radius: 50%; }
.account-copy p { margin: 6px 0 0; color: var(--muted); line-height: 1.6; }
.actions { justify-content: flex-end; }
.ghost { background: var(--button-muted-bg); color: var(--button-muted-text); }
.primary { background: var(--accent); color: white; }
.danger { background: color-mix(in srgb, var(--error-bg) 82%, var(--panel-strong)); color: var(--error-text); }
@media (max-width: 720px) {
  .panel { width: calc(100vw - 20px); padding: 20px; }
  .settings-grid { grid-template-columns: 1fr; }
  .theme-mode-row, .actions, .path-row { flex-wrap: wrap; }
}
</style>
