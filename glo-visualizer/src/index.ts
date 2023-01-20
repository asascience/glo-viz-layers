import 'mapbox-gl/dist/mapbox-gl.css'; 
import 'mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'; 
import './style.css';

import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from 'mapbox-gl-geocoder';

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

function GetAllChecked(boxes) {
    let boolean = false;
    for (let i = 0; i < boxes.length; i++) {
        if (boxes[i].checked) {
            boolean = true;
            continue
        } else {
            boolean = false
            break
        }
    }
    return boolean
}

function ToggleChildren(div, start) {
div.style.height = div.scrollHeight + "px";
if (div.scrollHeight > 50) {
    div.style.height = "36px";
    setTimeout(function() {
    var children = div.children;
    if (children.length > 1 && children[start].style.display === "none") {
        for (var i = start; i < children.length; i++) {
        if (!children[i].dataset.hidden) children[i].style.display = "block"
        }
    }else{
        for (var i = start; i < children.length; i++) {
        children[i].style.display = "none"
        }
    }
    div.style.height = "auto";
    }, 400)
}else{
    var children = div.children;
    if (children.length > 1 && children[start].style.display === "none") {
    for (var i = start; i < children.length; i++) {
        if (!children[i].dataset.hidden) children[i].style.display = "block"
    }
    }else{
    for (var i = start; i < children.length; i++) {
        children[i].style.display = "none"
    }
    }
    div.style.height = div.scrollHeight + "px";
    setTimeout(function() {
    div.style.height = "auto";
    }, 400)
}
}

function GetActiveLayers(map, layers) {
let keys = layers.reduce((i, l) => {
    return [...i, l.id]
}, []);
let _map = map;
let _mapLayers = _map.getStyle().layers;
let _ids = GetMapLayerIds(_mapLayers);
let urlParams = new URLSearchParams(window.location.search);
let _layers = [...urlParams.keys()];
let _values = [...urlParams.values()]; //COULD USE THIS IN THE FUTURE TO TURN LAYERS OFF FOR NOW ADDING ALL LAYERS AS VISIBILITY NONE AND TURNING THEM ON WITH THE LAYER CONTROL
_layers.map(function(l) {
    if (keys.indexOf(l) > -1) {
    let visibility = GetLayerVisibility(_mapLayers, _ids, l);
    if (!visibility) {
        _map.setLayoutProperty(l, "visibility", "visible")
    }
    }
});
return _layers
}

function SetLayerVisibility(m, checked, layer) {
let visibility = (checked === true) ? 'visible' : 'none';
    m.setLayoutProperty(layer, 'visibility', visibility);
}

function GetStyle(layers, layer) {
let layerConfig = layers.filter(function(l) {
    return l.id === layer.id
})
let style = (!layerConfig[0].paint) ? false : layerConfig[0].paint

return style
}

function GetMapLayerIds(layers) {
return layers.reduce((array, layer) => {
    return [...array, layer.id]
}, [])
}

