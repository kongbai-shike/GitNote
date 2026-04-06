<script setup>
import { computed } from 'vue';
import { MdEditor } from 'md-editor-v3';

defineProps({
  modelValue: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue', 'paste-image']);

const toolbar = computed(() => [
  'bold',
  'underline',
  'italic',
  '-',
  'title',
  'strikeThrough',
  'quote',
  'unorderedList',
  'orderedList',
  '-',
  'codeRow',
  'code',
  'link',
  'image',
  'table',
  '=',
  'preview',
  'catalog'
]);
</script>

<template>
  <MdEditor
    class="workspace-md-editor"
    :model-value="modelValue"
    :toolbars="toolbar"
    language="zh-CN"
    preview-theme="github"
    code-theme="github"
    @update:model-value="emit('update:modelValue', $event)"
    @on-upload-img="emit('paste-image', $event)"
  />
</template>

<style scoped>
.workspace-md-editor {
  height: 100%;
}

:deep(.md-editor) {
  height: 100%;
  border-radius: 0;
  border: none;
  background: transparent;
}

:deep(.md-editor-content),
:deep(.md-editor-input-wrapper),
:deep(.md-editor-preview-wrapper) {
  height: 100%;
}

:deep(.md-editor-toolbar) {
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--panel-strong) 90%, transparent);
}

:deep(.md-editor-toolbar-item) {
  color: var(--muted);
}

:deep(.md-editor-toolbar-item:hover),
:deep(.md-editor-toolbar-item.active) {
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 8px;
}

:deep(.md-editor-input),
:deep(.md-editor-preview) {
  color: var(--field-text);
  background: transparent;
}

:deep(.md-editor-preview-wrapper) {
  border-left: 1px solid var(--line);
}
</style>
