<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  open: Boolean,
  t: {
    type: Function,
    required: true
  },
  settings: {
    type: Object,
    required: true
  },
  auth: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['close', 'save', 'choose-directory', 'logout']);
const draft = ref({ ...props.settings });

watch(
  () => props.settings,
  (value) => {
    draft.value = { ...value };
  },
  { deep: true }
);
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <section class="panel">
      <h2>{{ t('settingsTitle') }}</h2>
      <label>
        {{ t('interval') }}
        <input v-model.number="draft.syncIntervalMinutes" min="1" type="number" />
      </label>
      <label>
        {{ t('repoRoot') }}
        <div class="row">
          <input v-model="draft.repoRoot" type="text" />
          <button @click="emit('choose-directory')">{{ t('browse') }}</button>
        </div>
      </label>
      <label>
        {{ t('language') }}
        <select v-model="draft.language">
          <option value="zh-CN">{{ t('langZh') }}</option>
          <option value="en">{{ t('langEn') }}</option>
        </select>
      </label>
      <label>
        {{ t('background') }}
        <select v-model="draft.backgroundTheme">
          <option value="paper-dawn">{{ t('themeDawn') }}</option>
          <option value="forest-mist">{{ t('themeForest') }}</option>
          <option value="night-desk">{{ t('themeNight') }}</option>
        </select>
      </label>
      <section class="account" v-if="auth.isLoggedIn">
        <img :src="auth.user?.avatarUrl" alt="" />
        <div>
          <strong>{{ auth.user?.login }}</strong>
          <p>{{ t('accountHint') }}</p>
        </div>
      </section>
      <div class="actions">
        <button class="secondary" @click="emit('close')">{{ t('cancel') }}</button>
        <button class="secondary danger" @click="emit('logout')">{{ t('logout') }}</button>
        <button class="primary" @click="emit('save', draft.value)">{{ t('save') }}</button>
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
  width: min(560px, calc(100vw - 40px));
  display: grid;
  gap: 18px;
  padding: 28px;
  border-radius: 22px;
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

select {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px 12px;
  background: white;
}

.row {
  display: flex;
  gap: 10px;
}

.account {
  display: flex;
  gap: 12px;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 12px;
}

img {
  width: 52px;
  height: 52px;
  border-radius: 50%;
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

.secondary {
  background: #f3ede2;
}

.danger {
  color: #8c2512;
}
</style>
