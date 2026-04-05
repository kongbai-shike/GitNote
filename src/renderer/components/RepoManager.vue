<script setup>
defineProps({
  open: Boolean,
  repos: {
    type: Array,
    default: () => []
  },
  t: {
    type: Function,
    required: true
  }
});

const emit = defineEmits(['close', 'remove']);
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <section class="panel">
      <h2>{{ t('repoManager') || 'Repository' }}</h2>
      <div class="repo-list">
        <article v-for="repo in repos" :key="repo.id" class="repo-card">
          <div>
            <strong>{{ repo.name }}</strong>
            <p>{{ repo.remoteUrl }}</p>
            <p>{{ repo.localPath }}</p>
          </div>
          <button class="danger" @click="emit('remove', repo.id)">{{ t('remove') || 'Remove' }}</button>
        </article>
      </div>
      <div class="actions">
        <button @click="emit('close')">{{ t('close') || 'Close' }}</button>
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
  width: min(760px, calc(100vw - 40px));
  max-height: calc(100vh - 40px);
  overflow: auto;
  display: grid;
  gap: 16px;
  padding: 24px;
  border-radius: 24px;
  background: var(--panel-strong);
}

label {
  display: grid;
  gap: 8px;
}

input {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px 12px;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
}

.repo-list {
  display: grid;
  gap: 12px;
}

.repo-card {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 14px;
}

.danger {
  color: #8c2512;
}
</style>
