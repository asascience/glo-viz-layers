<script lang="ts">
  import "mapbox-gl/src/css/mapbox-gl.css";
  import "mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";
  import mapboxgl from "mapbox-gl";
  import MapboxGeocoder from "mapbox-gl-geocoder";
  import { onMount } from "svelte";
  import { MAPBOX_ACCESS_TOKEN } from "./config";

  mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

  let map: mapboxgl.Map | undefined = undefined;
  let popup: mapboxgl.Popup | undefined = undefined;

  onMount(async () => {
    map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/dark-v10",
      center: [-94.4, 30],
      zoom: 8,
    });
    map.on("load", () => {
      map.resize();

      map.addControl(
        new MapboxGeocoder({
          accessToken: MAPBOX_ACCESS_TOKEN,
        }), 
        "top-right",
      );

      popup = new mapboxgl.Popup({
        // className: "popup",
        closeButton: false,
        closeOnClick: false,
      });
    });
  });
</script>

<div class="h-screen w-screen flex flex-col">
  <nav class="absolute flex flex-row py-2 top-2 left-4 z-10">
    <h1 class="font-extrabold text-xl text-fuchsia-700">GLO Eastern Region Visualizer | RPS</h1>
  </nav>

  <main class="flex-1 flex-col absolute top-0 bottom-0 left-0 right-0">
    <div id="map" class="h-full w-full" />
  </main>
</div>
