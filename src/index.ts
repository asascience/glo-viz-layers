import 'mapbox-gl/dist/mapbox-gl.css'; 
import 'mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'; 
import './style.css';

import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from 'mapbox-gl-geocoder';
import { CUBE_HELIX, TURBO, VIRIDIS } from './colormaps';
import { LayerControlGrouped } from './groupedlayercontrol';
import { fetchJSON, fly, loadMapboxImage, sleep, zip } from './utils';

mapboxgl.accessToken = 'pk.eyJ1Ijoib3BlbnNvdXJjZXJlciIsImEiOiJja3lsbzNveHAwbndkMnZwZXYxeWxnM3pzIn0.BD4akCoe1u4dg7gcl3J4cQ';

// Global vars
let popup: mapboxgl.Popup;
let playing = false
let legendConfig: any;
let hoveredId: string | number | null = null;
let legendlyrs: any[] = [];
let reptLossData: any;
const replossId = 'FEMA Severe Repetitive Loss Properties'

//basemap changer https://docs.mapbox.com/mapbox-gl-js/example/setstyle/
const layerList = document.getElementById('menu');
const inputs = layerList?.getElementsByTagName('input');

let [x0, y0, z0] = [-94.4, 30, 8]
    
let dir = 'http://glo-repetitiveloss.s3-website.us-east-2.amazonaws.com/';
let lyrdir = dir + 'bringtheheat/';
let huclyrdir = dir + 'HUC/';
let janlayerdir = dir + 'layers_jan_2023/';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v10',
    center: [x0, y0],
    zoom: z0,
});

function addHeatmap(map, heatlyr, q0 = 1, q1 = 20, q2 = 300) {
    // q0-2: quantile distribution of heatlyr.densityAttr to base the heatmap color ramp off, (min, q50, max)
    let lyrId = heatlyr.id
    if (!heatlyr.hasOwnProperty('data')) {
        heatlyr.data = lyrdir + encodeURIComponent(lyrId) + '.geojson'
    }
    if (!heatlyr.hasOwnProperty('densityAttr')) {
        heatlyr.densityAttr = null
    }
    if (!heatlyr.hasOwnProperty('colormap')) {
        heatlyr.colormap = VIRIDIS
    }
    if (!heatlyr.hasOwnProperty('lblPrefix')) {
        heatlyr.lblPrefix = ''
    }
    if (!heatlyr.hasOwnProperty('lblSuff')) {
        heatlyr.lblSuff = ''
    }
    map.addSource(lyrId, {
        'type': 'geojson',
        'data': heatlyr.data
    })

    if (heatlyr.densityAttr != null) {
        map.addLayer(
            {
                'id': lyrId + '',
                'type': 'heatmap',
                'source': lyrId,
                // 'maxzoom': 8,
                'layout': { 'visibility': 'none' },
                'paint': {
                    // Increase the heatmap weight based on frequency and property magnitude
                    'heatmap-weight': [
                        'interpolate',
                        ['linear'],
                        ['get', heatlyr.densityAttr],
                        0,
                        0,
                        4,
                        1
                    ],
                    // Increase the heatmap color weight weight by zoom level
                    // heatmap-intensity is a multiplier on top of heatmap-weight
                    'heatmap-intensity': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        0,
                        1,
                        22,
                        3
                    ],
                    // Color ramp for heatmap.  Domain is 0 (low) to 1 (high).
                    // Begin color ramp at 0-stop with a 0-transparancy color
                    // to create a blur-like effect.
                    'heatmap-color': [
                        'interpolate',
                        ['linear'],
                        ['heatmap-density'],
                        ...heatlyr.colormap],
                    // Adjust the heatmap radius by zoom level
                    'heatmap-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        1,
                        4
                        ,
                        7, 
                        ['interpolate', ['linear'], ['get', heatlyr.densityAttr], q0, 4, q1, 40, q2, 70],
                        22,
                        ['interpolate', ['linear'], ['get', heatlyr.densityAttr], q0, 5, q1, 100, q2, 150]
                    ],
                    // Transition from heatmap to circle layer by zoom level
                    // 'heatmap-opacity': [
                    //     'interpolate',
                    //     ['linear'],
                    //     ['zoom'],
                    //     7,
                    //     1,
                    //     9,
                    //     0
                    // ]
                }
            },
            //'waterway-label'
        );

        map.addLayer(
            {
                'id': lyrId + '-point',
                'type': 'circle',
                'source': lyrId,
                'minzoom': 10,
                'layout': { 'visibility': 'none' },
                'paint': {
                    // Size circle radius by earthquake magnitude and zoom level
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        7,
                        ['*', 0.6, ['interpolate', ['linear'], ['get', heatlyr.densityAttr], q0, 4, q1, 40, q2, 70]],
                        22,
                        ['*', 0.6, ['interpolate', ['linear'], ['get', heatlyr.densityAttr], q0, 5, q1, 100, q2, 150]]
                    ],
                    // Color circle by earthquake magnitude
                    // 'circle-color': [
                    //     'interpolate',
                    //     ['linear'],
                    //     ["/", ['get','reptloss'] , 300 ],
                    //     ...turbo
                    // ],
                    'circle-stroke-color': 'white',
                    'circle-stroke-width': 1,
                    // Transition from heatmap to circle layer by zoom level
                    'circle-opacity': 0,
                    'circle-stroke-opacity': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        7,
                        0,
                        8,
                        0.2
                    ]
                }
            },
            //'waterway-label'
        );
    }
    else {//no density attr
        let s0 = 5
        let s1 = 7
        map.addLayer(
            {
                'id': lyrId + '',
                'type': 'heatmap',
                'source': lyrId,
                // 'maxzoom': 8,
                'layout': { 'visibility': 'none' },
                'paint': {
                    'heatmap-weight': 0.02,
                    // Increase the heatmap color weight weight by zoom level
                    // heatmap-intensity is a multiplier on top of heatmap-weight
                    'heatmap-intensity': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        0,
                        1,
                        22,
                        3
                    ],
                    // Color ramp for heatmap.  Domain is 0 (low) to 1 (high).
                    // Begin color ramp at 0-stop with a 0-transparancy color
                    // to create a blur-like effect.
                    'heatmap-color': [
                        'interpolate',
                        ['linear'],
                        ['heatmap-density'],
                        ...heatlyr.colormap],
                    // Adjust the heatmap radius by zoom level
                    'heatmap-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        1,
                        4,
                        7, 
                        s0 * 3,
                        22,
                        s1 * 3
                    ],
                    // Transition from heatmap to circle layer by zoom level
                    // 'heatmap-opacity': [
                    //     'interpolate',
                    //     ['linear'],
                    //     ['zoom'],
                    //     7,
                    //     1,
                    //     9,
                    //     0
                    // ]
                }
            },
            //'waterway-label'
        );

        map.addLayer(
            {
                'id': lyrId + '-point',
                'type': 'circle',
                'source': lyrId,
                'minzoom': 10,
                'layout': { 'visibility': 'none' },
                'paint': {
                    // Size circle radius by earthquake magnitude and zoom level
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        7,
                        s0,
                        22,
                        s1
                    ],
                    // Color circle by earthquake magnitude
                    // 'circle-color': [
                    //     'interpolate',
                    //     ['linear'],
                    //     ["/", ['get','reptloss'] , 300 ],
                    //     ...turbo
                    // ],
                    'circle-stroke-color': 'white',
                    'circle-stroke-width': 1,
                    // Transition from heatmap to circle layer by zoom level
                    'circle-opacity': 0,
                    'circle-stroke-opacity': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        14,
                        0,
                        16,
                        0.2
                    ]
                }
            },
            //'waterway-label'
        );
        // map.on('click', lyrId+'-point', (event) => {
        // popup
        //     .setLngLat(event.lngLat)
        //     .setHTML(`<strong>${heatlyr.lblPrefix}${lyrId}${heatlyr.lblSuff}</strong>`)
        //     .addTo(map);
        // });     

        map.on('mouseleave', lyrId + '-point', () => {
            map.getCanvas().style.cursor = '';
            popup.remove();
        });

        map.on('mouseenter', lyrId + '-point', (event) => {
            popup
                .setLngLat(event.lngLat)
                .setHTML(`<strong>${heatlyr.lblPrefix}${lyrId}${heatlyr.lblSuff}</strong>`)
                .addTo(map);
            // Change the cursor style as a UI indicator.
            map.getCanvas().style.cursor = 'pointer';
        })
    }
}

