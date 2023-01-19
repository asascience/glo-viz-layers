import type mapboxgl from 'mapbox-gl';

export interface HeatmapLayer {
    id: string,
    data?: any,
    coloramp?: any,
    densityAttr?: string,
    labelPrefix?: string,
    labelStuff?: string,
}

export function addHeatMapLayer(map: mapboxgl.Map, popup: mapboxgl.Popup, layer: HeatmapLayer, layerUrlPath: string,
    q0: number = 1, q1: number = 20, q2: number = 300) {

    map.addSource(layer.id, {
        type: 'geojson',
        data: layer.data ?? `${layerUrlPath}/${encodeURIComponent(layer.id)}.geojson`,
    });

    if (layer.densityAttr !== undefined) {
        map.addLayer(
            {
                id: layer.id,
                type: 'heatmap',
                source: layer.id,
                // 'maxzoom': 8,
                layout: { 'visibility': 'none' },
                paint: {
                    // Increase the heatmap weight based on frequency and property magnitude
                    'heatmap-weight': [
                        'interpolate',
                        ['linear'],
                        ['get', layer.densityAttr],
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
                        ...layer.coloramp],
                    // Adjust the heatmap radius by zoom level
                    'heatmap-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        1,
                        4
                        ,
                        7,
                        ['interpolate', ['linear'], ['get', layer.densityAttr], q0, 4, q1, 40, q2, 70],
                        22,
                        ['interpolate', ['linear'], ['get', layer.densityAttr], q0, 5, q1, 100, q2, 150]
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
                'id': layer.id + '-point',
                'type': 'circle',
                'source': layer.id,
                'minzoom': 10,
                'layout': { 'visibility': 'none' },
                'paint': {
                    // Size circle radius by earthquake magnitude and zoom level
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        7,
                        ['*', 0.6, ['interpolate', ['linear'], ['get', layer.densityAttr], q0, 4, q1, 40, q2, 70]],
                        22,
                        ['*', 0.6, ['interpolate', ['linear'], ['get', layer.densityAttr], q0, 5, q1, 100, q2, 150]]
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
        const s0 = 5
        const s1 = 7
        map.addLayer(
            {
                'id': layer.id + '',
                'type': 'heatmap',
                'source': layer.id,
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
                        ...layer.coloramp],
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
                'id': layer.id + '-point',
                'type': 'circle',
                'source': layer.id,
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

        map.on('mouseleave', layer.id + '-point', () => {
            map.getCanvas().style.cursor = '';
            popup.remove();
        });

        map.on('mouseenter', layer.id + '-point', (event) => {
            popup
                .setLngLat(event.lngLat)
                .setHTML(`<strong>${layer.labelPrefix ?? ''}${layer.id}${layer.labelStuff ?? ''}</strong>`)
                .addTo(map);
            // Change the cursor style as a UI indicator.
            map.getCanvas().style.cursor = 'pointer';
        })
    }
}

export function addZipCodesLayer(map: mapboxgl.Map, layerUrlPath: string) {
    map.addSource('zipcodes', {
        type: 'geojson',
        data: layerUrlPath + '/zip.geojson',
        promoteId: 'zip'
        // 'generateId':true
    });

    map.addLayer(
        {
            id: 'zipcodes',
            type: 'fill',
            source: 'zipcodes',
            // 'maxzoom': 8,
            paint: {
                'fill-color': 'blue',
                // 'fill-width': 3,
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false],
                    .3,
                    0
                ]
            },
            layout: { 'visibility': 'none' } //on load
        }
        // ,'FEMA Severe Repetitive Loss Properties' //add underneath
    )
}

export function addFEMAStreams(map: mapboxgl.Map, popup: mapboxgl.Popup, layerUrlPath: string) {
    const layerId = "FEMA NHD Streams";

    map.addSource(layerId, {
        type: 'geojson',
        data: `${layerUrlPath}/${encodeURIComponent(layerId)}.geojson`,
    });

    map.addLayer(
        {
            id: layerId,
            type: 'line',
            source: layerId,
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
    );

    map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
    });

    map.on('mouseenter', layerId, (event) => {
        if (event.features[0].properties.GNIS_Name != 'nan') {
            popup
                .setLngLat(event.lngLat)
                .setHTML(`<strong>${event.features[0].properties.GNIS_Name}</strong>`)
                .addTo(map);
            // Change the cursor style as a UI indicator.
            map.getCanvas().style.cursor = 'pointer';
        }
    });
}

export async function addCDBGMITProposedProjects(map: mapboxgl.Map, popup: mapboxgl.Popup, layerUrlPath: string) {
    await map.loadImage(
        'https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png',
        async (error, image) => {
            if (error) throw error;
            await map.addImage('custom-marker', image)
        });

    const layerId = 'CDBG-MIT Proposed Projects';

    map.addSource(layerId + '-src', {
        'type': 'geojson',
        'data': `${layerUrlPath}/${encodeURIComponent(layerId)}.geojson`,
        cluster: true,
        // clusterMaxZoom: 10, // Max zoom to cluster points on
        // clusterRadius: 0.0003 // Radius of each cluster when clustering points (defaults to 50)
    });

    map.addLayer(
        {
            id: layerId,
            type: 'symbol',
            // 'sprite':'https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png',
            source: layerId + '-src',
            // filter: ['has', 'point_count'],
            layout: {
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
    );

    map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
    });

    map.on('mousemove', layerId, (event) => {
        if ((event.features[0].properties.cluster ?? false) === true) {
            popup
                .setLngLat(event.lngLat)
                .setHTML(`<strong>${event.features[0].properties.point_count} Projects</strong><br>`)
                .addTo(map);
        } else if (event.features[0].properties.Site_Title !== undefined) {
            popup
                .setLngLat(event.lngLat)
                .setHTML(`<strong>${event.features[0].properties.Site_Title}</strong><br>${event.features[0].properties.Status}`)
                .addTo(map);
            // Change the cursor style as a UI indicator.
            map.getCanvas().style.cursor = 'pointer';
        }
    });
}

export interface OutlineLayer {
    id: string,
    subdirectory?: string,
    color: string,
    label?: string,
}

export function addOutlineLayer(map: mapboxgl.Map, layer: OutlineLayer, layerUrlPath: string) {
    map.addSource(layer.id, {
        type: 'geojson',
        data: `${layerUrlPath}/${layer.subdirectory ?? ''}${encodeURIComponent(layer.id)}.geojson`,
    });

    map.addLayer(
        {
            id: layer.id,
            type: 'line',
            source: layer.id,
            paint: {
                'line-color': layer.color,
                "line-width": 1.3
                // "line-opacity": .8
            },
            layout: { 'visibility': 'none' } //on load
        }
        // ,'FEMA Severe Repetitive Loss Properties' //add underneath
    );

    map.addLayer(
        {
            id: layer.id + '-lbl',
            type: 'symbol',
            source: layer.id,
            // paint: {
            //         "fill-opacity": 0
            // },
            paint: {
                "text-color": layer.color,
                'text-halo-width': 2,
                'text-halo-blur': 1,
                'text-halo-color': 'black',
            },
            layout: {
                'text-field': layer.label ?? '',
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
    );
}

export function add100YrBLE(map: mapboxgl.Map, layerUrlPath: string) {
    const layerId = '100YR_FEMA_BLE';

    // console.log(dir+encodeURIComponent(lyrId)+'.mbtiles' )
    map.addSource(layerId, {
        type: 'raster',
        tiles: [`${layerUrlPath}/${encodeURIComponent(layerId)}/{z}/{x}/{y}.png`],
        // 'tiles': dir+encodeURIComponent(lyrId)+'.mbtiles'
        minzoom: 7,
        maxzoom: 13
    });

    map.addLayer(
        {
            id: layerId,
            type: 'raster',
            source: layerId,
            layout: { 'visibility': 'none' } //on load
        }
        // ,'FEMA Severe Repetitive Loss Properties' //add underneath
    );
}

export function addTxDOTOvertoppping(map: mapboxgl.Map, layerUrlPath: string) {
    const layerId = 'TxDOT Overtopping';

    // console.log(dir+encodeURIComponent(lyrId)+'.mbtiles' )
    map.addSource(layerId, {
        type: 'geojson',
        data: `${layerUrlPath}/${encodeURIComponent(layerId)}.geojson`,
        generateId: true
    }); 

    map.addLayer(
        {
            id: layerId,
            type: 'line',
            source: layerId,
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
            layout: { 'visibility': 'none' } //on load
        }
        // ,'FEMA Severe Repetitive Loss Properties' //add underneath
    ); 


}