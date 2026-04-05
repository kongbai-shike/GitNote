<script setup>
import { ref } from 'vue';

defineOptions({ name: 'FileTree' });

const props = defineProps({
  nodes: {
    type: Array,
    default: () => []
  },
  selected: {
    type: String,
    default: ''
  },
  depth: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['open', 'create', 'rename', 'delete', 'history']);
const openDirs = ref(new Set());

function toggle(path) {
  if (openDirs.value.has(path)) {
    openDirs.value.delete(path);
  } else {
    openDirs.value.add(path);
  }
}

function requestName(label, fallback = '') {
  return window.prompt(label, fallback)?.trim();
}

function onCreate(nodePath, type) {
  emit('create', nodePath, type);
}

function onRename(nodePath, oldName) {
  const nextName = requestName('Rename to', oldName);
  if (nextName) {
    emit('rename', nodePath, nextName);
  }
}

function forwardCreate(...args) {
  emit('create', ...args);
}

function forwardRename(...args) {
  emit('rename', ...args);
}
</script>

<template>
  <div class="tree">
    <div
      v-for="node in props.nodes"
      :key="node.path"
      class="node"
      :style="{ paddingLeft: `${props.depth * 14 + 12}px` }"
    >
      <div
        class="node-row"
        :class="{ active: props.selected === node.path }"
        @click="node.type === 'directory' ? toggle(node.path) : emit('open', node.path)"
        @contextmenu.prevent="emit('history', node)"
      >
        <span>{{ node.type === 'directory' ? (openDirs.has(node.path) ? 'v' : '>') : '-' }}</span>
        <span>{{ node.name }}</span>
        <div class="row-actions">
          <button @click.stop="onCreate(node.path, 'file')">+File</button>
          <button @click.stop="onCreate(node.path, 'directory')">+Folder</button>
          <button @click.stop="onRename(node.path, node.name)">Rename</button>
          <button @click.stop="emit('delete', node.path)">Delete</button>
        </div>
      </div>
      <FileTree
        v-if="node.type === 'directory' && openDirs.has(node.path)"
        :nodes="node.children"
        :selected="props.selected"
        :depth="props.depth + 1"
        @open="emit('open', $event)"
        @create="forwardCreate"
        @rename="forwardRename"
        @delete="emit('delete', $event)"
        @history="emit('history', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.tree {
  display: grid;
  gap: 2px;
}

.node-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  border-radius: 12px;
  padding: 6px 10px;
  cursor: pointer;
}

.node-row:hover,
.node-row.active {
  background: rgba(178, 74, 29, 0.12);
}

.row-actions {
  margin-left: auto;
  opacity: 0;
  display: flex;
  gap: 6px;
}

.node-row:hover .row-actions {
  opacity: 1;
}

button {
  border: 1px solid var(--line);
  border-radius: 999px;
  background: white;
  font-size: 12px;
  padding: 4px 8px;
}
</style>