const tutorial = async (map) => {
    await fly(map, -94.1412, 30.1029, 12)
    await sleep(3.5)
    map.addSource('pointer', {
        'type': 'geojson',  //TODO mouse outline
        // 'type':'Point',
        'data': [0, 0]//pointerData(x0,y0)
    });
    // console.log(pointerData(x0,y0))
    // map.loadImage(
    //     lyrdir+'mouse.jpg', //too choppy, have to use a boring circle instead
    // (error, image) => {
    //     if (error) throw error;
        
    //     // Add the image to the map style.
    //     map.addImage('mouse', image);
    map.addLayer({
        'id': 'pointer',
        'source': 'pointer',
        // 'type':'fill', //TODO mouse outline
        // 'paint': {
        // 'fill-color': 'white'
        // }
        'type': 'circle',
        'paint': {
            'circle-radius': 6,
            'circle-color': 'white'
        }
        // 'type': 'symbol',
        // 'layout': {
        //     'icon-image':'mouse',
        //     'icon-size':.25
        // }
    })

    //     }
    // )

    let routes = await fetchJSON(lyrdir + 'pointerpath.geojson')
    routes = routes.features
    routes.sort((a, b) => (a.properties.route > b.properties.route) ? 1 : -1)
    // console.log(routes)

    const parseRoute = (feat) => {
        let route = feat.geometry.coordinates
        if (route.length === 1) {//multilinestrings
            route = route[0]
        }
        return route
    }

    //TODO zip is hardcoded, replace this entirely
    const zips = routes.map(feat => feat.properties.zip)
    routes = routes.map(parseRoute)
    // console.log(zips)
    //routes will be [ [[x1,y1],[x2,y2]] , [[x1,y1],...] , ... ]

    function seq1(map, route) {
        let pos = route.shift()
        // console.log(pointerData(...pos))
        // pos = parseRoute(pos)
        // @ts-ignore
        map.getSource('pointer').setData(pointerData(...pos));
        
        // Request the next frame of the animation.
        return route
    }
    
    map.moveLayer('pointer')

    playing = true;
    let route: any = undefined
    let lastcoord: any;
    async function update(_) { // Main update loop
        let zyp: any;

        // your draw code
        if (route === undefined) { // is there an animation 
            // no animation 
            if (routes.length > 0) {  // are there any animations on the stack
                route = routes.shift(); // yes get the first anim
                // console.log(zips)
                zyp = zips.shift() //get the associated zip code to simulate mouse hover
                // console.log(zyp)
            } else {
                playing = false;  // no animations to play so stop and exit
                return;
            }
        }
        if (route.length == 1) {
            lastcoord = route[0] //grab this before it gets Shifted off in seq1
        }
        route = seq1(map, route)
        if (route.length === 0) { // call the anim and check if returns true;
            // animation ended so get the next animation function if there are any
            // console.log(zyp)
            map.setFeatureState(
                { source: 'zipcodes', id: zyp },
                { hover: true }
            )

            const aray = reptLossData.features
            const reptloss = aray[aray.map((x) => x.properties.id).indexOf(zyp)].properties.reptloss //TODO change this to zip if the prop changes back to zip HARDCODED
            // console.log(reptloss)
            popup
                .setLngLat(lastcoord)
                .setHTML(`<strong>Repetitive Loss Properties:</strong> ${reptloss}<br>
                        in zip code ${zyp}`)
                .addTo(map)
            map.moveLayer('zipcodes', 'FEMA Severe Repetitive Loss Properties');
            map.setLayoutProperty('zipcodes', 'visibility', 'visible')

            await sleep(2.7)

            // testhover = await map.getFeatureState({
            // source: 'zipcodes',
            // // sourceLayer: 'zipcodes',
            // id: zyp
            // })
            // console.log(testhover)
                
            // console.log('close')
            map.setFeatureState(
                { source: 'zipcodes', id: zyp },
                { hover: false }
            )
            popup.remove()
            map.setLayoutProperty('zipcodes', 'visibility', 'none')

            if (routes.length > 0) {

                route = routes.shift(); // get the next anim
                zyp = zips.shift()
            } else {
                // console.log('fin')
                playing = false; // no more animations so stop
                route = undefined; // ready for new animtion
                map.setLayoutProperty('pointer', 'visibility', 'none')

                // await sleep(.2)
                fly(map, x0, y0, z0)
            }
        }   

        if (playing) {
            requestAnimationFrame(update); // get next frame
        }
    }

    requestAnimationFrame(update); // starts the animation
}

