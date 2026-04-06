<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

defineOptions({ name: 'FileTree' });

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  selected: { type: String, default: '' },
  depth: { type: Number, default: 0 },
  forceExpand: { type: Boolean, default: false },
  searchQuery: { type: String, default: '' },
  t: { type: Function, required: true }
});

const emit = defineEmits(['open', 'create', 'rename', 'delete', 'restore', 'purge', 'history']);
const openDirs = ref(new Set());
const menuState = ref({ path: '', x: 0, y: 0 });
const editingPath = ref('');
const editingName = ref('');
const renameInput = ref(null);

function isOpen(path) {
  return props.forceExpand || openDirs.value.has(path);
}

function toggle(path) {
  if (openDirs.value.has(path)) openDirs.value.delete(path);
  else openDirs.value.add(path);
}

function closeMenu() {
  menuState.value = { path: '', x: 0, y: 0 };
}

function onCreate(nodePath, type) {
  closeMenu();
  emit('create', nodePath, type);
}

async function startRename(nodePath, oldName) {
  closeMenu();
  editingPath.value = nodePath;
  editingName.value = oldName;
  await nextTick();
  renameInput.value?.focus();
  renameInput.value?.select?.();
}

function submitRename() {
  const nextName = editingName.value.trim();
  if (editingPath.value && nextName) emit('rename', editingPath.value, nextName);
  cancelRename();
}

function cancelRename() {
  editingPath.value = '';
  editingName.value = '';
}

function isTrashNode(nodePath) {
  return nodePath === '.trash' || nodePath.startsWith('.trash/');
}

function isTrashRoot(nodePath) {
  return nodePath === '.trash';
}

function displayName(node) {
  return isTrashRoot(node.path) ? '回收站' : node.name;
}

function fileBadge(node) {
  if (node.type === 'directory') return '';
  const ext = String(node.name.split('.').pop() || '').toLowerCase();
  if (!ext || ext === node.name.toLowerCase()) return 'TXT';
  return ext.slice(0, 4).toUpperCase();
}

function highlightedParts(name) {
  const keyword = props.searchQuery.trim();
  if (!keyword) return [{ text: name, match: false }];

  const lowerName = name.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const parts = [];
  let cursor = 0;

  while (cursor < name.length) {
    const index = lowerName.indexOf(lowerKeyword, cursor);
    if (index < 0) {
      parts.push({ text: name.slice(cursor), match: false });
      break;
    }
    if (index > cursor) parts.push({ text: name.slice(cursor, index), match: false });
    parts.push({ text: name.slice(index, index + keyword.length), match: true });
    cursor = index + keyword.length;
  }

  return parts;
}

function menuSections(node) {
  if (isTrashNode(node.path)) {
    if (isTrashRoot(node.path)) return [];
    return [[
      { key: 'restore', label: props.t('restore'), action: () => emit('restore', node.path) },
      { key: 'purge', label: props.t('purge'), action: () => emit('purge', node.path), danger: true }
    ]];
  }

  if (node.type === 'directory') {
    return [
      [
        {
          key: 'toggle',
          label: isOpen(node.path) ? props.t('collapseFolder') : props.t('expandFolder'),
          action: () => toggle(node.path)
        }
      ],
      [
        { key: 'create-file', label: props.t('createFile'), action: () => onCreate(node.path, 'file') },
        { key: 'create-folder', label: props.t('createFolder'), action: () => onCreate(node.path, 'directory') }
      ],
      [
        { key: 'rename', label: props.t('rename'), action: () => startRename(node.path, node.name) },
        { key: 'delete', label: props.t('delete'), action: () => emit('delete', node.path), danger: true }
      ]
    ];
  }

  return [
    [
      { key: 'open', label: props.t('openItem'), action: () => emit('open', node.path) }
    ],
    [
      { key: 'rename', label: props.t('rename'), action: () => startRename(node.path, node.name) },
      { key: 'delete', label: props.t('delete'), action: () => emit('delete', node.path), danger: true }
    ],
    [
      { key: 'history', label: props.t('versionHistory'), action: () => emit('history', node) }
    ]
  ];
}

function openMenu(event, node) {
  if (isTrashRoot(node.path)) {
    closeMenu();
    return;
  }

  const sections = menuSections(node);
  if (!sections.length) {
    closeMenu();
    return;
  }

  const maxX = window.innerWidth - 220;
  const maxY = window.innerHeight - 260;
  menuState.value = {
    path: node.path,
    x: Math.min(event.clientX, maxX),
    y: Math.min(event.clientY, maxY)
  };
}

function runMenuAction(action) {
  closeMenu();
  action();
}

function handleGlobalPointer(event) {
  if (!event.target.closest('.context-menu') && !event.target.closest('.menu-trigger')) closeMenu();
}

function forwardCreate(...args) {
  emit('create', ...args);
}

function forwardRename(...args) {
  emit('rename', ...args);
}

onMounted(() => {
  window.addEventListener('click', handleGlobalPointer);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleGlobalPointer);
});
</script>

