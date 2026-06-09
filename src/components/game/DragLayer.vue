<template>
  <Teleport to="body">
    <div
      v-if="drag"
      class="gdrag"
      :class="{ 'gdrag--returning': drag.returning }"
      :style="layerStyle"
      aria-hidden="true"
    >
      <img
        :src="drag.imgSrc"
        alt=""
        class="gdrag__img"
        :style="{ transform: `rotate(${drag.tilt.toFixed(2)}deg)` }"
        draggable="false"
      />
      <span class="gdrag__shadow"></span>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useBoardDnd } from "@/composables/useBoardDnd";

const { drag } = useBoardDnd();

const layerStyle = computed(() => {
  const d = drag.value;
  if (!d) return {};
  const x = d.returning ? d.originX : d.x - d.grabDX;
  const y = d.returning ? d.originY : d.y - d.grabDY;
  return {
    width: `${d.width}px`,
    height: `${d.height}px`,
    transform: `translate3d(${x}px, ${y}px, 0)`,
  };
});
</script>

<style scoped>
.gdrag {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9998;
  pointer-events: none;
  will-change: transform;
}
.gdrag--returning {
  transition: transform 0.18s cubic-bezier(0.3, 0.8, 0.4, 1);
}
.gdrag__img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
  transform-origin: 50% 80%;
  scale: 1.08;
  box-shadow:
    0 18px 40px rgba(0, 0, 0, 0.55),
    0 4px 12px rgba(0, 0, 0, 0.4);
  transition: transform 0.08s linear;
}
.gdrag--returning .gdrag__img {
  scale: 1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  transition: scale 0.18s ease;
}
.gdrag__shadow {
  position: absolute;
  inset: auto 8% -12px 8%;
  height: 14px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  filter: blur(7px);
}
@media (prefers-reduced-motion: reduce) {
  .gdrag--returning,
  .gdrag__img {
    transition: none;
  }
}
</style>

<style>
body.gdnd-dragging {
  cursor: grabbing !important;
  user-select: none;
  -webkit-user-select: none;
}
</style>
