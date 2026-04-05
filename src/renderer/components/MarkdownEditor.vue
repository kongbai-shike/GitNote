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
    :model-value="modelValue"
    :toolbars="toolbar"
    language="en-US"
    preview-theme="github"
    code-theme="github"
    @update:model-value="emit('update:modelValue', $event)"
    @on-upload-img="emit('paste-image', $event)"
  />
</template>
