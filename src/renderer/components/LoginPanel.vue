<script setup>
defineProps({
  t: {
    type: Function,
    required: true
  }
});
</script>

<template>
  <section class="login-panel">
    <div class="hero">
      <p class="eyebrow">GitNote</p>
      <h1>{{ t('welcomeTitle') }}</h1>
      <p class="description">{{ t('welcomeDesc') }}</p>
    </div>
    <div class="actions">
      <button class="primary" @click="$emit('github-login')">{{ t('loginGithub') }}</button>
      <button class="secondary" @click="$emit('local-only')">{{ t('localOnly') }}</button>
    </div>
  </section>
</template>

<style scoped>
.login-panel {
  display: grid;
  gap: 28px;
  padding: 48px;
  border-radius: 28px;
  background: linear-gradient(145deg, rgba(255, 248, 238, 0.95), rgba(255, 255, 255, 0.8));
  box-shadow: var(--shadow);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--accent);
  margin: 0 0 12px;
}

h1 {
  margin: 0;
  font-size: 48px;
  line-height: 1;
  max-width: 10ch;
}

.description {
  color: var(--muted);
  max-width: 56ch;
  line-height: 1.6;
}

.actions {
  display: flex;
  gap: 16px;
}

button {
  border: none;
  border-radius: 999px;
  padding: 14px 22px;
  cursor: pointer;
}

.primary {
  background: var(--accent);
  color: white;
}

.secondary {
  background: rgba(255, 255, 255, 0.8);
  color: var(--text);
  border: 1px solid var(--line);
}
</style>
