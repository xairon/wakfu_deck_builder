<script setup lang="ts">
import UserProfile from '@/components/auth/UserProfile.vue'
</script>

<template>
  <div class="profile-view">
    <h1 class="text-3xl font-bold text-center mb-6">Profil utilisateur</h1>
    <UserProfile />
  </div>
</template>

<style scoped>
.profile-view {
  padding: 1rem;
}
</style> 