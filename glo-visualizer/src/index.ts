import 'mapbox-gl/dist/mapbox-gl.css'; 
import 'mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'; 
import './style.css';

import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from 'mapbox-gl-geocoder';
import { CUBE_HELIX, TURBO, VIRIDIS } from './colormaps';
import { getActiveLayers, getAllChecked, getLayerVisibility, getMapLayerIds, getStyle, setLayerVisibility, toggleChildren } from './utils';

mapboxgl.accessToken = 'pk.eyJ1Ijoib3BlbnNvdXJjZXJlciIsImEiOiJja3lsbzNveHAwbndkMnZwZXYxeWxnM3pzIn0.BD4akCoe1u4dg7gcl3J4cQ';

// Global vars
let popup: mapboxgl.Popup;
let playing = false
let legendConfig: any;
let hoveredId: string | number | null = null;
let legendlyrs: any[] = [];
let reptLossData: any;
const replossId = 'FEMA Severe Repetitive Loss Properties'

const zip = (a, b) => Array.from(a).map((k, i) => [k, Array.from(b)[i]])


class layerControlGrouped {

    _collapsed: boolean = false;
    _addLayers: boolean = false; 
    _layers: any[];
    _layerIds: string[];
    _directories: string[];
    _groups: string[];
    _layerControlConfig: any;

    _map: mapboxgl.Map | undefined;
    _sources: any[] = [];
    _div: any = undefined;
    _container: any = undefined;

    _activeLayers: string[] = [];
    _mapLayers: any[] = [];
    _mapLayerIds: string[] = [];

    constructor(options) {
        options = (!options) ? {} : options;

        if ((options.options && options.options.collapsed) || (options && options.collapsed)) {
        this._collapsed = true;
        }

        if ((options.options && options.options.addLayers)) {
        this._addLayers = true;
        }

        this._layers = options.layers.reverse().slice()
        this._layerIds = this._layers.reduce((i,l) => {
        return [...i, l.id]
        }, [])
        
        let directories = [];
        let groups = [];

        directories = this._layers.reduce(function (i, layer) {
        return [...i, layer.directory]
        }, []);

        this._directories = [...new Set(directories)];

        groups = this._layers.reduce(function (i, layer) {
        if (!layer.group) layer.group = "Operational Layers"
        return [...i, layer.group]
        }, []);

        this._groups = [...new Set(groups)];

        let config = {};

        this._directories.forEach(function (d) {
        options.layers.forEach(function (layer) {
            if (layer.directory === d) {
            config[layer.directory] = {}
            }
        })
        })

        this._layers.forEach(function (l) {
        if (!l.group) l.group = "Operational Layers";
        config[l.directory][l.group] = []
        })

        this._layers.forEach(function (l) {
        config[l.directory][l.group].push(l)
        });

        let layersClone = this._layers.slice();

        //CREATE A LAYERS GROUP IN METADATA FOR FILTERING
        this._layers.forEach(function (l) {
        if (!l.name) l.name = l.id
        //ADD METADATA AND METADATA.LAYERS IF NOT EXIST
        if (!l.metadata) {
            l.metadata = {};
        }
        if (!l.metadata.layers) l.metadata.layers = [l.id];

        //ADD CHILD LAYERS IF ANY
        if (l.children) {
            layersClone.forEach(child => {
            if (child.parent && child.parent === l.id) l.metadata.layers = [...l.metadata.layers, child.id]
            })
        }
        })

        this._layerControlConfig = config

        // this._layers.forEach(l => {
        //   Object.keys(l).map(k => {
        //     l.metadata[k] = l[k]
        //   })
        // })

        // console.log(config)

        // TARGET CONFIG LAYOUT
        // this._layerControlConfig = {
        //     directory1: {
        //       groupName: [
        //         {
        //           id: "id",
        //           name: "name",
        //           legend: "html"
        //         }
        //       ]
        //     },
        //     directory2: {
        //       groupName: [
        //         {
        //           id: "id",
        //           name: "name",
        //           legend: "html"
        //         }
        //       ]
        //     }
        //   }
    }

