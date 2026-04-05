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
      <header>
        <h2>{{ t('versionHistory') }}</h2>
      </header>
      <div class="layout">
        <aside>
          <button
            v-for="entry in entries"
            :key="entry.sha"
            class="history-item"
            @click="selected = entry; emit('preview', entry)"
          >
            <strong>{{ entry.message }}</strong>
            <span>{{ entry.author }} · {{ entry.date }}</span>
          </button>
        </aside>
        <section class="preview">
          <slot :selected="selected" />
        </section>
      </div>
      <div class="actions">
        <button @click="emit('close')">{{ t('close') }}</button>
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
  background: rgba(39, 29, 16, 0.24);
}

.panel {
  width: min(1040px, calc(100vw - 40px));
  height: min(760px, calc(100vh - 40px));
  display: grid;
  gap: 16px;
  padding: 24px;
  border-radius: 24px;
  background: white;
}

.layout {
  min-height: 0;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
}

aside,
.preview {
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 12px;
}

.history-item {
  width: 100%;
  display: grid;
  gap: 4px;
  text-align: left;
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: #fffaf2;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.primary {
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 999px;
  padding: 10px 18px;
}
</style>
