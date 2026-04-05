<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
  open: Boolean,
  t: {
    type: Function,
    required: true
  },
  payload: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['resolve', 'close']);
const manualContent = ref('');

watch(
  () => props.payload,
  (value) => {
    manualContent.value = value?.local || '';
  },
  { immediate: true }
);

const fileLabel = computed(() => props.payload?.filePath || '');
</script>

<template>
  <div v-if="open && payload" class="overlay" @click.self="emit('close')">
    <section class="panel">
      <header>
        <h2>{{ t('conflict') }}</h2>
        <p>{{ fileLabel }}</p>
      </header>
      <div class="compare">
        <article>
          <h3>{{ t('localVersion') }}</h3>
          <pre>{{ payload.local }}</pre>
        </article>
        <article>
          <h3>{{ t('remoteVersion') }}</h3>
          <pre>{{ payload.remote }}</pre>
        </article>
      </div>
      <label>
        {{ t('manualMerge') }}
        <textarea v-model="manualContent" rows="12" />
      </label>
      <div class="actions">
        <button @click="emit('resolve', { strategy: 'local', filePath: payload.filePath })">{{ t('keepLocal') }}</button>
        <button @click="emit('resolve', { strategy: 'remote', filePath: payload.filePath })">{{ t('keepRemote') }}</button>
        <button class="primary" @click="emit('resolve', { strategy: 'manual', filePath: payload.filePath, content: manualContent.value })">
          {{ t('useManual') }}
        </button>
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
  width: min(1180px, calc(100vw - 40px));
  max-height: calc(100vh - 40px);
  overflow: auto;
  display: grid;
  gap: 18px;
  padding: 24px;
  background: white;
  border-radius: 24px;
}

.compare {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

article,
textarea {
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 12px;
  background: #fffaf2;
}

pre {
  white-space: pre-wrap;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

button {
  border: none;
  border-radius: 999px;
  padding: 10px 18px;
}

.primary {
  background: var(--accent);
  color: white;
}
</style>
