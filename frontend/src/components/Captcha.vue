<script lang="ts" setup>
  import VueHcaptcha from '@hcaptcha/vue3-hcaptcha';
  defineProps({
    sitekey: {
      type: String,
      required: true,
    },
  });
  const emit = defineEmits<{
    (e: 'verify', value: string): void;
    (e: 'expired'): void;
  }>();
</script>

<template>
  <div class="captcha-wrapper">
    <VueHcaptcha
      :sitekey="sitekey"
      @verify="emit('verify', $event)"
      @expired="emit('expired')"
    ></VueHcaptcha>
  </div>
</template>

<style scoped lang="scss">
  .captcha-wrapper {
    padding: 0.5rem;
    padding-top: 0.75rem;
  }
</style>
