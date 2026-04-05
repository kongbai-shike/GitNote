<script setup>
defineProps({
  repos: {
    type: Array,
    default: () => []
  },
  currentRepoId: {
    type: String,
    default: ''
  },
  t: {
    type: Function,
    required: true
  }
});

const emit = defineEmits(['switch', 'manage']);
</script>

<template>
  <div class="repo-selector">
    <select :value="currentRepoId" @change="emit('switch', $event.target.value)">
      <option value="">{{ t('notes') }}</option>
      <option v-for="repo in repos" :key="repo.id" :value="repo.id">
        {{ repo.name }}
      </option>
    </select>
    <button class="manage-btn" @click="emit('manage')">+</button>
  </div>
</template>

<style scoped>
.repo-selector {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
}

select {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 10px 12px;
  background: white;
}

.manage-btn {
  min-width: 42px;
  border-radius: 14px;
}
</style>
