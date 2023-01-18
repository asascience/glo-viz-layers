<script lang="ts">
  import "mapbox-gl/src/css/mapbox-gl.css";
  import mapbox from "mapbox-gl";
  import { onMount } from "svelte";

  const MAPBOX_ACCESS_TOKEN =
    "pk.eyJ1Ijoib3BlbnNvdXJjZXJlciIsImEiOiJja3lsbzNveHAwbndkMnZwZXYxeWxnM3pzIn0.BD4akCoe1u4dg7gcl3J4cQ";
  mapbox.accessToken = MAPBOX_ACCESS_TOKEN;

  let map: mapbox.Map | undefined = undefined;

  onMount(async () => {
    map = new mapbox.Map({
      container: "map",
      style: "mapbox://styles/mapbox/light-v10",
      center: [-94.4, 30],
      zoom: 8,
    });
    map.on("load", () => {
      map.resize();
    });
  });
</script>

<div class="h-screen w-screen flex flex-col">
  <nav class="flex flex-row px-8 py-2">
    <h1 class="font-bold text-xl">GLO Eastern Region Visualizer</h1>
  </nav>

  <main class="flex-1 flex-col w-full h-full bg-red">
    <div id="map" class="h-full w-full" />
  </main>
</div>