const loadLayers = async () => { //had to strip out to separate func to reload after style/basemap change 

    //3d buildings
    // Insert the layer beneath any symbol layer.
    if (['Mapbox Light', 'Mapbox Dark'].indexOf(map.getStyle().name!) > -1) {
    
        const layers = map.getStyle().layers;
        const labelLayerId = layers.find(
            (layer) => layer.type === 'symbol' && layer.layout!['text-field']
        )!.id;
        
        // The 'building' layer in the Mapbox Streets
        // vector tileset contains building height data
        // from OpenStreetMap.
        map.addLayer(
            {
                'id': 'add-3d-buildings',
                'source': 'composite',
                'source-layer': 'building',
                'filter': ['==', 'extrude', 'true'],
                'type': 'fill-extrusion',
                'minzoom': 15,
                'paint': {
                    'fill-extrusion-color': '#aaa',
        
                    // Use an 'interpolate' expression to
                    // add a smooth transition effect to
                    // the buildings as the user zooms in.
                    'fill-extrusion-height': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        15,
                        0,
                        15.05,
                        ['get', 'height']
                    ],
                    'fill-extrusion-base': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        15,
                        0,
                        15.05,
                        ['get', 'min_height']
                    ],
                    'fill-extrusion-opacity': 0.6
                }
            },
            labelLayerId
        );
    }

    // Add a geojson point source.
    // Heatmap layers also work with a vector tile source.
    reptLossData = await fetchJSON(lyrdir + 'repetitiveLoss.geojson')

    map.addSource('zipcodes', {
        'type': 'geojson',
        'data': lyrdir + 'zip.geojson',
        'promoteId': 'zip'
        // 'generateId':true
    })
    map.addLayer(
        {
            'id': 'zipcodes',
            'type': 'fill',
            'source': 'zipcodes',
            // 'maxzoom': 8,
            'paint': {
                'fill-color': 'blue',
                // 'fill-width': 3,
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false],
                    .3,
                    0
                ]
            },
            'layout': { 'visibility': 'none' } //on load
        }
        // ,'FEMA Severe Repetitive Loss Properties' //add underneath
    )

    let lyrId = 'FEMA NHD Streams'
    // console.log(dir+encodeURIComponent(lyrId)+'.mbtiles' )
    map.addSource(lyrId, {
        'type': 'geojson',
        'data': dir + encodeURIComponent(lyrId) + '.geojson',
    })
    map.addLayer(
        {
            'id': lyrId,
            'type': 'line',
            'source': lyrId,
            paint: {
                'line-color': 'rgb(60, 129, 255)',
                "line-width": [
                    'match',
                    ["get", "GNIS_Name"], "nan",
                    .5,
                    3
                ],
                "line-opacity": .8
            },
            'layout': { 'visibility': 'none' } //on load
        }
        // ,'FEMA Severe Repetitive Loss Properties' //add underneath
    )
    legendlyrs.push(
        {
            id: lyrId,
            hidden: false,
            group: "Waterways",
            // children:[lyrId+'-fill'],
            directory: "Legend"
        }
    )
    map.on('mouseleave', lyrId, () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
    });

    map.on('mouseenter', lyrId, (event) => {
        // @ts-ignore
        if (event.features[0].properties.GNIS_Name != 'nan') {
            popup
                .setLngLat(event.lngLat)
                // @ts-ignore
                .setHTML(`<strong>${event.features[0].properties.GNIS_Name}</strong>`)
                .addTo(map);
            // Change the cursor style as a UI indicator.
            map.getCanvas().style.cursor = 'pointer';
        }
    })
    // //animate nhd!
    // // Create a GeoJSON source with an empty lineString.
    // const geojason = {
    //     'type': 'FeatureCollection',
    //     'features': [
    //     {
    //     'type': 'Feature',
    //     'geometry': {
    //     'type': 'LineString',
    //     'coordinates': [[0, 0]]
    //     }
    //     }
    //     ]
    // };
    // const speedFactor = 30; // number of frames per longitude degree
    // let animation; // to store and cancel the animation
    // let startTime = 0;
    // let progress = 0; // progress = timestamp - startTime
    // let resetTime = false; // indicator of whether time reset is needed for the animation
    // startTime = performance.now();
    // animateLine(); //https://docs.mapbox.com/mapbox-gl-js/example/animate-a-line/
    
    // // click the button to pause or play
    // // pauseButton.addEventListener('click', () => {
    // // pauseButton.classList.toggle('pause');
    // // if (pauseButton.classList.contains('pause')) {
    // // cancelAnimationFrame(animation);
    // // } else {
    // // resetTime = true;
    // // animateLine();
    // // }
    // // });
    
    // // reset startTime and progress once the tab loses or gains focus
    // // requestAnimationFrame also pauses on hidden tabs by default
    // document.addEventListener('visibilitychange', () => {
    //     resetTime = true;
    // });
    
    // // animated in a circle as a sine wave along the map.
    // function animateLine(timestamp) {
    //     if (resetTime) {
    //     // resume previous progress
    //     startTime = performance.now() - progress;
    //     resetTime = false;
    //     } else {
    //     progress = timestamp - startTime;
    //     }
        
    //     // restart if it finishes a loop
    //     if (progress > speedFactor * 360) {
    //     startTime = timestamp;
    //     geojason.features[0].geometry.coordinates = [];
    //     } else {
    //     const x = progress / speedFactor;
    //     // draw a sine wave with some math.
    //     const y = Math.sin((x * Math.PI) / 90) * 40;
    //     // append new coordinates to the lineString
    //     geojason.features[0].geometry.coordinates.push([x, y]);
    //     // then update the map
    //     map.getSource('FEMA NHD Streams').setData(geojason);
    //     }
    //     // Request the next frame of the animation.
    //     animation = requestAnimationFrame(animateLine);
    // }

    lyrId = 'CDBG-MIT Proposed Projects'

    map.addSource(lyrId + '-src', {
        type: 'geojson',
        data: dir + encodeURIComponent(lyrId) + '.geojson',
        cluster: true,
        // clusterMaxZoom: 10, // Max zoom to cluster points on
        // clusterRadius: 0.0003 // Radius of each cluster when clustering points (defaults to 50)
    });

    map.addLayer(
        {
            'id': lyrId,
            'type': 'symbol',
            // 'sprite':'https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png',
            'source': lyrId + '-src',
            // filter: ['has', 'point_count'],
            'layout': {
                'icon-image': 'custom-marker',
                //     // get the title name from the source's "title" property
                'text-field': 
                    // ['format',
                    ['case', ['has', 'cluster'],
                        ['to-string', ['get', 'point_count']],
                        ['get', 'Applicant']
                    ],
                // 'text-halo-blur':40,
                // 'text-halo-color':'black',
                // {'text-shadow': '-8px -3px 4px black'}]counties
                // , 3px -3px 4px black, -3px 3px 4px black, 3px 3px 4px black;}]   
                    
                //     // // ['match',['get', 'point_count'],1,
                //     // // ['get', 'Applicant'],['to-string',['get', 'point_count']]],
                'text-font': [
                    'Open Sans Semibold',
                    'Arial Unicode MS Bold'
                ],
                'text-offset': [0, 1.25],
                'text-anchor': 'top',
                'visibility': 'none'
            }
            , paint: {
                "text-color": [
                    'case',
                    ['has', 'Status'],
                    [
                        'match',
                        ["get", "Status"], "Application Approved",
                        'rgb(21, 255, 0)', 'yellow'],
                    'white'],
                'text-halo-width': 2,
                'text-halo-blur': 1,
                'text-halo-color': 'black',
            }
        }
        // ,'FEMA Severe Repetitive Loss Properties' //add underneath
    )
    legendlyrs.push(
        {
            id: lyrId,
            hidden: false,
            group: "Mitigation Projects",
            // children:[lyrId+'-fill'],
            directory: "Legend"
        }
    );

    map.on('mouseleave', lyrId, () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
    });

    map.on('mousemove', lyrId, (event) => {
        // @ts-ignore
        if ((event.features[0].properties.cluster ?? false) === true) {
            popup
                .setLngLat(event.lngLat)
                // @ts-ignore
                .setHTML(`<strong>${event.features[0].properties.point_count} Projects</strong><br>`)
                .addTo(map);
            // @ts-ignore
        } else if (event.features[0].properties.Site_Title !== undefined) {
            popup
                .setLngLat(event.lngLat)
                // @ts-ignore
                .setHTML(`<strong>${event.features[0].properties.Site_Title}</strong><br>${event.features[0].properties.Status}`)
                .addTo(map);
            // Change the cursor style as a UI indicator.
            map.getCanvas().style.cursor = 'pointer';
        }
    });

    lyrId = 'TWDB FIF Projects'

    map.addSource(lyrId + '-src', {
        type: 'geojson',
        data: `${janlayerdir}${encodeURIComponent('FIF CAT 1 Combined Shapefile')}/${encodeURIComponent('FIF CAT 1 Project Areas.geojson')}`,
        // clusterMaxZoom: 10, // Max zoom to cluster points on
        // clusterRadius: 0.0003 // Radius of each cluster when clustering points (defaults to 50)
    });

    map.addLayer({
        id: lyrId,
        source: lyrId + '-src',
        type: 'fill',
        paint: {
            "fill-color": '#3F556D',
            'fill-opacity': 0.6,
        },
        layout: {
            'visibility': 'none',
        }
    })

    legendlyrs.push(
        {
            id: lyrId,
            hidden: false,
            group: "Mitigation Projects",
            // children:[lyrId+'-fill'],
            directory: "Legend"
        }
    )

    map.on('mouseleave', lyrId, () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
    });

    map.on('mousemove', lyrId, (event) => {
        let features = event.features as Array<any>;
        let html = '';

        features.forEach(f => {
            if (f.properties.Project_Na) {
                html += `<span>${f.properties.Project_Nu}: </span><strong>${f.properties.Project_Na}</strong><br>`;
            }
        });

        if (html.length > 0) {
            popup
                .setLngLat(event.lngLat)
                // @ts-ignore
                .setHTML(html)
                .addTo(map);
            // Change the cursor style as a UI indicator.
            map.getCanvas().style.cursor = 'pointer';
        }
    })    
    
    const lyrz = [
        {
            id: 'Natural Gas Pipelines',
            subdir: 'TWDB_Critical_Infrastructure',
            typ: 'line',
            color: 'orange',
            grup: "TWDB Critical Infrastructure"
        },
        {
            id: 'Transmission Lines',
            subdir: 'TWDB_Critical_Infrastructure',
            typ: 'line',
            color: 'rgb(35, 130, 255)',
            grup: "TWDB Critical Infrastructure"
        },
        {
            id: 'Counties',
            typ: 'line',
            color: 'rgb(0, 255, 247)',
            grup: "Boundaries",
            lbl: '{CNTY_NM} County'
        },
        {
            id: 'Regional Flood Planning Groups',
            subdir: `layers_jan_2023/${encodeURIComponent('Regional Flood Planning Groups')}`,
            typ: 'line', 
            color: 'crimson', 
            grup: "Boundaries",
            lbl: '{RFPG}'
        }, 
        {
            id: 'Drainage Districts',
            subdir: `layers_jan_2023/${encodeURIComponent('Drainage Districts')}`,
            typ: 'line', 
            color: 'darkviolet', 
            grup: "Boundaries",
            lbl: '{Name}'
        }, 
        {
            id: 'RPS Project Limits',
            subdir: `layers_jan_2023/${encodeURIComponent('RPS Project Limits')}`,
            typ: 'line', 
            color: '#71004B', 
            grup: "Boundaries",
        },
        {
            id: 'Reservoirs',
            subdir: `layers_jan_2023/${encodeURIComponent('Reservoirs')}`,
            typ: 'fill',
            color: 'royalblue',
            grup: "Built and Natural Environment Features",
            lbl: '{RES_NAME}',
        }, 
        {
            id: 'Harvey Impact Area', 
            subdir: `layers_jan_2023/${encodeURIComponent('Harvey Impact Area')}`,
            typ: 'fill',
            color: 'orangered', 
            grup: 'Repetitive Loss',
        },
        {
            id: 'GLO RBFS Project Team Study Area', 
            subdir: `layers_jan_2023/${encodeURIComponent('GLO RBFS Project Team Study Area')}`,
            typ: 'line',
            color: 'red', 
            grup: 'Boundaries',
            lbl: '{TEAM}',
        }
    ]
    
    lyrz.forEach(lyr => {
        if (lyr.subdir) {
            lyr.subdir = lyr.subdir + '/'
        }
        else { lyr.subdir = '' }
        
        map.addSource(lyr.id, {
            type: 'geojson',
            data: dir + lyr.subdir + encodeURIComponent(lyr.id) + '.geojson',
        })

        if (lyr.typ === 'line') {
            map.addLayer(
                {
                    'id': lyr.id,
                    'type': 'line',
                    'source': lyr.id,
                    paint: {
                        'line-color': lyr.color,
                        "line-width": 1.3
                        // "line-opacity": .8
                    },
                    'layout': { 'visibility': 'none' } //on load
                }
                // ,'FEMA Severe Repetitive Loss Properties' //add underneath
            );
        } else if (lyr.typ === 'fill') {
            map.addLayer(
                {
                    'id': lyr.id,
                    'type': 'fill',
                    'source': lyr.id,
                    paint: {
                        'fill-color': lyr.color,
                        "fill-opacity": .7
                    },
                    'layout': { 'visibility': 'none' } //on load
                }
                // ,'FEMA Severe Repetitive Loss Properties' //add underneath
            );
        }

        if (!lyr.hasOwnProperty('lbl')) {
            legendlyrs.push(
                {
                    id: lyr.id,
                    hidden: false,
                    group: lyr.grup,
                    directory: "Legend"
                }
            )
        } else {
            legendlyrs.push(
                {
                    id: lyr.id,
                    hidden: false,
                    group: lyr.grup,
                    children: [lyr.id + '-lbl'],
                    directory: "Legend"
                }
            )
        
            //lbl
            map.addLayer(
                {
                    'id': lyr.id + '-lbl',
                    'type': 'symbol',
                    'source': lyr.id,
                    // paint: {
                    //         "fill-opacity": 0
                    // },
                    paint: {
                        "text-color": lyr.color,
                        'text-halo-width': 2,
                        'text-halo-blur': 1,
                        'text-halo-color': 'black',
                    },
                    'layout': { 
                        'text-field': lyr.lbl,
                        'text-font': [
                            'Open Sans Semibold',
                            'Arial Unicode MS Bold'
                        ],
                        'text-offset': [0, 1.25],
                        'text-anchor': 'top',
                        'visibility': 'none'
                    } //on load
                }
                // ,'FEMA Severe Repetitive Loss Properties' //add underneath
            )
            legendlyrs.push(
                {
                    id: lyr.id + '-lbl',
                    hidden: true,
                    group: lyr.grup,
                    parent: lyr.id,
                    directory: "Legend"
                }
            )
        }
        
        // if (lyr.lblOn==='click') { //why can't pass lyr.lblOn straight into map.on()??
        //     console.log('click')
        //     map.on('mouseenter', lyrId, (event) => {
        //         // Change the cursor style as a UI indicator.
        //         map.getCanvas().style.cursor = 'pointer';
        //     })
        //     map.on('click', lyrId, (event) => {
        //     popup
        //         .setLngLat(event.lngLat)
        //         .setHTML(`<strong>FEMA ${lyrId}</strong>`)
        //         .addTo(map);
        //     }); 
        // } else {
        // console.log('enter')
        //     map.on('mouseenter', lyrId, (event) => {
        //         // Change the cursor style as a UI indicator.
        //         map.getCanvas().style.cursor = 'pointer';
        //     popup
        //         .setLngLat(event.lngLat)
        //         .setHTML(`<strong>${lyrId}</strong>`)
        //         .addTo(map);
        //     }); 
        // // }    
        
        // map.on('mouseleave', lyrId, () => {
        //     map.getCanvas().style.cursor = '';
        //     popup.remove();
        //     });

    })

    //BLE
    lyrId = '100YR_FEMA_BLE'
    // console.log(dir+encodeURIComponent(lyrId)+'.mbtiles' )
    map.addSource(lyrId, {
        'type': 'raster',
        'tiles': [dir + encodeURIComponent(lyrId) + '/{z}/{x}/{y}.png'],
        // 'tiles': dir+encodeURIComponent(lyrId)+'.mbtiles'
        minzoom: 7,
        maxzoom: 13
    })
    map.addLayer(
        {
            'id': lyrId,
            'type': 'raster',
            'source': lyrId,
            'layout': { 'visibility': 'none' } //on load
        }
        // ,'FEMA Severe Repetitive Loss Properties' //add underneath
    )
    legendlyrs.push(
        {
            id: lyrId,
            hidden: false,
            group: "FEMA BLE",
            // children:[lyrId+'-fill'],
            directory: "Legend"
        }
    );

    // National Land Cover Database
    lyrId = 'Land Use'

    // TODO: Add bounds? 
    map.addSource(lyrId, {
        'type': 'raster',
        'tiles': [
            'https://www.mrlc.gov/geoserver/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image%2Fpng&TRANSPARENT=true&LAYERS=mrlc_display%3ANLCD_2019_Land_Cover_L48&TILED=true&SRS=EPSG%3A3857&jsonLayerId=allconusNlcd2019LandCover&STYLES=&WIDTH=256&HEIGHT=256&CRS=EPSG%3A3857&bbox={bbox-epsg-3857}'
        ],
        'tileSize': 256, 
    });
    map.addLayer(
        {
            'id': lyrId,
            'type': 'raster',
            'source': lyrId,
            'paint': {}, 
            'layout': { 'visibility': 'none' } //on load
        },
        //'building' // Place layer under labels, roads and buildings.
    );

    legendlyrs.push({
        id: lyrId,
        hidden: false,
        group: "Built and Natural Environment Features",
        directory: "Legend"
    })

    // Land Cover (Percent Impervious)
    lyrId = 'Land Cover'

    map.addSource(lyrId, {
        'type': 'raster',
        "maxzoom": 10,
        'tiles': [janlayerdir + 'Land_Cover/tiles_png/{z}/{x}/{y}.png'],
        'tileSize': 256, 
    });
    map.addLayer(
        {
            'id': lyrId,
            'type': 'raster',
            'source': lyrId,
            'paint': {}, 
            'layout': { 'visibility': 'none' } //on load
        },
        //'building' // Place layer under labels, roads and buildings.
    );

    legendlyrs.push({
        id: lyrId,
        hidden: false,
        group: "Built and Natural Environment Features",
        directory: "Legend"
    })

    // Soils
    lyrId = 'Soil Types'

    map.addSource(lyrId, {
        type: 'vector',
        tiles: [janlayerdir + 'Soils/tiles_pbf/{z}/{x}/{y}.pbf'],
        minzoom: 0,
        maxzoom: 10,
    });
    map.addLayer({
        id: lyrId,
        type: 'fill',
        source: lyrId,
        'source-layer': 'Neches_Soil',
        'layout': { 'visibility': 'none' }, //on load
        'paint': {
            'fill-color': '#ffcc66',
            'fill-opacity': .35
        },
    })

    legendlyrs.push({
        id: lyrId,
        hidden: false,
        group: "Built and Natural Environment Features",
        directory: "Legend"
    })

    //txdot overtopping
    lyrId = 'TxDOT Overtopping'
    // console.log(dir+encodeURIComponent(lyrId)+'.mbtiles' )
    map.addSource(lyrId, {
        'type': 'geojson',
        'data': dir + lyrId + '.geojson',
        'generateId': true
    })
    map.addLayer(
        {
            'id': lyrId,
            'type': 'line',
            'source': lyrId,
            paint: {
                'line-color': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false],
                    'rgb(0, 172, 163)',
                    'black'
                ],
                "line-width": [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false],
                    12,
                    4
                ],
                "line-opacity": [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false],
                    .5,
                    1
                ],
            },
            'layout': { 'visibility': 'none' } //on load
        }
        // ,'FEMA Severe Repetitive Loss Properties' //add underneath
    )
    legendlyrs.push(
        {
            id: lyrId,
            hidden: false,
            group: "Roadway Overtopping",
            // children:[lyrId+'-fill'],
            directory: "Legend"
        }
    )
    
    // map.on('mouseenter', lyrId, (e) => {

    // })

    let txdotHover: any = null
    map.on('mousemove', lyrId, (e) => {
        
        if (e.features?.length ?? 0 > 0) {

            let propz = e.features![0].properties ?? {}
            popup
                .setLngLat(e.lngLat)
                .setHTML(`<h3>${propz.RTE_NM}</h5><br>
                <strong>${propz.COND_START_TS} - ${propz.COND_END_TS}</strong><br><br>
                ${propz.COND_DSCR}`)
                .addTo(map);
            // Change the cursor style as a UI indicator.
            map.getCanvas().style.cursor = 'pointer';

            if (txdotHover !== null) {
                map.setFeatureState(
                    { source: lyrId, id: txdotHover },
                    { hover: false }
                );
            }
            txdotHover = e.features![0].id;
            
            map.setFeatureState(
                { source: lyrId, id: txdotHover },
                { hover: true }
            );
        }
    });
    // When the mouse leaves the state-fill layer, update the feature state of the
    // previously hovered feature.
    map.on('mouseleave', lyrId, () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
        if (txdotHover !== null) {
            map.setFeatureState(
                { source: lyrId, id: txdotHover },
                { hover: false }
            );
        }
        txdotHover = null;
    });

    const huclyrs = ['HUC8', 'HUC10', 'HUC12'];
    huclyrs.forEach(lyrId => {

        map.addSource(lyrId, {
            'type': 'geojson',
            'data': huclyrdir + lyrId + '.geojson'
        })

        map.addLayer(
            {
                'id': lyrId,
                'type': 'line',
                'source': lyrId,
                'paint': {
                    'line-color': '#ffffff',
                    'line-width': 12 * 12 * 12 * 12 * .5 / Math.pow(parseInt(lyrId.replace('HUC', '')), 4),
                    'line-opacity': .8
                },
                'layout': { 'visibility': 'none' } //on load
            }
            // ,'FEMA Severe Repetitive Loss Properties' //add underneath
        )
        map.addLayer(
            {
                'id': lyrId + '-fill',
                'type': 'fill',
                'source': lyrId,
                'paint': {
                    'fill-opacity': 0
                },
                'layout': { 'visibility': 'none' } //on load
            }
            // ,'FEMA Severe Repetitive Loss Properties' //add underneath
        )
            
        legendlyrs.push(
            {
                id: lyrId,
                hidden: false,
                group: "Boundaries",
                children: [lyrId + '-fill'],
                directory: "Legend"
            },
            {
                id: lyrId + '-fill',
                parent: lyrId,
                hidden: true,
                group: "Boundaries",
                directory: "Legend"
            }
        )
    })

    const fldzonelyrs = ['500YR Preliminary',
        '500YR Effective',
        '100YR Preliminary',
        '100YR Effective']
    let colrs = zip(fldzonelyrs, ['#c36c08', '#c7af0e', '#0000b0', '#5544fd'])
    colrs = Object.fromEntries(colrs)

    fldzonelyrs.forEach(lyrId => {
        map.addSource(lyrId, {
            'type': 'geojson',
            'data': lyrdir + 'Floodplain/' + lyrId + '.geojson'
        });

        map.addLayer({
            'id': lyrId,
            'type': 'fill',
            'source': lyrId,
            'paint': {
                'fill-color': colrs[lyrId],
                'fill-opacity': .35
            },
            'layout': { 'visibility': 'none' } //on load
        });
        
        legendlyrs.push({
            id: lyrId,
            hidden: false,
            group: "FEMA Floodplain",
            // children:[lyrId+'-fill'],
            directory: "Legend"
        });
    });

    let heatmaplyrs = [
        {
            id: replossId,
            data: reptLossData,
            densityAttr: 'reptloss',
            colormap: TURBO,
            grup: "Repetitive Loss"
        },
        {
            id: 'FEMA 500YR Preliminary',
            grup: "Structures within FEMA Floodplain",
            lblPrefix: 'Structures within ',
            lblSuff: ' Floodplain'
        },
        {
            id: 'FEMA 500YR Effective',
            grup: "Structures within FEMA Floodplain",
            lblPrefix: 'Structures within ',
            lblSuff: ' Floodplain'
        },
        {
            id: 'FEMA 100YR Preliminary',
            grup: "Structures within FEMA Floodplain",
            lblPrefix: 'Structures within ',
            lblSuff: ' Floodplain'
        },
        {
            id: 'FEMA 100YR Effective',
            grup: "Structures within FEMA Floodplain",
            lblPrefix: 'Structures within ',
            lblSuff: ' Floodplain'
        },
        {
            id: 'Current Schools',
            data: dir + 'TWDB_Critical_Infrastructure/Current Schools.geojson',
            colormap: CUBE_HELIX, 
            grup: 'TWDB Critical Infrastructure'
        },
        {
            id: 'Fire Stations',
            data: dir + 'TWDB_Critical_Infrastructure/Fire Stations.geojson', 
            colormap: CUBE_HELIX, 
            grup: 'TWDB Critical Infrastructure'
        },
        {
            id: 'Hospitals', 
            data: dir + 'TWDB_Critical_Infrastructure/Hospitals.geojson', 
            colormap: CUBE_HELIX, 
            grup: 'TWDB Critical Infrastructure'
        },
        {
            id: 'National Shelter System Facilities',
            data: dir + 'TWDB_Critical_Infrastructure/National Shelter System Facilities.geojson', 
            colormap: CUBE_HELIX, 
            grup: 'TWDB Critical Infrastructure'
        },
        {
            id: 'Levees', 
            data: janlayerdir + 'Levees/Levees.geojson', 
            colormap: CUBE_HELIX, 
            grup: 'Built and Natural Environment Features',
        },
        {
            id: 'Dams', 
            data: janlayerdir + 'Dams/Dams.geojson', 
            colormap: CUBE_HELIX, 
            grup: 'Built and Natural Environment Features',
        },
        {
            id: 'Bridges', 
            data: janlayerdir + 'Bridges/Bridges.geojson', 
            colormap: CUBE_HELIX, 
            grup: 'Built and Natural Environment Features',
        },
    ];
    
    heatmaplyrs.forEach(heatlyr => {
        addHeatmap(map, heatlyr);
        legendlyrs.push(
            {
                id: heatlyr.id + "-point",
                parent: heatlyr.id + "",
                hidden: true,
                group: heatlyr.grup,
                directory: "Legend"
            },
            {
                id: heatlyr.id + "",
                hidden: false,
                children: [heatlyr.id + "-point"],
                group: heatlyr.grup,
                directory: "Legend",
            }
        );
    });

    // legendlyrs[legendlyrs.map((x)=>x.id).indexOf(replossId)].group = 'Repetitive Loss'
    // legendlyrs[legendlyrs.map((x)=>x.id).indexOf(replossId+'-point')].group = 'Repetitive Loss'

    // legendlyrs[legendlyrs.map((x)=>x.id).indexOf(replossId)].group = 'TWDB Critical Infrastructure'
    // legendlyrs[legendlyrs.map((x)=>x.id).indexOf(replossId+'-point')].group = 'TWDB Critical Infrastructure'

    //order layers
    fldzonelyrs.forEach(lyrId => {
        map.moveLayer('FEMA ' + lyrId)
        map.moveLayer('FEMA ' + lyrId + '-point')
    })
    map.moveLayer(replossId)
    map.moveLayer(replossId + '-point')
    huclyrs.forEach(lyrId => {
        map.moveLayer(lyrId)
    })
    
    // addHeatmap(map,'FEMA Severe Repetitive Loss Properties',reptLossData,'reptloss')
    map.on('mousemove', 'FEMA Severe Repetitive Loss Properties-point', (event) => {
        // Change the cursor style as a UI indicator.
        map.getCanvas().style.cursor = 'pointer';
        
        map.moveLayer('zipcodes', 'FEMA Severe Repetitive Loss Properties');
        map.setLayoutProperty('zipcodes', 'visibility', 'visible');
        // new mapboxgl.Popup()
        popup
            // @ts-ignore
            .setLngLat(event.features[0].geometry.coordinates)
            // @ts-ignore
            .setHTML(`<strong>Repetitive Loss Properties:</strong> ${event.features[0].properties.reptloss}<br>in zip code ${event.features[0].properties.id}`)
            .addTo(map);
        // // Copy coordinates array.
        // const coordinates = e.features[0].geometry.coordinates.slice();
        // const description = e.features[0].properties.description;
        
        // // Ensure that if the map is zoomed out such that multiple
        // // copies of the feature are visible, the popup appears
        // // over the copy being pointed to.
        // while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        // coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        // }
        
        // // Populate the popup and set its coordinates
        // // based on the feature found.
        // popup.setLngLat(coordinates).setHTML(description).addTo(map);
    });
    
    map.on('mousemove', 'zipcodes', (e) => {
        if ((e.features?.length ?? 0) > 0 && playing == false) {
            if (hoveredId !== null) {
                map.setFeatureState(
                    { source: 'zipcodes', id: hoveredId },
                    { hover: false }
                );
            }

            hoveredId = e.features![0].id ?? null;

            map.setFeatureState(
                { source: 'zipcodes', id: hoveredId ?? undefined },
                { hover: true }
            );
        }
    });
    
    // When the mouse leaves the state-fill layer, update the feature state of the
    // previously hovered feature.
    map.on('mouseleave', 'zipcodes', () => {
        if (hoveredId !== null) {
            map.setFeatureState(
                { source: 'zipcodes', id: hoveredId },
                { hover: false }
            );
        
        }
        hoveredId = null;
        map.setLayoutProperty('zipcodes', 'visibility', 'none');
        map.getCanvas().style.cursor = '';
        popup.remove();
    });

    huclyrs.forEach(huc => {
        map.on('click', huc + '-fill', (event) => {
            popup
                .setLngLat(event.lngLat)
                .setHTML(`<strong>${huc}</strong> ${event.features![0].properties!.name}<br>
                    ${event.features![0].properties!.huc8}`)
                .addTo(map);
        });     

        map.on('mouseleave', huc + '-fill', () => {
            map.getCanvas().style.cursor = '';
            popup.remove();
        });

        map.on('mouseenter', huc + '-fill', (_) => {
            // Change the cursor style as a UI indicator.
            map.getCanvas().style.cursor = 'pointer';
        })
    })

    fldzonelyrs.forEach(lyrId => {
        map.on('click', lyrId, (event) => {
            popup
                .setLngLat(event.lngLat)
                .setHTML(`<strong>FEMA ${lyrId} Floodplain</strong>`)
                .addTo(map);
        });     
        
        map.on('mouseleave', lyrId, () => {
            map.getCanvas().style.cursor = '';
            popup.remove();
        });
            
        map.on('mouseenter', lyrId, (_) => {
            // Change the cursor style as a UI indicator.
            map.getCanvas().style.cursor = 'pointer';
        })
    }); 

    // Obervations
    const observations = [
        {
            id: 'USGS Stream Gauges', 
            url: `${janlayerdir}${encodeURIComponent('USGS Gages')}/Neches_gages_fixed.geojson`,
            color: '#446100'
        },
        {
            id: 'NOAA Stream Gauges', 
            url: `${janlayerdir}${encodeURIComponent('NOAA Gages')}/NOAA_Gauges.geojson`,
            color: '#489DD5',
        },
        {
            id: 'NOAA GHCN Gauges',
            url: `${janlayerdir}${encodeURIComponent('NOAA GHCN Gauges')}/${encodeURIComponent('NOAA GHCN Gauges')}.geojson`,
            color: '#2A76D5'
        }
    ]; 

    observations.forEach(o => {
        map.addSource(o.id, {
            type: 'geojson',
            data: o.url,
        });
        map.addLayer({
            id: o.id, 
            source: o.id,
            type: 'circle', 
            paint: {
                "circle-color": o.color, 
                "circle-radius": 6,
            }, 
            layout: {
                'visibility': 'none',
            },
        });
    
        legendlyrs.push({
            id: o.id,
            hidden: false,
            group: "Observations",
            directory: "Legend"
        });

        map.on('mouseleave', o.id, () => {
            map.getCanvas().style.cursor = '';
            popup.remove();
        });
    
        map.on('mouseenter', o.id, (event) => {
            // @ts-ignore
            if (event.features[0].properties.Location) {
                popup
                    .setLngLat(event.lngLat)
                    // @ts-ignore
                    .setHTML(`<strong>${event.features[0].properties.Location}</strong><br><span>${event.features[0].properties.GaugeLID}</span>`)
                    .addTo(map);
                // Change the cursor style as a UI indicator.
                map.getCanvas().style.cursor = 'pointer';
                // @ts-ignore
            } else if (event.features[0].properties.STATION_NM) {
                popup
                    .setLngLat(event.lngLat)
                    // @ts-ignore
                    .setHTML(`<strong>${event.features[0].properties.STATION_NM}</strong><br><span>${event.features[0].properties.SITE_NO}</span>`)
                    .addTo(map);
                // Change the cursor style as a UI indicator.
                map.getCanvas().style.cursor = 'pointer';
                // @ts-ignore
            } else if (event.features[0].properties.Name) {
                popup
                    .setLngLat(event.lngLat)
                    // @ts-ignore
                    .setHTML(`<strong>${event.features[0].properties.Name}</strong>`)
                    .addTo(map);
                // Change the cursor style as a UI indicator.
                map.getCanvas().style.cursor = 'pointer';
                // @ts-ignore
            } else if (event.features[0].properties.Field1) {
                popup
                    .setLngLat(event.lngLat)
                    // @ts-ignore
                    .setHTML(`<strong>${event.features[0].properties.Field1}</strong><br><span>${event.features[0].properties.Field6}${typeof event.features[0].properties.Field7 === 'string' ? ' ' + event.features[0].properties.Field7 : ''}, ${event.features[0].properties.Field5}</span>`)
                    .addTo(map);
                // Change the cursor style as a UI indicator.
                map.getCanvas().style.cursor = 'pointer';
            }
        })
    });
}