    onAdd(map) {

        this._map = map;
        let _this = this;
        this._sources = []; //only add the lazyLoading source information to one layer

        this._container = map.getContainer();

        // SETUP MAIN MAPBOX CONTROL
        this._div = lcCreateButton(this._collapsed);

        // GET THE MAP LAYERS AND LAYER IDS AND SET TO VISIBLE ANY LAYER IDS IN THE QUERY PARAMS, AND ADD THEM TO THE QUERY PARAMS IF MISSING
        const activeLayers = getActiveLayers(this._map, this._layers);

        this._layers.forEach(l => {

        // CHECK TO MAKE SURE ALL CHILDREN ARE ACTIVE IF PARENT IS ACTIVE
        if (l.parent && activeLayers.includes(l.parent)) {
            map.setLayoutProperty(l.id, "visibility", "visible");
            lcSetActiveLayers(l.id, true)
        }

        //NO ORPHANED CHILDREN
        if (l.parent && activeLayers.includes(l.id) && !activeLayers.includes(l.parent)) {
            map.setLayoutProperty(l.id, "visibility", "none");
            map.setLayoutProperty(l.parent, "visibility", "none");
            lcSetActiveLayers(l.id, false)
        }
        })

        this._activeLayers = getActiveLayers(this._map, this._layers)
        this._mapLayers = this._map!.getStyle().layers;
        this._mapLayerIds = getMapLayerIds(this._mapLayers);

        // console.log(this._mapLayerIds, this._layers)

        //BUILD DIRECTORIES, GROUPS, LAYER TOGGLES AND LEGENDS FROM THE layerControlConfig
        for (let d in this._layerControlConfig) {

        //CREATE DIRECTORY
        let directory = d;

        let layerCount = 0;

        this._layers.forEach(l => {
            if (l.directory === d && !l.parent) {
            var checked = getLayerVisibility(this._mapLayers, this._mapLayerIds, l.id);
            if (checked) {
                layerCount = layerCount + 1
            }
            }
        })

        let directoryDiv = lcCreateDicrectory(directory, layerCount);

        //CREATE TOGGLE GROUPS
        for (let g in this._layerControlConfig[d]) {

            let groupDiv = lcCreateGroup(g, this._layerControlConfig[d][g], map)

            let groupLayers = this._layerControlConfig[d][g];

            // CREATE INDIVIDUAL LAYER TOGGLES
            for (let l = 0; l < groupLayers.length; l++) {
            let layer = groupLayers[l];
            let style = getStyle(this._mapLayers, layer);
            if (!layer.legend && style) {
                layer.simpleLegend = lcCreateLegend(style)
            }
            let checked;
            checked = getLayerVisibility(this._mapLayers, this._mapLayerIds, layer.id);
            // if (layer.parent) {
            //   checked = GetLayerVisibility(this._mapLayers, this._mapLayerIds, layer.parent);
            // }
            let { layerSelector, newSources } = lcCreateLayerToggle(this._map, layer, checked, this._sources);
            this._sources = newSources;
            groupDiv.appendChild(layerSelector)
            }
            directoryDiv.appendChild(groupDiv);
        }

        this._div.appendChild(directoryDiv)
        }

        /****
         * ADD EVENT LISTENERS FOR THE LAYER CONTROL ALL ON THE CONTROL ITSELF
         ****/
        if (this._collapsed) {
        this._div.addEventListener("mouseenter", function (e) {
            setTimeout(function () {
            e.target.classList.remove("collapsed")
            }, 0)
            return
        });
    
        this._div.addEventListener("mouseleave", function (e) {
            e.target.classList.add("collapsed")
            return
        });
        }

        this._div.addEventListener("click", function (e) {
        // console.log(e.target);

        if (e.target.dataset.layerControl) {
            e.target.classList.remove("collapsed");
            return
        }

        if (e.target.className === "checkbox") {
            e.target.children[0].click();
            // e.target.blur()
            return
        }

        if (e.target.dataset.mapLayer) {
            setLayerVisibility(map, e.target.checked, e.target.id);
            if (e.target.dataset.children) {
                let children = document.querySelectorAll("[data-parent]");
                for (let i = 0; i < children.length; i++) {
                    // @ts-ignore
                    if (children[i].dataset.parent === e.target.id) {
                        // @ts-ignore
                        children[i].click()
                    }
                }
            }
        // e.target.blur()              
            return
        }

        if (e.target.dataset.mapLayer && e.target.dataset.group != false) {
            e.stopPropagation();
            let group = e.target.dataset.group;
            let groupMembers = document.querySelectorAll("[data-group]");
            for (let i = 0; i < groupMembers.length; i++) {
                // @ts-ignore
                if (group != "false" && groupMembers[i].dataset.group === group) {
                    setLayerVisibility(map, e.target.checked, groupMembers[i].id);
                }
            }
            return
        }

        if (e.target.dataset.layergroup) {
            // console.log("layergroup")
            let inputs = e.target.parentElement.querySelectorAll("[data-master-layer]");
            // CHECK IF ANY OF THE BOXES ARE NOT CHECKED AND IF NOT THEM CHECK THEM ALL
            if (!getAllChecked(inputs)) {
            for (let i = 0; i < inputs.length; i++) {
                if (!inputs[i].checked) {
                inputs[i].click()
                }
            }
            }
            // IF ALL OF THE BOXES ARE CHECKED, UNCHECK THEM ALL
            else {
            for (let i = 0; i < inputs.length; i++) {
                let checkbox = inputs[i];
                if (checkbox.checked) {
                checkbox.click()
                }
            }
            }
            return
        }

        if (e.target.dataset.directoryToggle) {
            if (e.target.parentElement.children[2].style.display != "none") {
            e.target.parentElement.children[0].className = "collapsed"
            } else {
            e.target.parentElement.children[0].className = ""
            }
            toggleChildren(e.target.parentElement, 2)

            setTimeout(function() {
            if (!isScrolledIntoView(e.target.parentElement)) {
                window.location.hash = e.target.id;
            }
            },410);
            setTimeout(function() {
            _this._map?.resize()
            },450)
            return
        }
        })

        if (this._collapsed) {
        this._map?.on("click", function () {
            _this._div.classList.add("collapsed")
        })
        }

        //NEED TO SET THIS AT THE BEGINNING PASS IN CURRENT ZOOM OF MAP AND SET DISABLED PROPERTY THIS ALSO BINGS IN WEIRD THINGS WITH THE CHECK ALL GROUP BUT TACKLE THAT LATER
        this._map?.on("zoomend", function () {
            // @ts-ignore
            let zoomendMap = this;
            let lcLayers = document.querySelectorAll("[data-master-layer]");
            lcLayers.forEach(function (l) {
                // @ts-ignore
                if (l.dataset.minzoom && l.dataset.minzoom > zoomendMap.getZoom()) {
                    // @ts-ignore
                    l.parentElement.style.opacity = "0.3"
                    // @ts-ignore
                    l.disabled = true
                } else {
                    // @ts-ignore
                    l.parentElement.style.opacity = "1"
                    // @ts-ignore
                    l.disabled = false
                }
            });
        })

        return this._div;
    }

    onRemove(map) {
        this._map = map;
        this._div.parentNode.removeChild(this._div);
        this._map = undefined;
    }
}

/****
 * HELPER FUNCTIONS
 ****/

function lcCreateLayerToggle(map, layer, checked, sources) {
    let div = document.createElement("div");
    div.className = "checkbox";
    div.title = "Map Layer";

    if (layer.hidden) {
        div.style.display = "none";
        // @ts-ignore
        div.dataset.hidden = true
    }

    let input = document.createElement("input");
    input.name = (!layer.name) ? layer.id : layer.name;
    input.type = "checkbox"
    input.id = layer.id;
    input.dataset.group = (layer.group) ? layer.group : false;

    if (layer.metadata.lazyLoading && layer.metadata.source && layer.metadata.source.id && layer.metadata.source.type && layer.metadata.source.data) {
        //only add the source to one layer to avoid loading the same file simultaneously - not really working...need to do this per layer group
        // if (!sources.includes()) {
        // console.log("adding lazy loading info for", layer.id)
        // @ts-ignore
        input.dataset.lazyLoading = true;
        input.dataset.source = layer.metadata.source.id
        input.dataset.sourceType = layer.metadata.source.type
        input.dataset.sourceData = layer.metadata.source.data
        sources.push(layer.metadata.source.id)
        // }
    }

    if (layer.minzoom) {
        input.dataset.minzoom = layer.minzoom
    }

    if (layer.children) {
        // @ts-ignore
        input.dataset.children = true;
        // @ts-ignore
        input.dataset.masterLayer = true;
    }
    if (layer.parent) {
        input.dataset.parent = layer.parent;
    } else {
        // @ts-ignore
        input.dataset.masterLayer = true;
    }

    input.className = "layer slide-toggle";
    // @ts-ignore
    input.dataset.mapLayer = true;
    if (checked) input.checked = true;

    lcCheckLazyLoading(map, input);

    input.onclick = function () {
        lcCheckLazyLoading(map, this)
        // @ts-ignore
        lcSetActiveLayers(this.id, this.checked)
        lcSetLegendVisibility(this)
        lcSetDirectoryLayerCount(this);
    };

    let label = document.createElement("label");
    label.setAttribute("for", layer.id);
    let legend = document.createElement("div");
    if (layer.legend) {
        label.innerText = (!layer.name) ? layer.id : layer.name;
        legend.innerHTML = layer.legend;
        legend.className = "mgl-layerControlLegend";
        legend.dataset.layerChildLegend = "true"
        if (!checked) {
        legend.style.display = "none"
        }
    } else if (layer.simpleLegend) {
        label.innerHTML += layer.simpleLegend;
        label.innerHTML += (!layer.name) ? layer.id : layer.name;
        label.className = "mgl-layerControlLegend"
    } else {
        label.innerText = (!layer.name) ? layer.id : layer.name;
    }
    label.dataset.layerToggle = "true";

    div.appendChild(input);
    div.appendChild(label);

    if (layer.metadata && layer.metadata.filterSchema) {
        let filterSpan = document.createElement("span");
        filterSpan.style.float = "right";
        filterSpan.style.height = "20px";
        filterSpan.style.opacity = "0.3";
        filterSpan.innerHTML = filterIcon();
        filterSpan.onclick = function() {
        filterModal(map, layer)
        }
        filterSpan.onmouseenter = function() {
            // @ts-ignore
            this.style.opacity = 1;
        }
        filterSpan.onmouseleave= function() {
            // @ts-ignore
            this.style.opacity = 0.3;
        }
        div.appendChild(filterSpan)
    }

    div.appendChild(legend);

    return { layerSelector: div, newSources: sources }
}

