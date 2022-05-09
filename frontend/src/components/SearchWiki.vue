<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { searchWikiJs } from '../data';

  const searchText = ref('');
  let searchResults = ref([]);
  let showResult = ref(false);

  const selectResult = (selectedText: string) => {
    console.log(selectedText);
  };

  watch(searchText, async () => {
    if (searchText.value.length > 1) {
      showResult.value = true;
      const resultsSearch = await searchWikiJs(searchText.value);
      searchResults.value = resultsSearch.results;
      console.log(searchResults);
    } else {
      searchResults.value = [];
      showResult.value = false;
    }
    //wiki().search(searchText.value, 10).then(data => console.log(data.results.length));
  });
</script>

<template>
  <div class="searchWiki">
    <input v-model="searchText" />
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