map.on('load', async () => {
    await loadMapboxImage(map, 'https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png', 'custom-marker');
    await loadLayers()
    
    legendConfig = {
        collapsed: true,
        layers: legendlyrs
    }

    map.addControl(new LayerControlGrouped(legendConfig), "top-left")
    map.addControl(
        new MapboxGeocoder({
            accessToken: mapboxgl.accessToken,
            mapboxgl: mapboxgl
        })
    )
    
    // map.setLayoutProperty('HUC8', 'visibility', 'none')
    // map.setLayoutProperty('HUC10', 'visibility', 'none')
    // map.setLayoutProperty('HUC12', 'visibility', 'none')
    
    
    popup = new mapboxgl.Popup({
        // className: "popup",
        closeButton: false,
        closeOnClick: false
    });

    playing = false
    let urlParams = new URLSearchParams(window.location.search)
    // console.log(urlParams.keys())
    
    if (urlParams.toString().includes(replossId.replaceAll(' ', '+'))) {
        tutorial(map) //only if on base url
    }
})

// addMap()
function pointerData(x, y) {
    // return [[x,y],[x+10,y+10],[x+20,y]]
    return {
        'type': 'Point',
        'coordinates': [x, y] 
    }
    //TODO: mouse outline:
    let coords = [ //why extra [] no idea
        [[x, y],
        [x + 0.0279833, y + 0.00227988],
        [x + 0.02224666, y - 0.00885596],
        [x + 0.03879149, y - 0.0172458],
        [x + 0.03496963, y - 0.02466469],
        [x + 0.0184248, y - 0.01627485],
        [x + 0.0184248, y - 0.01627485],
        [x + 0.01268816, y - 0.02741069]] 
    ]
    return {
        'type': 'Feature',
        'geometry': {
            'type': 'Polygon',
            'coordinates': coords
        }
    }
}