function lcCheckLazyLoading(map, layer) {
    if (layer.dataset.lazyLoading && layer.checked && !layer.dataset.sourceLoaded) {
        const source = map.getSource(layer.dataset.source);
        if (!source) return
        //not sure if using this internal property is the best way to check for this information
        //if multiple layers are using the same data, we could be fetching data as another data is also being fetched
        //maybe keep an internal variable of sources loaded to not load the same souce twice
        if (!source._data.features.length) {
        const loading = loadingIcon(map)
        fetch(layer.dataset.sourceData, {
            cache: "force-cache"
        })
        .then(res => res.json())
        .then(data => {
            //CHECK SOURCE AGAIN
            const newSource = map.getSource(layer.dataset.source);
            if ((newSource._data.features && !newSource._data.features.length) || (newSource._data.geometries && !newSource._data.geometries.length)) {
            map.getSource(layer.dataset.source).setData(data);
            }
            loading.style.display = "none";
            loading.remove();
            layer.setAttribute('data-source-loaded', true)
        })
        }
    };
}

function lcSetDirectoryLayerCount(e) {
    let targetDirectory = e.closest(".mgl-layerControlDirectory")
    let targetChildren = targetDirectory.querySelectorAll("[data-master-layer]");
    let targetCount = 0;
    targetChildren.forEach(function (c) {
        if (c.checked) targetCount = targetCount + 1;
    })
    if (targetCount > 0) {
        targetDirectory.children[1].children[0].innerHTML = targetCount;
        targetDirectory.children[1].children[0].style.display = "block"
    } else {
        targetDirectory.children[1].children[0].style.display = "none"
    }
}

function lcCreateDicrectory(directoryName, layerCount) {

    let accordian = document.createElement("div");
    // @ts-ignore
    accordian.dataset.accordian = true;
    accordian.style.backgroundColor = "white";
    accordian.className = "mgl-layerControlDirectory";

    let button = document.createElement("button");
    // @ts-ignore
    button.dataset.directoryToggle = true

    accordian.appendChild(button);

    let d = document.createElement("div");
    d.className = "directory"
    d.id = directoryName.replace(/ /g, "_");
    d.innerText = directoryName;
    d.dataset.name = directoryName;
    // @ts-ignore
    d.dataset.directoryToggle = true

    var counter = document.createElement("span");
    counter.style.background = "#0d84b3";
    counter.className = "mgl-layerControlDirectoryCounter";
    counter.style.display = (layerCount === 0) ? "none" : "block";
    counter.innerText = (!layerCount) ? "" : layerCount
    counter.style.float = "right";
    counter.style.color = "white";
    counter.style.padding = "1px 4px 0";
    d.appendChild(counter)

    accordian.appendChild(d);
    return accordian;
}

function lcCreateGroup(group, layers, map) {
    let titleInputChecked = false;
    // GET CHECKED STATUS OF LAYER GROUP
    // for (let i = 0; i < layers.length; i++) {
    //   let l = layers[i];
    //   console.log(l)
    //   if(map.getLayoutProperty(l.id, "visibility") === "visible") {
    //     titleInputChecked = true
    //     continue
    //   }else{
    //     break
    //   }
    // }

    let titleInputContainer = document.createElement("div");
    titleInputContainer.style.margin = "4px 0 4px 8px"

    let titleInput = document.createElement("input");
    titleInput.type = "checkbox";
    let titleInputId = "layerGroup_" + group.replace(/ /g, "_");
    titleInput.id = titleInputId;
    titleInput.style.display = "none";
    titleInput.dataset.layergroup = group;

    if (titleInputChecked) titleInput.checked = true

    let titleInputLabel = document.createElement("label");
    titleInputLabel.setAttribute("for", titleInputId);
    titleInputLabel.className = "mgl-layerControlGroupHeading"
    titleInputLabel.textContent = group;

    // let titleSettings = document.createElement("span");
    // titleSettings.style.position = "absolute";
    // titleSettings.style.right = "5px";
    // titleSettings.style.opacity = "0.8";
    // titleSettings.innerHTML = "<img src='https://icongr.am/material/dots-vertical.svg' height='24px'></img>"
    // titleInputLabel.appendChild(titleSettings);

    titleInputContainer.appendChild(titleInput);
    titleInputContainer.appendChild(titleInputLabel);

    return titleInputContainer;
}

function lcCreateButton(collapsed) {
    let div = document.createElement('div');
    div["aria-label"] = "Layer Control";
    div.dataset.layerControl = "true"
    div.className = 'mapboxgl-ctrl mapboxgl-ctrl-group mgl-layerControl';
    if (collapsed) div.classList.add("collapsed");

    return div
}

function lcCreateLegend(style) {
    let type = Object.keys(style)
    let legend: string | undefined = undefined;
    if (type.indexOf("line-color") > -1 && isString(style["line-color"])) {
        legend = `<icon class='fa fa-minus' style='color:${style["line-color"]};margin-right:6px;'></icon>`;
    }
    if (type.indexOf("fill-color") > -1 && isString(style["fill-color"])) {
        legend = `<icon class='fa fa-square' style='color:${style["fill-color"]};margin-right:6px;'></icon>`;
    }
    if (type.indexOf("circle-color") > -1 && isString(style["circle-color"])) {
        legend = `<icon class='fa fa-circle' style='color:${style["circle-color"]};margin-right:6px;'></icon>`;
    }

    return legend
}

function isString(value) {
    return typeof value === 'string' || value instanceof String;
}

function lcSetActiveLayers(l, checked) {
    let _layer = l;
    let _visibility = checked;
    let params = new URLSearchParams(window.location.search);
    if (_visibility) {
        params.set(_layer, "true");
        let url = window.location.protocol + "//" + window.location.host + window.location.pathname + "?" + params.toString() + window.location.hash;
        window.history.replaceState({
            path: url
        }, '', url);
    } else {
        params.delete(_layer);
        let url = window.location.protocol + "//" + window.location.host + window.location.pathname + "?" + params.toString() + window.location.hash;
        window.history.replaceState({
            path: url
        }, '', url);
    }
}

function lcSetLegendVisibility(e) {
    let _legend = e.parentElement.querySelectorAll("[data-layer-child-legend]");
    let _display = (!e.checked) ? "none" : "block";
    for (let i = 0; i < _legend.length; i++) {
        _legend[i].style.display = _display
    }
}

function filterModal(map, layer) {
    console.log(layer)
    var id = layer.id + "_FilterModal";
    if (!document.getElementById(id)) {
        var modal = document.createElement("div");
        modal.id = id;
        // @ts-ignore
        modal.classList = "modal"
        modal.style.alignItems = "flex-start";
        modal.innerHTML = `
        <a href="#close" class="modal-overlay" aria-label="Close" style="opacity: 0.8"></a>
        <div class="modal-container" style="width: 400px;">
        <div class="modal-header">
            <a href="#close" class="btn btn-clear float-right modal-close" aria-label="Close"></a>
            <div class="modal-title h4">
            <span>Filter ${layer.name}</span>
            </div>
        </div>
        <div class="modal-body">
        </div>
        <div class="modal-footer">
        </div>
        </div>`

        var form = document.createElement("form");
        form.innerHTML = `
        ${createFormFields(layer.metadata.filterSchema)}
        <br>
        <button type="submit" class="btn btn-primary">Submit</button>
        <button class="btn btn-outline" type="reset" style="float:right">Reset</button>
        `
        form.addEventListener("submit", function(e) {
        e.preventDefault();
        window.location.hash = "#";
        var filter = buildFilter(new FormData(form), layer);
        console.log(filter)
        if (!filter) {
            layer.metadata.layers.forEach(l => {
            map.setFilter(l)
            })
        }else{
            layer.metadata.layers.forEach(l => {
            map.setFilter(l, filter)
            })
        }
        });

        form.addEventListener("reset", function(e) {
        layer.metadata.layers.forEach(l => {
            map.setFilter(l)
        })
        })

        modal.querySelector(".modal-body")?.appendChild(form)
        document.body.appendChild(modal);
        window.location.hash = "#"
        window.location.hash = id
    }else{
        window.location.hash = "#"
        window.location.hash = id
    }
}

