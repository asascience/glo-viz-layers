import { lcCreateButton, lcCreateDicrectory, lcCreateGroup, lcCreateLayerToggle, lcCreateLegend, lcSetActiveLayers } from "./layercontrol";
import { getActiveLayers, getAllChecked, getLayerVisibility, getMapLayerIds, getStyle, isScrolledIntoView, setLayerVisibility, toggleChildren } from "./utils";

export class LayerControlGrouped {

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
        this._layerIds = this._layers.reduce((i, l) => {
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

                setTimeout(function () {
                    if (!isScrolledIntoView(e.target.parentElement)) {
                        window.location.hash = e.target.id;
                    }
                }, 410);
                setTimeout(function () {
                    _this._map?.resize()
                }, 450)
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