const restyle = async (layerId) => {
    await map.setStyle('mapbox://styles/mapbox/' + layerId);
    
    // await sleep(15)
    await loadLayers()

    //refresh lyrs
    let params: any = await new URLSearchParams(window.location.search)

    let myparams = await zip(params.keys(), Array.from(params.values()))

    Array.from(params.keys()).forEach(param => {
        params.delete(param)
    })

    // console.log(myparams)
    myparams.forEach(param => {
        params.set(param[0], param[1])
    })

    let url = window.location.protocol + "//" + window.location.host + window.location.pathname + "?" + params.toString() + window.location.hash;
    window.history.replaceState({
        path: url
    }, '', url);

    let _layers = [...params.keys()];

    _layers.map(function (l) {
        // if (keys.indexOf(l) > -1) {
        // let visibility = GetLayerVisibility(_mapLayers, _ids, l);
        // if (!visibility) {
        map.setLayoutProperty(l, "visibility", "visible")
        // }
        // }
    });
}

// @ts-ignore
for (const input of inputs) {
    input.onclick = async (layer) => {

        map.once("styledata", async () => {
            await loadLayers()

            //refresh lyrs
            let params: any = await new URLSearchParams(window.location.search)
            let myparams = await zip(params.keys(), Array.from(params.values()))

            Array.from(params.keys()).forEach(param => {
                params.delete(param)
            })

            // console.log(myparams)
            myparams.forEach(param => {
                params.set(param[0], param[1])
            })
            
            let url = window.location.protocol + "//" + window.location.host + window.location.pathname + "?" + params.toString() + window.location.hash;
            window.history.replaceState({
                path: url
            }, '', url);

            let _layers = [...params.keys()];

            _layers.map(function (l) {
                // if (keys.indexOf(l) > -1) {
                // let visibility = GetLayerVisibility(_mapLayers, _ids, l);
                // if (!visibility) {
                map.setLayoutProperty(l, "visibility", "visible")
                // }
                // }
            });

            // map.base_layers = darkv10.layers
            // console.log(map.base_layers)
            // map.hide_base_layers = function() {
            //     for (var v in map.base_layers) {
            //         map.setLayoutProperty(map.base_layers[v]['id'], 'visibility', 'none');
            //     }
            // }
            // map.show_base_layers = function() {
            //     for (var v in map.base_layers) {
            //         map.setLayoutProperty(map.base_layers[v]['id'], 'visibility', 'visible');
            //     }
            // }
            // map.hide_base_layers()
            // map.show_base_layers()
        });

        const layerId = layer.target.id;
        // await restyle(layerId)
        await map.setStyle('mapbox://styles/mapbox/' + layerId);
        
    }
}


