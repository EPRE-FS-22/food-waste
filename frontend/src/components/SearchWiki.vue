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
    modelValue: {
      type: String,
      default: '',
    },
    previousValue: {
      type: String,
      default: '',
    },
    limit: {
      type: Number,
      default: 5,
    },
    onlyCoords: {
      type: Boolean,
      default: false,
    },
  });

  const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
  }>();

  const searchText = ref(props.modelValue);

  let lastEmit = searchText.value;

  let searchResults = ref([] as string[]);
  let showResult = ref(false);

  let timeoutId = 0;
  let requestOngoing = false;

  let ignoreNextChange = false;
  let ignoreNextPropsChange = false;

  const selectResult = (selectedText: string) => {
    ignoreNextChange = true;
    ignoreNextPropsChange = true;
    showResult.value = false;
    searchText.value = selectedText;
    emit('update:modelValue', selectedText);
    lastEmit = selectedText;
  };

  watch(
    () => props.modelValue,
    (item) => {
      if (ignoreNextPropsChange) {
        ignoreNextPropsChange = false;
      } else {
        searchText.value = item;
        lastEmit = item;
      }
    }
  );

  watch(searchText, async () => {
    if (ignoreNextChange) {
      ignoreNextChange = false;
      return;
    }
    if (searchText.value !== props.previousValue) {
      if (lastEmit !== '') {
        ignoreNextPropsChange = true;
        emit('update:modelValue', '');
        lastEmit = '';
      }
      if (searchText.value.length > 1) {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        if (requestOngoing) {
          return;
        }
        const searchString = searchText.value;
        timeoutId = window.setTimeout(() => {
          timeoutId = 0;
          listWiki(searchString);
        }, 500);
      } else {
        searchResults.value = [];
        showResult.value = false;
      }
    } else {
      searchResults.value = [];
      showResult.value = false;
    }
  });

  const listWiki = async (searchString: string) => {
    try {
      requestOngoing = true;
      const results = await searchWiki(
        searchString,
        props.limit,
        props.onlyCoords,
        props.maxlength
      );
      requestOngoing = false;
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
  .searchWiki {
    input {
      height: 1rem;
      font-size: 1rem;
      line-height: 1rem;
      width: 90%;
      max-width: 40vh;
      max-width: calc((40 * (100vh - var(--vh-offset, 0px)) / 100));
      padding: 0.25rem;
      border: solid 0.1rem rgb(179, 179, 179);
      border-radius: 1rem;
      box-shadow: 0 0.125rem 0.125rem rgba(0, 0, 0, 0.3);
    }
  }
  .results:hover {
    background-color: #a4a4a4;
  }
</style>