function buildFilter(data, layer) {
    const fields = [...data.keys()];
    const values = [...data.values()];

    // console.log(fields, values)

    var filter: any[] = [];

    for (var i = 0; i < fields.length; i++) {
        if (fields[i].includes("operator")) continue;
        if (!values[i]) continue;
        let filterValue = values[i];
        if (layer.metadata.filterSchema[fields[i]].type === "date" && layer.metadata.filterSchema[fields[i]].epoch) {
        filterValue = new Date(filterValue + "T00:00:00").getTime();
        // console.log(filterValue, new Date(filterValue))
        }
        console.log(filterValue);
        //TODO ADD LOGIC FOR WHEN USING MULTIPLE IN SELECT OPTIONS - SHOULD BE ANOTHER ARRAY WITH 'IN' OPERATOR THEN THE == OPERATOR
        //MAYBE IF fields[i] === fields[i-1] then assume the multiple operator and use that, else do what we are currently doing
        switch (layer.metadata.filterSchema[fields[i]].type) {
        case "date" : filter.push([values[i + 1], ["get", fields[i] ], filterValue]); break;
        case "number" : filter.push([values[i + 1], ["get", fields[i] ], Number(filterValue) ]); break;
        default: filter.push(["==", ["get", fields[i]], filterValue]);
        }    
    }

    if (filter.length < 1) {
        return null
    }else{
        return ["all", ...filter]
    }
}

function createFormFields(schema) {
    let html = "";
    for (let s in schema) {
        let name = s.replace(/_/g, " ").toUpperCase()
        html += `
        <div class="form-group">
        <label class="form-label" for="${s}">${name}</label>
        ${(!schema[s].options) 
            ?
            `<input class="form-input" id="${s}" type="${schema[s].type}" name="${s}"  ${(!schema[s].readonly) ? '' : 'readonly="true"'} ${(!schema[s].required) ? '' : 'required="true"'}>`
            :
            `<select id="${s}" class="form-select" name="${s}" ${(!schema[s].required) ? '' : 'required="true"'}>
            ${schema[s].options.map(o => {
                return `<option>${o}</option>`
            })}
            </select>`
        }
        ${(!schema[s].hint) ? "" : `<p class="form-input-hint">${schema[s].hint}</p>`}
        </div>
        `

        if (schema[s].type === "date" || schema[s].type === "number") html += `
        <div class="form-group">
            <label  class="form-label" for="${s}_operator">${name} OPERATOR</label>
            <select id="${s}_operator"  name="${s}_operator" class="form-select">
            <option>></option>
            <option>>=</option>
            <option>==</option>
            <option><=</option>
            <option><</option>
            </select>
        </div>
        `

    }
    return html
}

function filterIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24" viewBox="0 0 24 24" width="24"><g><path d="M0,0h24 M24,24H0" fill="none"/><path d="M4.25,5.61C6.27,8.2,10,13,10,13v6c0,0.55,0.45,1,1,1h2c0.55,0,1-0.45,1-1v-6c0,0,3.72-4.8,5.74-7.39 C20.25,4.95,19.78,4,18.95,4H5.04C4.21,4,3.74,4.95,4.25,5.61z"/><path d="M0,0h24v24H0V0z" fill="none"/></g></svg>`
}

function loadingIcon(map) {
    const svg = `<svg version="1.1" id="L9" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
        viewBox="0 0 100 100" enable-background="new 0 0 0 0" xml:space="preserve">
        <path fill="#fff" d="M73,50c0-12.7-10.3-23-23-23S27,37.3,27,50 M30.9,50c0-10.5,8.5-19.1,19.1-19.1S69.1,39.5,69.1,50">
            <animateTransform 
            attributeName="transform" 
            attributeType="XML" 
            type="rotate"
            dur="0.6s" 
            from="0 50 50"
            to="360 50 50" 
            repeatCount="indefinite" />
        </path>
    </svg>`
    const background = document.createElement("div");
    background.style.position = "absolute";
    background.style.top = "0";
    background.style.left = "0";
    background.style.bottom = "0";
    background.style.zIndex = "1";
    background.style.width = "100%"
    background.style.background = "rgba(255,255,255,0.5)"

    let div = document.createElement("div");
    div.innerHTML = svg;
    div.style.position = "absolute"
    div.style.display = "block";
    div.style.top = "50%";
    div.style.left = "50%";
    div.style.width = "120px";
    div.style.height = "120px";
    div.style.transform = "translate(-50%, -50%)";
    background.appendChild(div)
    map.getContainer().appendChild(background);

    return background
}

function isScrolledIntoView(el) {
    var rect = el.getBoundingClientRect();
    var elemTop = rect.top;
    var elemBottom = rect.bottom;
    var isVisible = (elemTop >= 0) && (elemBottom <= window.innerHeight);
    // Partially visible elements return true:
    //isVisible = elemTop < window.innerHeight && elemBottom >= 0;
    return isVisible;
}
// sync function addMap() {

// sourcez = {
//     title: {
//         'type': 'geojson',f
//         'data': dataFEMA Severe Repetitive Loss Properties
//     },
//     'zipcodes': {
//         'type': 'geojson',
//         'data': dataZipCodes
//     }
// }
let x0,y0,z0
[x0,y0,z0] = [-94.4,30,8]
    

let dir = 'http://glo-repetitiveloss.s3-website.us-east-2.amazonaws.com/'
let lyrdir = dir +'bringtheheat/'
let huclyrdir = dir+'HUC/'

const map =  new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v10',
    center: [x0,y0],
    zoom: z0,
});

async function fetchJSON (url) {
    let response = await fetch(url);
    let data = await response.json();
    //TODO error handling
    // console.log(data)
    return data;
}

const fly = async (map,x,y,z,sleep=2000)=> {
    await new Promise(r => setTimeout(r, sleep));
    await map.flyTo({
        center: [x,y],
        zoom: z,
        essential: true // this animation is considered essential with respect to prefers-reduced-motion
        });
}

const sleep = async (time_s) => {
    await new Promise(r => setTimeout(r, time_s*1000))
}

// function getAnimateMouse(map,route) {
//     // Update the data to a new position based on the animation timestamp. The
//     // divisor in the expression `timestamp / 1000` controls the animation speed.
//     function anim8(timestamp) {
//         // console.log(map.getSource('pointer') )
//         t = parseInt(timestamp / 100)
//         // console.log(t)
//         map.getSource('pointer').setData( {
//         'type':'Point',
//         'coordinates':route[t]
//     } );
    
//     // Request the next frame of the animation.
//     if (t<route.length) {
//         requestAnimationFrame(anim8) }
//     }
    
//     return anim8
// }

// function addlyr(map,lyrId,geodata) {}
// function addPopup(map,lyrId) {
//     map.on('click', huc+'-fill', (event) => {
//         popup
//             .setLngLat(event.lngLat)
//             .setHTML(`<strong>${huc}</strong> ${event.features[0].properties.name}<br>
//                     ${event.features[0].properties.huc8}`)
//             .addTo(map);
//         });     

//         map.on('mouseenter', huc+'-fill', (event) => {
//             // Change the cursor style as a UI indicator.
//             map.getCanvas().style.cursor = 'pointer';
//         })
//         map.on('mouseleave', huc+'-fill', () => {
//             map.getCanvas().style.cursor = '';
//             popup.remove();
//             });
// }