<template>
  <div class="tree">
    <div
      v-for="node in props.nodes"
      :key="node.path"
      class="node"
      :style="{ paddingLeft: `${props.depth * 10 + 8}px` }"
    >
      <div
        class="node-row"
        :class="{ active: props.selected === node.path }"
        @click="node.type === 'directory' ? toggle(node.path) : emit('open', node.path)"
        @contextmenu.prevent="openMenu($event, node)"
      >
        <div class="node-main">
          <span class="node-toggle" :class="{ empty: node.type !== 'directory' }">
            {{ node.type === 'directory' ? (isOpen(node.path) ? '▾' : '▸') : '' }}
          </span>
          <span class="node-icon" :class="{ folder: node.type === 'directory', badge: node.type !== 'directory' }">
            <span v-if="node.type === 'directory'" class="folder-glyph" />
            <template v-else>{{ fileBadge(node) }}</template>
          </span>
          <input
            v-if="editingPath === node.path"
            ref="renameInput"
            v-model="editingName"
            class="rename-input"
            @click.stop
            @keyup.enter.stop="submitRename"
            @keyup.esc.stop="cancelRename"
            @blur="submitRename"
          />
          <span
            v-else
            class="node-name"
            :title="displayName(node)"
            @dblclick.stop="startRename(node.path, node.name)"
          >
            <template v-for="(part, index) in highlightedParts(displayName(node))" :key="`${node.path}-${index}`">
              <mark v-if="part.match" class="node-highlight">{{ part.text }}</mark>
              <span v-else>{{ part.text }}</span>
            </template>
          </span>
        </div>
        <button v-if="!isTrashRoot(node.path)" class="menu-trigger" @click.stop="openMenu($event, node)">...</button>
      </div>

      <div
        v-if="menuState.path === node.path && menuSections(node).length"
        class="context-menu"
        :style="{ left: `${menuState.x}px`, top: `${menuState.y}px` }"
      >
        <template v-for="(section, sectionIndex) in menuSections(node)" :key="`${node.path}-${sectionIndex}`">
          <div class="context-group">
            <button
              v-for="item in section"
              :key="item.key"
              :class="{ danger: item.danger }"
              @click.stop="runMenuAction(item.action)"
            >
              {{ item.label }}
            </button>
          </div>
          <div v-if="sectionIndex < menuSections(node).length - 1" class="context-divider" />
        </template>
      </div>

      <FileTree
        v-if="node.type === 'directory' && isOpen(node.path)"
        :nodes="node.children"
        :selected="props.selected"
        :depth="props.depth + 1"
        :force-expand="props.forceExpand"
        :search-query="props.searchQuery"
        :t="props.t"
        @open="emit('open', $event)"
        @create="forwardCreate"
        @rename="forwardRename"
        @delete="emit('delete', $event)"
        @restore="emit('restore', $event)"
        @purge="emit('purge', $event)"
        @history="emit('history', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.tree {
  display: grid;
  gap: 0;
  align-content: start;
  font-size: 12px;
}

.node {
  min-height: 0;
}

.node-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 24px;
  border-radius: 6px;
  padding: 2px 6px;
  cursor: pointer;
  border: 1px solid transparent;
}

.node-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
}

.node-toggle {
  width: 10px;
  flex: 0 0 10px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1;
  text-align: center;
}

.node-toggle.empty {
  color: transparent;
}

.node-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  flex: 0 0 24px;
}

.node-icon.badge {
  height: 16px;
  padding: 0 4px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--panel-strong) 90%, transparent);
  color: var(--muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--line) 86%, transparent);
}

.folder-glyph {
  position: relative;
  display: block;
  width: 14px;
  height: 10px;
  border-radius: 2px;
  background: #dcb14a;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
}

.folder-glyph::before {
  content: '';
  position: absolute;
  left: 1px;
  top: -2px;
  width: 7px;
  height: 3px;
  border-radius: 2px 2px 0 0;
  background: #e8c66b;
}

.node-name {
  min-width: 0;
  line-height: 1.25;
  word-break: break-word;
  font-size: 12px;
}

.node-highlight {
  padding: 0 1px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--accent) 24%, transparent);
  color: inherit;
}

.rename-input {
  min-width: 0;
  width: 100%;
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid var(--accent);
  background: var(--field-bg);
  color: var(--field-text);
  font-size: 12px;
}

.node-row:hover,
.node-row.active {
  background: color-mix(in srgb, var(--panel-strong) 82%, transparent);
  border-color: var(--line);
}

.node-row.active {
  box-shadow: inset 2px 0 0 var(--accent);
}

.menu-trigger {
  width: 18px;
  height: 18px;
  padding: 0;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--muted);
  box-shadow: none;
  font-size: 12px;
  line-height: 1;
}

.menu-trigger:hover {
  background: color-mix(in srgb, var(--panel-strong) 86%, transparent);
  color: var(--text);
  transform: none;
}

.context-menu {
  position: fixed;
  z-index: 60;
  display: grid;
  gap: 6px;
  min-width: 180px;
  padding: 8px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--panel-strong);
  box-shadow: var(--shadow);
}

.context-group {
  display: grid;
  gap: 2px;
}

.context-divider {
  height: 1px;
  background: color-mix(in srgb, var(--line) 86%, transparent);
}

.context-menu button {
  justify-content: flex-start;
  text-align: left;
  border-radius: 8px;
  border: none;
  background: transparent;
  box-shadow: none;
  color: var(--button-text);
}

.context-menu button.danger {
  color: var(--error-text);
}

.context-menu button:hover {
  background: color-mix(in srgb, var(--panel) 84%, transparent);
  transform: none;
}
</style>
