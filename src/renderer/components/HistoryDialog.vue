<script setup>
import { ref } from 'vue';

defineProps({
  open: Boolean,
  t: {
    type: Function,
    required: true
  },
  entries: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['close', 'preview', 'restore']);
const selected = ref(null);
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <section class="panel">
      <header class="panel-header">
        <div>
          <p class="eyebrow">{{ t('versionHistory') }}</p>
          <h2>{{ t('versionHistory') }}</h2>
        </div>
        <button class="ghost-button" @click="emit('close')">{{ t('close') }}</button>
      </header>

      <div class="layout">
        <aside class="history-list">
          <button
            v-for="entry in entries"
            :key="entry.sha"
            class="history-item"
            :class="{ active: selected?.sha === entry.sha }"
            @click="selected = entry; emit('preview', entry)"
          >
            <strong>{{ entry.message }}</strong>
            <span>{{ entry.author }} · {{ entry.date }}</span>
          </button>
          <p v-if="!entries.length" class="empty-state">暂无历史版本</p>
        </aside>

        <section class="preview">
          <slot :selected="selected">
            <div class="preview-placeholder">
              <p>{{ selected ? selected.message : '从左侧选择一个版本以查看内容。' }}</p>
            </div>
          </slot>
        </section>
      </div>

      <div class="actions">
        <button class="ghost-button" @click="emit('close')">{{ t('close') }}</button>
        <button class="primary" :disabled="!selected" @click="emit('restore', selected)">{{ t('restore') }}</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(3, 8, 20, 0.56);
  backdrop-filter: blur(8px);
}

.panel {
  width: min(980px, 100%);
  height: min(720px, 100%);
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 14px;
  padding: 20px;
  border-radius: 20px;
  border: 1px solid var(--line);
  background: var(--panel);
  box-shadow: var(--shadow);
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow {
  margin: 0 0 4px;
  color: var(--muted);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h2 {
  margin: 0;
  color: var(--text);
  font-size: 22px;
}

.layout {
  min-height: 0;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 14px;
}

.history-list,
.preview {
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 10px;
  background: color-mix(in srgb, var(--panel-strong) 84%, transparent);
}

.history-list {
  display: grid;
  align-content: start;
  gap: 8px;
}

.history-item {
  width: 100%;
  display: grid;
  gap: 6px;
  text-align: left;
  padding: 10px 12px;
  margin: 0;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--text);
  box-shadow: none;
}

.history-item strong {
  color: var(--text);
  font-size: 13px;
  line-height: 1.4;
}

.history-item span {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
}

.history-item:hover {
  border-color: color-mix(in srgb, var(--accent) 36%, var(--line));
  background: color-mix(in srgb, var(--panel-strong) 92%, transparent);
  transform: none;
}

.history-item.active {
  border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  background: color-mix(in srgb, var(--accent) 12%, var(--panel));
  box-shadow: inset 2px 0 0 var(--accent);
}

.preview {
  color: var(--text);
}

.preview-placeholder,
.empty-state {
  display: grid;
  place-items: center;
  min-height: 100%;
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  text-align: center;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.ghost-button,
.primary {
  min-width: 88px;
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
}

.ghost-button {
  border: 1px solid var(--line);
  background: var(--panel-strong);
  color: var(--text);
  box-shadow: none;
}

.ghost-button:hover {
  transform: none;
  background: color-mix(in srgb, var(--panel) 72%, transparent);
}

.primary {
  background: var(--accent);
  color: white;
  border: none;
  box-shadow: none;
}

.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .panel {
    height: min(760px, 100%);
    padding: 16px;
  }

  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
