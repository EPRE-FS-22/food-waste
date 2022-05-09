<script setup lang="ts">
  import { onUnmounted, ref, watch } from 'vue';
  import { searchWiki } from '../data';

  const props = defineProps({
    id: {
      type: String,
      default: '',
    },
    name: {
      type: String,
      default: '',
    },
    class: {
      type: String,
      default: '',
    },
    placeholder: {
      type: String,
      default: '',
    },
    maxlength: {
      type: Number,
      default: 100,
    },
    value: {
      type: String,
      default: '',
    },
    onlyCoords: {
      type: Boolean,
      default: true,
    },
  });

  const emit = defineEmits<{
    (e: 'input', value: string): void;
  }>();

  const searchText = ref(props.value);
  let searchResults = ref([] as string[]);
  let showResult = ref(false);

  let timeoutId = 0;

  const selectResult = (selectedText: string) => {
    searchText.value = selectedText;
    emit('input', selectedText);
  };

  watch(
    () => props.value,
    (previous, current) => {
      searchText.value = props.value;
      console.log(
        'Watch props.selected function called with args:',
        previous,
        current
      );
    }
  );

  watch(searchText, async () => {
    if (searchText.value.length > 1) {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(async () => {
        await listWiki();
      }, 300);
    } else {
      searchResults.value = [];
      showResult.value = false;
    }
  });

  const listWiki = async () => {
    try {
      const results = await searchWiki(searchText.value);
      if (results) {
        searchResults.value = results;
        showResult.value = true;
      } else {
        searchResults.value = [];
        showResult.value = false;
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  onUnmounted(() => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  });
</script>

<template>
  <div class="searchWiki">
    <input
      :id="id"
      v-model="searchText"
      :name="name"
      :class="$props.class"
      :placeholder="placeholder"
      :maxlength="maxlength"
    />
    <div v-if="showResult" class="resultSection">
      <div
        v-for="(searchResult, index) in searchResults"
        :key="index"
        class="results"
        @click="selectResult(searchResult)"
      >
        {{ searchResult }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .resultSection {
    display: flex;
    position: absolute;
    flex-direction: column;
    overflow-y: scroll;
  }
  .results {
    color: black;
    background-color: #f9f9f9;
    min-width: 160px;
    box-shadow: 0px 8px 16px 0px rgba(0, 0, 0, 0.2);
    padding: 12px 16px;
    z-index: 1;
    cursor: pointer;
  }

  .results:hover {
    background-color: #a4a4a4;
  }
</style>