function addHeatmap(map,heatlyr,q0=1,q1=20,q2=300) {
    // q0-2: quantile distribution of heatlyr.densityAttr to base the heatmap color ramp off, (min, q50, max)
    let lyrId = heatlyr.id
    if (!heatlyr.hasOwnProperty('data') ) {
            heatlyr.data = lyrdir+encodeURIComponent(lyrId)+'.geojson'
        }
        if (!heatlyr.hasOwnProperty('densityAttr') ) {
            heatlyr.densityAttr = null
        }
        if (!heatlyr.hasOwnProperty('coloramp') ) {
            heatlyr.coloramp = VIRIDIS
        }
        if (!heatlyr.hasOwnProperty('lblPrefix') ) {
            heatlyr.lblPrefix = ''
        }
        if (!heatlyr.hasOwnProperty('lblSuff') ) {
            heatlyr.lblSuff = ''
        }
    map.addSource(lyrId, {
        'type': 'geojson',
        'data': heatlyr.data
    })

    if (heatlyr.densityAttr!=null) {
        map.addLayer(
            {
                'id': lyrId+'',
                'type': 'heatmap',
                'source': lyrId,
                // 'maxzoom': 8,
                'layout':{'visibility':'none'},
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
                        ...heatlyr.coloramp],
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
                'id': lyrId+'-point',
                'type': 'circle',
                'source': lyrId,
                'minzoom': 10,
                'layout':{'visibility':'none'},
                'paint': {
                    // Size circle radius by earthquake magnitude and zoom level
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        7,
                        ['*',0.6, ['interpolate', ['linear'], ['get', heatlyr.densityAttr], q0, 4, q1, 40, q2, 70] ],
                        22,
                        ['*',0.6, ['interpolate', ['linear'], ['get', heatlyr.densityAttr], q0, 5, q1, 100, q2, 150] ]
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
        let s0=5
        let s1=7
        map.addLayer(
            {
                'id': lyrId+'',
                'type': 'heatmap',
                'source': lyrId,
                // 'maxzoom': 8,
                'layout':{'visibility':'none'},
                'paint': {
                    'heatmap-weight':0.02,
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
                        ...heatlyr.coloramp],
                    // Adjust the heatmap radius by zoom level
                    'heatmap-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        1,
                        4,
                        7, 
                        s0*3,
                        22,
                        s1*3
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
                'id': lyrId+'-point',
                'type': 'circle',
                'source': lyrId,
                'minzoom': 10,
                'layout':{'visibility':'none'},
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

        map.on('mouseleave', lyrId+'-point', () => {
            map.getCanvas().style.cursor = '';
            popup.remove();
            });

        map.on('mouseenter', lyrId+'-point', (event) => {
            popup
            .setLngLat(event.lngLat)
            .setHTML(`<strong>${heatlyr.lblPrefix}${lyrId}${heatlyr.lblSuff}</strong>`)
            .addTo(map);
            // Change the cursor style as a UI indicator.
            map.getCanvas().style.cursor = 'pointer';
        })
    }
}

const tutorial = async(map, routeURL) => {
    await fly(map,-94.1412,30.1029,12)
    await sleep(3.5)
    map.addSource('pointer', {
    'type': 'geojson',  //TODO mouse outline
    // 'type':'Point',
    'data': [0,0]//pointerData(x0,y0)
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

    let routes = await fetchJSON(lyrdir+'pointerpath.geojson')
    routes = routes.features
    routes.sort((a, b) => (a.properties.route > b.properties.route) ? 1 : -1)
    // console.log(routes)

    const parseRoute = (feat)=> {
        let route = feat.geometry.coordinates
        if (route.length===1) {//multilinestrings
            route=route[0]
        }
        return route
    }

    //TODO zip is hardcoded, replace this entirely
    const zips = routes.map(feat=>feat.properties.zip)
    routes = routes.map(parseRoute)
    // console.log(zips)
    //routes will be [ [[x1,y1],[x2,y2]] , [[x1,y1],...] , ... ]

    function seq1(map,route) {
        let pos = route.shift()
        // console.log(pointerData(...pos))
        // pos = parseRoute(pos)
        // @ts-ignore
        map.getSource('pointer').setData( pointerData(...pos) );
        
        // Request the next frame of the animation.
        return route
    }
    
    map.moveLayer('pointer')

    playing = true;
    let route: any = undefined
    let lastcoord: any;
    async function update(timer) { // Main update loop
        let zyp: any;

        // your draw code
        if(route === undefined){ // is there an animation 
        // no animation 
            if(routes.length > 0){  // are there any animations on the stack
                route = routes.shift(); // yes get the first anim
                // console.log(zips)
                zyp = zips.shift() //get the associated zip code to simulate mouse hover
                // console.log(zyp)
            }else{
                playing = false;  // no animations to play so stop and exit
                return;
            }
        }
        if (route.length==1) {
            lastcoord = route[0] //grab this before it gets Shifted off in seq1
        }
        route = seq1(map,route)
        if(route.length===0){ // call the anim and check if returns true;
            // animation ended so get the next animation function if there are any
            // console.log(zyp)
                await map.setFeatureState(
                    { source: 'zipcodes', id: zyp },
                    { hover: true }
                    )

                const aray = await reptLossData.features
                const reptloss = await aray[aray.map((x)=>x.properties.id).indexOf(zyp)].properties.reptloss //TODO change this to zip if the prop changes back to zip HARDCODED
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
                await map.setFeatureState(
                    { source: 'zipcodes', id: zyp },
                    { hover: false }
                    )
                popup.remove()
                map.setLayoutProperty('zipcodes', 'visibility', 'none')

            if(routes.length > 0){

                route = routes.shift(); // get the next anim
                zyp = zips.shift()
            }else{
                // console.log('fin')
                playing = false; // no more animations so stop
                route = undefined; // ready for new animtion
                map.setLayoutProperty('pointer',  'visibility','none')

                // await sleep(.2)
                fly(map,x0,y0,z0)
            }
        }    

        if(playing){
            requestAnimationFrame(update); // get next frame
        }
    }

    requestAnimationFrame(update); // starts the animation
    // routes.forEach(feat=> {


    //     animateMouse = getAnimateMouse(map,route)
    //     animateMouse(0)
    //     // await sleep(2)
        
    // })

    // await new Promise(r => setTimeout(r, 10000))
    // await fly(map,x0,y0,z0)
}

const loadErUp = async () => { //had to strip out to separate func to reload after style/basemap change 

    //3d buildings
    // Insert the layer beneath any symbol layer.
    if(['Mapbox Light','Mapbox Dark'].indexOf(map.getStyle().name! ) > -1) {
    
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
    reptLossData = await fetchJSON(lyrdir+'repetitiveLoss.geojson')

    map.addSource('zipcodes', {
        'type': 'geojson',
        'data': lyrdir+'zip.geojson',
        'promoteId':'zip'
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
            'layout': { 'visibility':'none'} //on load
        }
        // ,'FEMA Severe Repetitive Loss Properties' //add underneath
        )

    let lyrId = 'FEMA NHD Streams'
    // console.log(dir+encodeURIComponent(lyrId)+'.mbtiles' )
    map.addSource(lyrId, {
        'type': 'geojson',
        'data': dir+encodeURIComponent(lyrId)+'.geojson',
    })
    map.addLayer(
        {
            'id': lyrId,
            'type': 'line',
            'source': lyrId,
            paint: {
                'line-color':'rgb(60, 129, 255)',
                    "line-width": [
                    'match',
                    ["get", "GNIS_Name"], "nan",
                    .5,
                    3
                    ],
                    "line-opacity": .8
            },
            'layout': { 'visibility':'none'} //on load
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
        if (event.features[0].properties.GNIS_Name!='nan') {
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
    await map.loadImage(
        'https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png',
        async (error, image) => {
        if (error) throw error;
        await map.addImage('custom-marker', image!)
        })

        map.addSource(lyrId+'-src', {
        'type': 'geojson',
        'data': dir+encodeURIComponent(lyrId)+'.geojson',
        cluster: true,
        // clusterMaxZoom: 10, // Max zoom to cluster points on
        // clusterRadius: 0.0003 // Radius of each cluster when clustering points (defaults to 50)
        })
        // map.addLayer(
        //     {
        //         'id': lyrId,
        //         'type': 'circle',
        //         // 'sprite':'https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png',
        //         'source': lyrId,
        //         // filter: ['has', 'point_count'],
        //         'layout': {
        //         //     'icon-image': 'custom-marker',
        //         // //     // get the title name from the source's "title" property
        //         //     'text-field': 
        //         // //     // ['case',['has', 'cluster'],
        //         // //     // ['to-string',['get', 'point_count']],
        //         //     ['get', 'Applicant']
        //         // //     // ]   
        //         //     ,
        //         // //     // // ['match',['get', 'point_count'],1,
        //         // //     // // ['get', 'Applicant'],['to-string',['get', 'point_count']]],
        //         //     'text-font': [
        //         //     'Open Sans Semibold',
        //         //     'Arial Unicode MS Bold'
        //         //     ],
        //         //     'text-offset': [0, 1.25],
        //         //     'text-anchor': 'top',
        //             'visibility':'none'
        //             }
        //             ,paint: {
        //                 'circle-color':'white'
        //         // "text-color": [
        //         //         'match',
        //         //         ["get", "Status"], "Application Approved",
        //         //         'rgb(21, 255, 0)','yellow' ]
        //         }
        //     }
        //     // ,'FEMA Severe Repetitive Loss Properties' //add underneath
        //     )

        map.addLayer(
            {
                'id': lyrId,
                'type': 'symbol',
                // 'sprite':'https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png',
                'source': lyrId+'-src',
                // filter: ['has', 'point_count'],
                'layout': {
                    'icon-image': 'custom-marker',
                //     // get the title name from the source's "title" property
                    'text-field': 
                    // ['format',
                    ['case',['has', 'cluster'],
                    ['to-string',['get', 'point_count']],
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
                    'visibility':'none'
                    }
                    ,paint: {
                "text-color": [
                        'case',
                        ['has','Status'],
                        [
                        'match',
                        ["get", "Status"], "Application Approved",
                        'rgb(21, 255, 0)','yellow' ],
                        'white'],
                'text-halo-width':2,
                'text-halo-blur':1,
                'text-halo-color':'black',
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
                )

                // inspect a cluster on click
            // // map.on('click', lyrId, (e) => {
            // //     const features = map.queryRenderedFeatures(e.point, {
            // //         layers: [lyrId]
            // //     });
            // //     const clusterId = e.features[0].properties.cluster_id;
            // //     console.log(clusterId)
            // //     map.getSource(lyrId+'-src').getClusterExpansionZoom(
            // //         clusterId,
            // //         (err, zoom) => {
            // //         if (err) console.log(err);
                    
            // //         map.easeTo({
            // //             center: e.features[0].geometry.coordinates,
            // //             zoom: zoom
            // //             });
            // //             }
            // //     );
            // // });
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
                        } else if (event.features[0].properties.Site_Title!==undefined) {
                            popup
                            .setLngLat(event.lngLat)
                            // @ts-ignore
                            .setHTML(`<strong>${event.features[0].properties.Site_Title}</strong><br>${event.features[0].properties.Status}`)
                            .addTo(map);
                            // Change the cursor style as a UI indicator.
                            map.getCanvas().style.cursor = 'pointer';
                        }
                        // else {
                        //     // console.log(supercluster)
                        //     const features = map.queryRenderedFeatures(event.point, {
                        //     layers: [lyrId]
                        //     });
                        //     var clusterId = event.features[0].properties.cluster_id
                        //     point_count = event.features[0].properties.point_count
                        //     console.log(clusterId,point_count)
                        //     const clusterSource = map.getSource(lyrId+'-src')
                        //     console.log(clusterSource)
                        //     clusterSource.getClusterLeaves(clusterId, point_count, 0, function(err, aFeatures){
                        //         console.log('getClusterLeaves', err, aFeatures);
                        //     })

                        //     // let feats=event.features
                        //     // console.log(feats)
                        //     // lbl = feats.map((x)=>x.properties.Site_Title)
                        //     // console.log(lbl)
                        //     // popup
                        //     // .setLngLat(event.lngLat)
                        //     // .setHTML(`<strong>${event.features[0].properties.Site_Title}</strong><br>${event.features[0].properties.Status}`)
                        //     // .addTo(map);
                        //     // Change the cursor style as a UI indicator.
                        //     map.getCanvas().style.cursor = 'pointer';
                        // }
                    })

            // function sourceCallback(map) {
            //     console.log('callin back')
            //     // assuming 'map' is defined globally, or you can use 'this'
            //     if (map.getSource(lyrId+'-src') && map.isSourceLoaded(lyrId+'-src')) {
            //         console.log('source loaded!');
                    
            //         map.on('mouseleave', lyrId, () => {
            //             map.getCanvas().style.cursor = '';
            //             popup.remove();
            //             });

            //         map.on('mouseenter', lyrId, (event) => {
            //             if (event.features[0].properties.Site_Title!=undefined) {
            //                 popup
            //                 .setLngLat(event.lngLat)
            //                 .setHTML(`<strong>${event.features[0].properties.Site_Title}</strong><br>${event.features[0].properties.Status}`)
            //                 .addTo(map);
            //                 // Change the cursor style as a UI indicator.
            //                 map.getCanvas().style.cursor = 'pointer';
            //             }
            //             else {
            //                 // console.log(supercluster)
            //                 const features = map.queryRenderedFeatures(event.point, {
            //                 layers: [lyrId]
            //                 });
            //                 var clusterId = event.features[0].properties.cluster_id
            //                 point_count = event.features[0].properties.point_count
            //                 console.log(clusterId,point_count)
            //                 const clusterSource = map.getSource(lyrId+'-src')
            //                 console.log(clusterSource)
            //                 clusterSource.getClusterLeaves(clusterId, point_count, 0, function(err, aFeatures){
            //                     console.log('getClusterLeaves', err, aFeatures);
            //                 })

            //                 // let feats=event.features
            //                 // console.log(feats)
            //                 // lbl = feats.map((x)=>x.properties.Site_Title)
            //                 // console.log(lbl)
            //                 // popup
            //                 // .setLngLat(event.lngLat)
            //                 // .setHTML(`<strong>${event.features[0].properties.Site_Title}</strong><br>${event.features[0].properties.Status}`)
            //                 // .addTo(map);
            //                 // Change the cursor style as a UI indicator.
            //                 map.getCanvas().style.cursor = 'pointer';
            //             }
            //         })
            //     }
            // }

            // map.on('sourcedata', (map)=>{sourceCallback(map)})
        // map.onSourceAdded()
            
    // // })
    // console.log(dir+encodeURIComponent(lyrId)+'.mbtiles' )
    
    
    const lyrz = [
        {id:'Natural Gas Pipelines',
        subdir:'TWDB_Critical_Infrastructure',
        typ:'line',
        color:'orange',
        grup:"TWDB Critical Infrastructure"},

        {id:'Transmission Lines',
        subdir:'TWDB_Critical_Infrastructure',
        typ:'line',
        color:'rgb(35, 130, 255)',
        grup:"TWDB Critical Infrastructure"},
     
        {id:'Counties',
        typ:'line',
        color:'rgb(0, 255, 247)',
        grup:"Boundaries",
        lbl:'{CNTY_NM} County'}
    ]
    
    lyrz.forEach(lyr => {
        if ( lyr.hasOwnProperty('subdir') ) {
            lyr.subdir = lyr.subdir+'/' }
            else { lyr.subdir=''      }
        // if (!lyr.hasOwnProperty('lblOn') ) { lyr.lblOn='mouseenter' }
        
        map.addSource(lyr.id, {
            'type': 'geojson',
            'data': dir+lyr.subdir+encodeURIComponent(lyr.id)+'.geojson',
        })
        map.addLayer(
            {
                'id': lyr.id,
                'type': 'line',
                'source': lyr.id,
                paint: {
                    'line-color':lyr.color,
                        "line-width": 1.3
                        // "line-opacity": .8
                },
                'layout': { 'visibility':'none'} //on load
            }
            // ,'FEMA Severe Repetitive Loss Properties' //add underneath
            )

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
                    children:[lyr.id+'-lbl'],
                    directory: "Legend"
                    }
                )
        
            //lbl
            map.addLayer(
                    {
                        'id': lyr.id+'-lbl',
                        'type': 'symbol',
                        'source': lyr.id,
                        // paint: {
                        //         "fill-opacity": 0
                        // },
                        paint: {
                        "text-color":   lyr.color,
                        'text-halo-width':2,
                        'text-halo-blur':1,
                        'text-halo-color':'black',
                        },
                        'layout': { 
                            'text-field':lyr.lbl,
                            'text-font': [
                            'Open Sans Semibold',
                            'Arial Unicode MS Bold'
                            ],
                            'text-offset': [0, 1.25],
                            'text-anchor': 'top',
                            'visibility':'none'} //on load
                    }
                    // ,'FEMA Severe Repetitive Loss Properties' //add underneath
                    )
                legendlyrs.push(
                    {
                    id: lyr.id+'-lbl',
                    hidden: true,
                    group: lyr.grup,
                    parent:lyr.id,
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
        'tiles': [ dir+encodeURIComponent(lyrId)+'/{z}/{x}/{y}.png' ],
        // 'tiles': dir+encodeURIComponent(lyrId)+'.mbtiles'
        minzoom:7,
        maxzoom:13
    })
    map.addLayer(
        {
            'id': lyrId,
            'type': 'raster',
            'source': lyrId,
            'layout': { 'visibility':'none'} //on load
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
        )


    //txdot overtopping
    lyrId = 'TxDOT Overtopping'
    // console.log(dir+encodeURIComponent(lyrId)+'.mbtiles' )
    map.addSource(lyrId, {
        'type': 'geojson',
        'data': dir+lyrId+'.geojson',
        'generateId':true
    })
    map.addLayer(
        {
            'id': lyrId,
            'type': 'line',
            'source': lyrId,
            paint: {
                'line-color':[
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
            'layout': { 'visibility':'none'} //on load
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

    const huclyrs = ['HUC8','HUC10','HUC12'];
    huclyrs.forEach(lyrId=>{

            map.addSource(lyrId, {
            'type': 'geojson',
            'data': huclyrdir+lyrId+'.geojson'
        })

        map.addLayer(
            {
                'id': lyrId,
                'type': 'line',
                'source': lyrId,
                'paint': {
                    'line-color': '#ffffff',
                    'line-width': 12*12*12*12*.5/ Math.pow( parseInt(lyrId.replace('HUC','')) ,4),
                    'line-opacity': .8
                },
                'layout': { 'visibility':'none'} //on load
            }
            // ,'FEMA Severe Repetitive Loss Properties' //add underneath
            )
            map.addLayer(
            {
                'id': lyrId+'-fill',
                'type': 'fill',
                'source': lyrId,
                'paint': {
                    'fill-opacity': 0
                },
                'layout': { 'visibility':'none'} //on load
            }
            // ,'FEMA Severe Repetitive Loss Properties' //add underneath
            )
            
            legendlyrs.push(
                {
                id: lyrId,
                hidden: false,
                group: "Boundaries",
                children:[lyrId+'-fill'],
                directory: "Legend"
                },
                {
                id: lyrId+'-fill',
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
    let colrs = zip(fldzonelyrs,['#c36c08','#c7af0e','#0000b0','#5544fd'])
    colrs = Object.fromEntries(colrs)
    fldzonelyrs.forEach(lyrId=>{
        map.addSource(lyrId, {
        'type': 'geojson',
        'data': lyrdir+'Floodplain/'+lyrId+'.geojson'
    })

    map.addLayer(
        {
            'id': lyrId,
            'type': 'fill',
            'source': lyrId,
            'paint': {
                'fill-color': colrs[lyrId],
                'fill-opacity': .35
            },
            'layout': { 'visibility':'none'} //on load
        }
        // ,'FEMA '+lyrId
        )
        // map.addLayer(
        // {
        //     'id': lyrId+'-fill',
        //     'type': 'fill',
        //     'source': lyrId,
        //     'paint': {
        //         'fill-opacity': 0
        //     },
        //     'layout': { 'visibility':'none'} //on load
        // }
        // // ,'FEMA Severe Repetitive Loss Properties' //add underneath
        // )
        
        legendlyrs.push(
            {
            id: lyrId,
            hidden: false,
            group: "FEMA Floodplain",
            // children:[lyrId+'-fill'],
            directory: "Legend"
            }
            // {
            // id: lyrId+'-fill',
            // parent: lyrId,
            // hidden: true,
            // group: "Boundaries",
            // directory: "Legend"
            // }
            )
    })

    // fldzonelyrs.forEach(lyrId=>{ //add custom click for strucs in fldplain
    //     map.on('click', 'FEMA '+lyrId+'-point', (event) => {
    //     popup
    //         .setLngLat(event.lngLat)
    //         .setHTML(`<strong>Stucture within FEMA ${lyrId} Floodplain</strong>`)
    //         .addTo(map);
    //     });     
    //     map.on('mouseleave', 'FEMA '+lyrId+'-point', () => {
    //         map.getCanvas().style.cursor = '';
    //         popup.remove();
    //         });
    //     map.on('mouseenter', 'FEMA '+lyrId+'-point', (event) => {
    //         // Change the cursor style as a UI indicator.
    //         map.getCanvas().style.cursor = 'pointer';
    //     })

    // })

    let heatmaplyrs = [
        {id:replossId,
        data:reptLossData,
        densityAttr:'reptloss',
        coloramp: TURBO,
        grup:"Repetitive Loss"},

        {id:'FEMA 500YR Preliminary',grup:"Structures within FEMA Floodplain"
        ,lblPrefix:'Structures within ',lblSuff:' Floodplain'},
        {id:'FEMA 500YR Effective',grup:"Structures within FEMA Floodplain"
        ,lblPrefix:'Structures within ',lblSuff:' Floodplain'},
        {id:'FEMA 100YR Preliminary',grup:"Structures within FEMA Floodplain"
        ,lblPrefix:'Structures within ',lblSuff:' Floodplain'},
        {id:'FEMA 100YR Effective',grup:"Structures within FEMA Floodplain"
        ,lblPrefix:'Structures within ',lblSuff:' Floodplain'},

        {'id': 'Current Schools',
        'data': dir+'TWDB_Critical_Infrastructure/Current Schools.geojson',
        coloramp: CUBE_HELIX, grup:'TWDB Critical Infrastructure'},
        {'id': 'Fire Stations',
        'data': dir+'TWDB_Critical_Infrastructure/Fire Stations.geojson', coloramp:CUBE_HELIX, grup:'TWDB Critical Infrastructure'},
        {'id': 'Hospitals', 'data': dir+'TWDB_Critical_Infrastructure/Hospitals.geojson'
        ,coloramp: CUBE_HELIX, grup:'TWDB Critical Infrastructure'},
        {'id': 'National Shelter System Facilities',
        'data': dir+'TWDB_Critical_Infrastructure/National Shelter System Facilities.geojson'
        ,coloramp:CUBE_HELIX, grup:'TWDB Critical Infrastructure'},
    ]
    
    // heatmaplyrs = heatmaplyrs.map(heatlyr=>{
    //         if (!heatlyr.hasOwnProperty('data') ) {
    //         heatlyr.data = lyrdir+encodeURIComponent(heatlyr.id)+'.geojson'
    //     }
    //     if (!heatlyr.hasOwnProperty('densityAttr') ) {
    //         heatlyr.densityAttr = null
    //     }
    //     if (!heatlyr.hasOwnProperty('coloramp') ) {
    //         heatlyr.coloramp = viridis
    //     }
    //     if (!heatlyr.hasOwnProperty('lblPrefix') ) {
    //         heatlyr.lblPrefix = ''
    //     }
    //     if (!heatlyr.hasOwnProperty('lblSuff') ) {
    //         heatlyr.lblSuff = ''
    //     }
    //     return heatlyr
    //     })
    
    heatmaplyrs.forEach(heatlyr => {
        addHeatmap(map,heatlyr);
        legendlyrs.push(
            {
            id: heatlyr.id+"-point",
            parent: heatlyr.id+"",
            hidden: true,
            group: heatlyr.grup,
            directory: "Legend"
            },
            {
            id: heatlyr.id+"",
            hidden: false,
            children: [heatlyr.id+"-point"],
            group: heatlyr.grup,
            directory: "Legend",
            }
        )
    })
    // legendlyrs[legendlyrs.map((x)=>x.id).indexOf(replossId)].group = 'Repetitive Loss'
    // legendlyrs[legendlyrs.map((x)=>x.id).indexOf(replossId+'-point')].group = 'Repetitive Loss'

    // legendlyrs[legendlyrs.map((x)=>x.id).indexOf(replossId)].group = 'TWDB Critical Infrastructure'
    // legendlyrs[legendlyrs.map((x)=>x.id).indexOf(replossId+'-point')].group = 'TWDB Critical Infrastructure'


    //order layers
    fldzonelyrs.forEach(lyrId=>{
        map.moveLayer('FEMA '+lyrId)
        map.moveLayer('FEMA '+lyrId+'-point')
    })
    map.moveLayer(replossId)
    map.moveLayer(replossId+'-point')
    huclyrs.forEach(lyrId=>{
        map.moveLayer(lyrId)
    })
    

    
    // legendlyrs[]

    
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
        
        // map.on('mouseleave', 'FEMA Severe Repetitive Loss Properties-point', () => {
        // map.setLayoutProperty('zipcodes', 'visibility', 'none');
        // map.getCanvas().style.cursor = '';
        // popup.remove();
        // });

    // map.on('mouseenter', 'zipcodes', (event) => {

    // })
    
    map.on('mousemove', 'zipcodes', (e) => {
        if ((e.features?.length ?? 0) > 0 && playing==false) {
            if (hoveredId !== null) {
                map.setFeatureState(
                    { source: 'zipcodes', id: hoveredId },
                    { hover: false }
                );
            }

            hoveredId = e.features![0].id ?? null;
            // console.log(typeof hoveredId)
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

    huclyrs.forEach(huc=>{
        map.on('click', huc+'-fill', (event) => {
        popup
            .setLngLat(event.lngLat)
            .setHTML(`<strong>${huc}</strong> ${event.features![0].properties!.name}<br>
                    ${event.features![0].properties!.huc8}`)
            .addTo(map);
        });     

        map.on('mouseleave', huc+'-fill', () => {
            map.getCanvas().style.cursor = '';
            popup.remove();
            });

        map.on('mouseenter', huc+'-fill', (event) => {
            // Change the cursor style as a UI indicator.
            map.getCanvas().style.cursor = 'pointer';
        })
    })

    fldzonelyrs.forEach(lyrId=>{
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
            
        map.on('mouseenter', lyrId, (event) => {
            // Change the cursor style as a UI indicator.
            map.getCanvas().style.cursor = 'pointer';
        })
    })
}


map.on('load', async ()=> {
    await loadErUp()
    
    legendConfig = {
        collapsed: true,
        layers:legendlyrs
    }

    map.addControl(new layerControlGrouped(legendConfig), "top-left")
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
    
    if ( urlParams.toString().includes(replossId.replaceAll(' ','+')) ) {
        tutorial(map, undefined) //only if on base url
    }
})

// addMap()
function pointerData(x,y) {
    // return [[x,y],[x+10,y+10],[x+20,y]]
    return {
                'type':'Point',
                'coordinates':[x,y] 
            }
    //TODO: mouse outline:
    let coords =  [ //why extra [] no idea
        [[ x        ,  y        ],
       [ x+0.0279833 , y+ 0.00227988],
       [ x+0.02224666, y-0.00885596],
       [ x+0.03879149, y-0.0172458 ],
       [ x+0.03496963, y-0.02466469],
       [ x+0.0184248 , y-0.01627485],
       [ x+0.0184248 , y-0.01627485],
       [ x+0.01268816, y-0.02741069]] 
    ]
    return {
                'type':'Feature',
                'geometry':{
                    'type':'Polygon',
                    'coordinates':coords
                }
            }
}

    //basemap changer https://docs.mapbox.com/mapbox-gl-js/example/setstyle/
    const layerList = document.getElementById('menu');
    const inputs = layerList?.getElementsByTagName('input');
    
    const restyle = async (layerId) => {
        await map.setStyle('mapbox://styles/mapbox/' + layerId);

        
        // await sleep(15)
        await loadErUp()

        //refresh lyrs
        let params: any = await new URLSearchParams(window.location.search)

        let myparams = await zip(params.keys(),Array.from( params.values() ))

        Array.from(params.keys()).forEach(param=>{
            params.delete(param)
        })

        // console.log(myparams)
        myparams.forEach(param=>{
            params.set(param[0],param[1])
        })
        

        let url = window.location.protocol + "//" + window.location.host + window.location.pathname + "?" + params.toString() + window.location.hash;
        window.history.replaceState({
            path: url
        }, '', url);

        let _layers = [...params.keys()];

        _layers.map(function(l) {
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

            map.once("styledata", async ()=> {
                await loadErUp()

                //refresh lyrs
                let params: any = await new URLSearchParams(window.location.search)

                let myparams = await zip(params.keys(),Array.from( params.values() ))

                Array.from(params.keys()).forEach(param=>{
                    params.delete(param)
                })

                // console.log(myparams)
                myparams.forEach(param=>{
                    params.set(param[0],param[1])
                })
                
                let url = window.location.protocol + "//" + window.location.host + window.location.pathname + "?" + params.toString() + window.location.hash;
                window.history.replaceState({
                    path: url
                }, '', url);

                let _layers = [...params.keys()];

                _layers.map(function(l) {
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