function GetLayerVisibility(mapLayers, ids, layer) {
var index = ids.indexOf(layer);
if (index < 0) {
    return false
}else{
    return mapLayers[index].layout.visibility === "visible" ? true : false;
}
}
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
        const activeLayers = GetActiveLayers(this._map, this._layers);

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

        this._activeLayers = GetActiveLayers(this._map, this._layers)
        this._mapLayers = this._map!.getStyle().layers;
        this._mapLayerIds = GetMapLayerIds(this._mapLayers);

        // console.log(this._mapLayerIds, this._layers)

        //BUILD DIRECTORIES, GROUPS, LAYER TOGGLES AND LEGENDS FROM THE layerControlConfig
        for (let d in this._layerControlConfig) {

        //CREATE DIRECTORY
        let directory = d;

        let layerCount = 0;

        this._layers.forEach(l => {
            if (l.directory === d && !l.parent) {
            var checked = GetLayerVisibility(this._mapLayers, this._mapLayerIds, l.id);
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
            let style = GetStyle(this._mapLayers, layer);
            if (!layer.legend && style) {
                layer.simpleLegend = lcCreateLegend(style)
            }
            let checked;
            checked = GetLayerVisibility(this._mapLayers, this._mapLayerIds, layer.id);
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
            SetLayerVisibility(map, e.target.checked, e.target.id);
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
                    SetLayerVisibility(map, e.target.checked, groupMembers[i].id);
                }
            }
            return
        }

        if (e.target.dataset.layergroup) {
            // console.log("layergroup")
            let inputs = e.target.parentElement.querySelectorAll("[data-master-layer]");
            // CHECK IF ANY OF THE BOXES ARE NOT CHECKED AND IF NOT THEM CHECK THEM ALL
            if (!GetAllChecked(inputs)) {
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
            ToggleChildren(e.target.parentElement, 2)

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
const turbo =  [
                    // 0,
                    // 'rgba(33,102,172,0)',
                    0.0,
                    'rgba(48.44, 18.3, 59.2,0)',
                    0.004,
                    'rgb(49.68, 21.26, 66.68)',
                    0.008,
                    'rgb(50.89, 24.22, 74.01)',
                    0.012,
                    'rgb(52.06, 27.16, 81.2)',
                    0.016,
                    'rgb(53.19, 30.1, 88.25)',
                    0.02,
                    'rgb(54.29, 33.01, 95.15)',
                    0.023,
                    'rgb(55.36, 35.92, 101.91)',
                    0.027,
                    'rgb(56.38, 38.82, 108.52)',
                    0.031,
                    'rgb(57.38, 41.7, 114.99)',
                    0.035,
                    'rgb(58.33, 44.58, 121.32)',
                    0.039,
                    'rgb(59.25, 47.44, 127.51)',
                    0.043,
                    'rgb(60.13, 50.29, 133.55)',
                    0.047,
                    'rgb(60.98, 53.12, 139.45)',
                    0.051,
                    'rgb(61.8, 55.95, 145.2)',
                    0.055,
                    'rgb(62.57, 58.76, 150.81)',
                    0.059,
                    'rgb(63.32, 61.56, 156.28)',
                    0.062,
                    'rgb(64.02, 64.35, 161.6)',
                    0.066,
                    'rgb(64.69, 67.13, 166.79)',
                    0.07,
                    'rgb(65.33, 69.9, 171.82)',
                    0.074,
                    'rgb(65.93, 72.65, 176.71)',
                    0.078,
                    'rgb(66.49, 75.4, 181.46)',
                    0.082,
                    'rgb(67.01, 78.13, 186.07)',
                    0.086,
                    'rgb(67.51, 80.85, 190.53)',
                    0.09,
                    'rgb(67.96, 83.56, 194.85)',
                    0.094,
                    'rgb(68.38, 86.25, 199.03)',
                    0.098,
                    'rgb(68.77, 88.94, 203.06)',
                    0.102,
                    'rgb(69.11, 91.61, 206.95)',
                    0.105,
                    'rgb(69.43, 94.27, 210.69)',
                    0.109,
                    'rgb(69.7, 96.92, 214.29)',
                    0.113,
                    'rgb(69.94, 99.56, 217.75)',
                    0.117,
                    'rgb(70.15, 102.18, 221.06)',
                    0.121,
                    'rgb(70.32, 104.8, 224.24)',
                    0.125,
                    'rgb(70.45, 107.4, 227.26)',
                    0.129,
                    'rgb(70.55, 109.99, 230.15)',
                    0.133,
                    'rgb(70.61, 112.57, 232.89)',
                    0.137,
                    'rgb(70.64, 115.14, 235.48)',
                    0.141,
                    'rgb(70.63, 117.69, 237.94)',
                    0.145,
                    'rgb(70.58, 120.24, 240.25)',
                    0.148,
                    'rgb(70.5, 122.77, 242.41)',
                    0.152,
                    'rgb(70.39, 125.29, 244.44)',
                    0.156,
                    'rgb(70.23, 127.79, 246.31)',
                    0.16,
                    'rgb(70.05, 130.29, 248.05)',
                    0.164,
                    'rgb(69.82, 132.78, 249.64)',
                    0.168,
                    'rgb(69.55, 135.25, 251.08)',
                    0.172,
                    'rgb(69.12, 137.74, 252.27)',
                    0.176,
                    'rgb(68.54, 140.24, 253.22)',
                    0.18,
                    'rgb(67.81, 142.75, 253.94)',
                    0.184,
                    'rgb(66.94, 145.27, 254.42)',
                    0.188,
                    'rgb(65.95, 147.79, 254.68)',
                    0.191,
                    'rgb(64.83, 150.32, 254.73)',
                    0.195,
                    'rgb(63.61, 152.85, 254.58)',
                    0.199,
                    'rgb(62.29, 155.39, 254.23)',
                    0.203,
                    'rgb(60.88, 157.92, 253.69)',
                    0.207,
                    'rgb(59.38, 160.45, 252.97)',
                    0.211,
                    'rgb(57.82, 162.98, 252.07)',
                    0.215,
                    'rgb(56.2, 165.5, 251.01)',
                    0.219,
                    'rgb(54.52, 168.01, 249.8)',
                    0.223,
                    'rgb(52.81, 170.51, 248.43)',
                    0.227,
                    'rgb(51.05, 173.0, 246.92)',
                    0.23,
                    'rgb(49.28, 175.47, 245.28)',
                    0.234,
                    'rgb(47.49, 177.93, 243.52)',
                    0.238,
                    'rgb(45.7, 180.37, 241.64)',
                    0.242,
                    'rgb(43.92, 182.78, 239.65)',
                    0.246,
                    'rgb(42.15, 185.18, 237.56)',
                    0.25,
                    'rgb(40.4, 187.56, 235.38)',
                    0.254,
                    'rgb(38.69, 189.9, 233.11)',
                    0.258,
                    'rgb(37.02, 192.22, 230.76)',
                    0.262,
                    'rgb(35.41, 194.51, 228.35)',
                    0.266,
                    'rgb(33.86, 196.77, 225.88)',
                    0.27,
                    'rgb(32.38, 198.99, 223.35)',
                    0.273,
                    'rgb(30.99, 201.18, 220.78)',
                    0.277,
                    'rgb(29.68, 203.34, 218.18)',
                    0.281,
                    'rgb(28.48, 205.45, 215.54)',
                    0.285,
                    'rgb(27.38, 207.52, 212.88)',
                    0.289,
                    'rgb(26.41, 209.55, 210.21)',
                    0.293,
                    'rgb(25.57, 211.54, 207.54)',
                    0.297,
                    'rgb(24.86, 213.47, 204.87)',
                    0.301,
                    'rgb(24.31, 215.36, 202.21)',
                    0.305,
                    'rgb(23.91, 217.2, 199.57)',
                    0.309,
                    'rgb(23.68, 218.98, 196.96)',
                    0.312,
                    'rgb(23.63, 220.71, 194.39)',
                    0.316,
                    'rgb(23.77, 222.39, 191.85)',
                    0.32,
                    'rgb(24.1, 224.0, 189.38)',
                    0.324,
                    'rgb(24.64, 225.56, 186.96)',
                    0.328,
                    'rgb(25.39, 227.05, 184.6)',
                    0.332,
                    'rgb(26.37, 228.48, 182.32)',
                    0.336,
                    'rgb(27.58, 229.86, 180.03)',
                    0.34,
                    'rgb(29.0, 231.22, 177.61)',
                    0.344,
                    'rgb(30.64, 232.54, 175.08)',
                    0.348,
                    'rgb(32.47, 233.84, 172.45)',
                    0.352,
                    'rgb(34.49, 235.1, 169.72)',
                    0.355,
                    'rgb(36.7, 236.33, 166.89)',
                    0.359,
                    'rgb(39.07, 237.54, 163.99)',
                    0.363,
                    'rgb(41.61, 238.7, 161.0)',
                    0.367,
                    'rgb(44.31, 239.84, 157.94)',
                    0.371,
                    'rgb(47.15, 240.93, 154.82)',
                    0.375,
                    'rgb(50.13, 242.0, 151.64)',
                    0.379,
                    'rgb(53.24, 243.03, 148.41)',
                    0.383,
                    'rgb(56.46, 244.01, 145.13)',
                    0.387,
                    'rgb(59.79, 244.97, 141.82)',
                    0.391,
                    'rgb(63.23, 245.88, 138.47)',
                    0.395,
                    'rgb(66.76, 246.75, 135.1)',
                    0.398,
                    'rgb(70.37, 247.58, 131.72)',
                    0.402,
                    'rgb(74.06, 248.38, 128.32)',
                    0.406,
                    'rgb(77.81, 249.13, 124.92)',
                    0.41,
                    'rgb(81.62, 249.83, 121.52)',
                    0.414,
                    'rgb(85.47, 250.5, 118.13)',
                    0.418,
                    'rgb(89.36, 251.12, 114.76)',
                    0.422,
                    'rgb(93.28, 251.69, 111.4)',
                    0.426,
                    'rgb(97.22, 252.22, 108.08)',
                    0.43,
                    'rgb(101.18, 252.7, 104.8)',
                    0.434,
                    'rgb(105.13, 253.13, 101.56)',
                    0.438,
                    'rgb(109.08, 253.52, 98.37)',
                    0.441,
                    'rgb(113.02, 253.86, 95.23)',
                    0.445,
                    'rgb(116.93, 254.14, 92.16)',
                    0.449,
                    'rgb(120.81, 254.38, 89.16)',
                    0.453,
                    'rgb(124.64, 254.56, 86.23)',
                    0.457,
                    'rgb(128.42, 254.69, 83.39)',
                    0.461,
                    'rgb(132.15, 254.77, 80.64)',
                    0.465,
                    'rgb(135.8, 254.79, 77.98)',
                    0.469,
                    'rgb(139.38, 254.76, 75.43)',
                    0.473,
                    'rgb(142.87, 254.68, 72.99)',
                    0.477,
                    'rgb(146.26, 254.53, 70.67)',
                    0.48,
                    'rgb(149.55, 254.33, 68.46)',
                    0.484,
                    'rgb(152.72, 254.08, 66.4)',
                    0.488,
                    'rgb(155.77, 253.76, 64.46)',
                    0.492,
                    'rgb(158.69, 253.38, 62.68)',
                    0.496,
                    'rgb(161.47, 252.95, 61.04)',
                    0.5,
                    'rgb(164.12, 252.45, 59.56)',
                    0.504,
                    'rgb(166.75, 251.88, 58.23)',
                    0.508,
                    'rgb(169.39, 251.24, 57.04)',
                    0.512,
                    'rgb(172.03, 250.53, 56.0)',
                    0.516,
                    'rgb(174.66, 249.75, 55.09)',
                    0.52,
                    'rgb(177.29, 248.91, 54.3)',
                    0.523,
                    'rgb(179.91, 248.0, 53.63)',
                    0.527,
                    'rgb(182.52, 247.03, 53.08)',
                    0.531,
                    'rgb(185.12, 246.0, 52.63)',
                    0.535,
                    'rgb(187.71, 244.91, 52.29)',
                    0.539,
                    'rgb(190.27, 243.76, 52.04)',
                    0.543,
                    'rgb(192.82, 242.56, 51.87)',
                    0.547,
                    'rgb(195.35, 241.3, 51.79)',
                    0.551,
                    'rgb(197.86, 239.99, 51.79)',
                    0.555,
                    'rgb(200.34, 238.63, 51.86)',
                    0.559,
                    'rgb(202.79, 237.21, 51.98)',
                    0.562,
                    'rgb(205.21, 235.75, 52.17)',
                    0.566,
                    'rgb(207.6, 234.25, 52.41)',
                    0.57,
                    'rgb(209.95, 232.7, 52.69)',
                    0.574,
                    'rgb(212.26, 231.1, 53.01)',
                    0.578,
                    'rgb(214.54, 229.46, 53.36)',
                    0.582,
                    'rgb(216.78, 227.79, 53.74)',
                    0.586,
                    'rgb(218.96, 226.07, 54.14)',
                    0.59,
                    'rgb(221.11, 224.32, 54.55)',
                    0.594,
                    'rgb(223.2, 222.53, 54.97)',
                    0.598,
                    'rgb(225.24, 220.71, 55.38)',
                    0.602,
                    'rgb(227.24, 218.86, 55.79)',
                    0.605,
                    'rgb(229.17, 216.97, 56.2)',
                    0.609,
                    'rgb(231.04, 215.06, 56.58)',
                    0.613,
                    'rgb(232.86, 213.12, 56.94)',
                    0.617,
                    'rgb(234.61, 211.16, 57.26)',
                    0.621,
                    'rgb(236.3, 209.16, 57.55)',
                    0.625,
                    'rgb(237.92, 207.15, 57.8)',
                    0.629,
                    'rgb(239.47, 205.12, 58.0)',
                    0.633,
                    'rgb(240.95, 203.07, 58.14)',
                    0.637,
                    'rgb(242.35, 201.0, 58.22)',
                    0.641,
                    'rgb(243.68, 198.91, 58.23)',
                    0.645,
                    'rgb(244.92, 196.81, 58.17)',
                    0.648,
                    'rgb(246.09, 194.7, 58.02)',
                    0.652,
                    'rgb(247.17, 192.57, 57.79)',
                    0.656,
                    'rgb(248.17, 190.44, 57.47)',
                    0.66,
                    'rgb(249.08, 188.3, 57.04)',
                    0.664,
                    'rgb(249.9, 186.15, 56.51)',
                    0.668,
                    'rgb(250.64, 183.96, 55.89)',
                    0.672,
                    'rgb(251.3, 181.69, 55.21)',
                    0.676,
                    'rgb(251.89, 179.34, 54.46)',
                    0.68,
                    'rgb(252.41, 176.92, 53.66)',
                    0.684,
                    'rgb(252.87, 174.44, 52.8)',
                    0.688,
                    'rgb(253.25, 171.89, 51.89)',
                    0.691,
                    'rgb(253.57, 169.28, 50.93)',
                    0.695,
                    'rgb(253.81, 166.62, 49.92)',
                    0.699,
                    'rgb(254.0, 163.91, 48.87)',
                    0.703,
                    'rgb(254.12, 161.14, 47.78)',
                    0.707,
                    'rgb(254.17, 158.34, 46.66)',
                    0.711,
                    'rgb(254.16, 155.49, 45.5)',
                    0.715,
                    'rgb(254.09, 152.61, 44.31)',
                    0.719,
                    'rgb(253.96, 149.69, 43.09)',
                    0.723,
                    'rgb(253.77, 146.75, 41.85)',
                    0.727,
                    'rgb(253.52, 143.78, 40.59)',
                    0.73,
                    'rgb(253.21, 140.8, 39.31)',
                    0.734,
                    'rgb(252.84, 137.79, 38.02)',
                    0.738,
                    'rgb(252.42, 134.78, 36.71)',
                    0.742,
                    'rgb(251.94, 131.75, 35.4)',
                    0.746,
                    'rgb(251.4, 128.72, 34.09)',
                    0.75,
                    'rgb(250.82, 125.69, 32.76)',
                    0.754,
                    'rgb(250.18, 122.67, 31.45)',
                    0.758,
                    'rgb(249.48, 119.65, 30.13)',
                    0.762,
                    'rgb(248.74, 116.64, 28.83)',
                    0.766,
                    'rgb(247.95, 113.64, 27.53)',
                    0.77,
                    'rgb(247.11, 110.67, 26.25)',
                    0.773,
                    'rgb(246.22, 107.71, 24.98)',
                    0.777,
                    'rgb(245.28, 104.79, 23.74)',
                    0.781,
                    'rgb(244.29, 101.89, 22.52)',
                    0.785,
                    'rgb(243.26, 99.03, 21.32)',
                    0.789,
                    'rgb(242.19, 96.21, 20.16)',
                    0.793,
                    'rgb(241.07, 93.43, 19.03)',
                    0.797,
                    'rgb(239.91, 90.69, 17.93)',
                    0.801,
                    'rgb(238.71, 88.01, 16.87)',
                    0.805,
                    'rgb(237.47, 85.38, 15.86)',
                    0.809,
                    'rgb(236.19, 82.81, 14.88)',
                    0.812,
                    'rgb(234.87, 80.3, 13.96)',
                    0.816,
                    'rgb(233.51, 77.85, 13.09)',
                    0.82,
                    'rgb(232.11, 75.48, 12.28)',
                    0.824,
                    'rgb(230.68, 73.17, 11.52)',
                    0.828,
                    'rgb(229.21, 70.95, 10.82)',
                    0.832,
                    'rgb(227.71, 68.8, 10.18)',
                    0.836,
                    'rgb(226.16, 66.69, 9.57)',
                    0.84,
                    'rgb(224.57, 64.6, 8.98)',
                    0.844,
                    'rgb(222.93, 62.54, 8.41)',
                    0.848,
                    'rgb(221.24, 60.51, 7.86)',
                    0.852,
                    'rgb(219.5, 58.51, 7.33)',
                    0.855,
                    'rgb(217.72, 56.53, 6.83)',
                    0.859,
                    'rgb(215.89, 54.59, 6.34)',
                    0.863,
                    'rgb(214.01, 52.67, 5.88)',
                    0.867,
                    'rgb(212.09, 50.78, 5.43)',
                    0.871,
                    'rgb(210.12, 48.91, 5.01)',
                    0.875,
                    'rgb(208.1, 47.08, 4.61)',
                    0.879,
                    'rgb(206.04, 45.27, 4.23)',
                    0.883,
                    'rgb(203.93, 43.49, 3.88)',
                    0.887,
                    'rgb(201.77, 41.74, 3.54)',
                    0.891,
                    'rgb(199.56, 40.02, 3.22)',
                    0.895,
                    'rgb(197.31, 38.32, 2.93)',
                    0.898,
                    'rgb(195.01, 36.65, 2.65)',
                    0.902,
                    'rgb(192.67, 35.01, 2.4)',
                    0.906,
                    'rgb(190.27, 33.4, 2.17)',
                    0.91,
                    'rgb(187.84, 31.82, 1.96)',
                    0.914,
                    'rgb(185.35, 30.26, 1.77)',
                    0.918,
                    'rgb(182.81, 28.73, 1.6)',
                    0.922,
                    'rgb(180.23, 27.23, 1.46)',
                    0.926,
                    'rgb(177.61, 25.76, 1.33)',
                    0.93,
                    'rgb(174.94, 24.32, 1.23)',
                    0.934,
                    'rgb(172.21, 22.9, 1.14)',
                    0.938,
                    'rgb(169.44, 21.51, 1.08)',
                    0.941,
                    'rgb(166.63, 20.15, 1.04)',
                    0.945,
                    'rgb(163.77, 18.82, 1.02)',
                    0.949,
                    'rgb(160.86, 17.51, 1.02)',
                    0.953,
                    'rgb(157.9, 16.24, 1.05)',
                    0.957,
                    'rgb(154.9, 14.99, 1.09)',
                    0.961,
                    'rgb(151.85, 13.77, 1.16)',
                    0.965,
                    'rgb(148.76, 12.57, 1.24)',
                    0.969,
                    'rgb(145.61, 11.41, 1.35)',
                    0.973,
                    'rgb(142.42, 10.27, 1.48)',
                    0.977,
                    'rgb(139.19, 9.16, 1.63)',
                    0.98,
                    'rgb(135.9, 8.08, 1.8)',
                    0.984,
                    'rgb(132.57, 7.03, 1.99)',
                    0.988,
                    'rgb(129.19, 6.0, 2.2)',
                    0.992,
                    'rgb(125.77, 5.01, 2.44)',
                    0.996,
                    'rgb(122.3, 4.04, 2.69)'
]

const viridis = [0.0,
    'rgba(68, 1, 84,0)',
    0.01,
    'rgb(68, 1, 84)',
    0.13,
    'rgb(71, 44, 122)',
    0.25,
    'rgb(59, 81, 139)',
    0.38,
    'rgb(44, 113, 142)',
    0.5,
    'rgb(33, 144, 141)',
    0.63,
    'rgb(39, 173, 129)',
    0.75,
    'rgb(92, 200, 99)',
    0.88,
    'rgb(170, 220, 50)',
    1.0,
    'rgb(253, 231, 37)'
];

const cubehelix = [0.0,
    'rgba(0, 0, 0,0)',
    0.01,
    'rgb(0, 0, 0)',
    0.0175,
    'rgb(22, 5, 59)',
    0.0325,
    'rgb(60, 4, 105)',
    0.05,
    'rgb(109, 1, 135)',
    0.0675,
    'rgb(161, 0, 147)',
    0.0825,
    'rgb(210, 2, 142)',
    0.1,
    'rgb(251, 11, 123)',
    0.1175,
    'rgb(255, 29, 97)',
    0.1325,
    'rgb(255, 54, 69)',
    0.15,
    'rgb(255, 85, 46)',
    0.1675,
    'rgb(255, 120, 34)',
    0.1825,
    'rgb(255, 157, 37)',
    0.2,
    'rgb(241, 191, 57)',
    0.2175,
    'rgb(224, 220, 93)',
    0.2325,
    'rgb(218, 241, 142)',
    0.25,
    'rgb(227, 253, 198)'
];

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
            heatlyr.coloramp = viridis
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
        coloramp:turbo,
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
        coloramp:cubehelix,grup:'TWDB Critical Infrastructure'},
        {'id': 'Fire Stations',
        'data': dir+'TWDB_Critical_Infrastructure/Fire Stations.geojson',coloramp:cubehelix,grup:'TWDB Critical Infrastructure'},
        {'id': 'Hospitals', 'data': dir+'TWDB_Critical_Infrastructure/Hospitals.geojson'
        ,coloramp:cubehelix,grup:'TWDB Critical Infrastructure'},
        {'id': 'National Shelter System Facilities',
        'data': dir+'TWDB_Critical_Infrastructure/National Shelter System Facilities.geojson'
        ,coloramp:cubehelix,grup:'TWDB Critical Infrastructure'},
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

