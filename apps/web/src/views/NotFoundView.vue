<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main>
    <h1>Страница не найдена</h1>
    <p>Такой страницы нет. Вернитесь к сводке.</p>
    <RouterLink class="button-primary" to="/">К сводке</RouterLink>
  </main>
</template>