// After the last frame rendered before the map enters an "idle" state.
// map.on('idle', () => {
// // If these two layers were not added to the map, abort
// if (!map.getLayer('FEMA Severe Repetitive Loss Properties') || !map.getLayer('FEMA Severe Repetitive Loss Properties-point')) {
// return;
// }
 
// // Enumerate ids of the layers.
// const toggleableLayerIds = ['contours', 'museums'];
 
// // Set up the corresponding toggle button for each layer.
// for (const id of toggleableLayerIds) {
// // Skip layers that already have a button set up.
// if (document.getElementById(id)) {
// continue;
// }
 
// // Create a link.
// const link = document.createElement('a');
// link.id = id;
// link.href = '#';
// link.textContent = id;
// link.className = 'active';
 
// // Show or hide layer when the toggle is clicked.
// link.onclick = function (e) {
// const clickedLayer = this.textContent;
// e.preventDefault();
// e.stopPropagation();
 
// const visibility = map.getLayoutProperty(
// clickedLayer,
// 'visibility'
// );
 
// // Toggle layer visibility by changing the layout object's visibility property.
// if (visibility === 'visible') {
// map.setLayoutProperty(clickedLayer, 'visibility', 'none');
// this.className = '';
// } else {
// this.className = 'active';
// map.setLayoutProperty(
// clickedLayer,
// 'visibility',
// 'visible'
// );
// }
// };
 
// const layers = document.getElementById('menu');
// layers.appendChild(link);
// }
// });

