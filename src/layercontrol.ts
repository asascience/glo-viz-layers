import { isString } from "./utils";
import Picker from 'vanilla-picker';
import 'vanilla-picker/dist/vanilla-picker.csp.css';

export function lcCreateLayerToggle(map, layer, checked, sources) {
    let containerDiv = document.createElement("div");
    containerDiv.style.display = "flex";
    containerDiv.style.width = "100%";
    containerDiv.style.flexDirection = "column";
    let div = document.createElement("div");
    div.className = "checkbox";
    div.style.display = "flex";
    div.style.width = "100%";
    div.style.flexDirection = "row";
    div.style.justifyContent = "between";
    div.style.gap = "4pxs";
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
    
    const layerRowDiv = document.createElement("div");
    layerRowDiv.appendChild(input);
    layerRowDiv.appendChild(label);
    div.appendChild(layerRowDiv);

    const pickerId = `picker-div-${layer.id.replaceAll(" ","_")}`;
    const pickerDiv = document.createElement("div");
    pickerDiv.id = pickerId;
    pickerDiv.style.height = "0px";
    pickerDiv.style.overflow = "hidden";
    pickerDiv.style.transition = "all 0.2s";
    
    if (layer.type === "vector") {
        // Add a color picker
        const settingsButton = document.createElement("div");
        settingsButton.innerHTML = `<img src="gear.svg" style="width: 16px; height: 16px;" />`;
        settingsButton.onclick = () => {
            // Find the corresponding picker div and expand/collapse it
            const el = document.querySelector("#"+pickerId) as HTMLElement;
            if (!el) return;
            if (el.style.height === "0px") {
                el.style.height = "320px";
            } else {
                el.style.height = "0px";
            }
        }
        let colorPicker = new Picker({
            parent: pickerDiv,
            popup: false,
            alpha: false,
            color: layer.initialColor,
            onChange: (color) => {
                if (!map) return;
                const mapLayer = map.getStyle()?.layers?.find(styleLayer => styleLayer.id === layer.id);
                if (!mapLayer) return;
                try {
                    map.setPaintProperty(mapLayer.id, layer.paintPropertyType, color.hex.substring(0, color.hex.length - 2))
                } catch (e) {
                    console.log(e)
                }
            }
        });
        div.appendChild(settingsButton);

    }

    if (layer.metadata && layer.metadata.filterSchema) {
        let filterSpan = document.createElement("span");
        filterSpan.style.float = "right";
        filterSpan.style.height = "20px";
        filterSpan.style.opacity = "0.3";
        filterSpan.innerHTML = filterIcon();
        filterSpan.onclick = function () {
            filterModal(map, layer)
        }
        filterSpan.onmouseenter = function () {
            // @ts-ignore
            this.style.opacity = 1;
        }
        filterSpan.onmouseleave = function () {
            // @ts-ignore
            this.style.opacity = 0.3;
        }
        div.appendChild(filterSpan)
    }
    
    div.appendChild(legend);
    containerDiv.appendChild(div)
    containerDiv.appendChild(pickerDiv);
    
    return { layerSelector: containerDiv, newSources: sources }
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

export function lcCreateDicrectory(directoryName, layerCount) {

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

export function lcCreateGroup(group, layers, map) {
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

export function lcCreateButton(collapsed) {
    let div = document.createElement('div');
    div["aria-label"] = "Layer Control";
    div.dataset.layerControl = "true"
    div.className = 'mapboxgl-ctrl mapboxgl-ctrl-group mgl-layerControl';
    if (collapsed) div.classList.add("collapsed");

    return div
}

export function lcCreateLegend(style) {
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

export function lcSetActiveLayers(l, checked) {
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
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            window.location.hash = "#";
            var filter = buildFilter(new FormData(form), layer);
            console.log(filter)
            if (!filter) {
                layer.metadata.layers.forEach(l => {
                    map.setFilter(l)
                })
            } else {
                layer.metadata.layers.forEach(l => {
                    map.setFilter(l, filter)
                })
            }
        });

        form.addEventListener("reset", function (_) {
            layer.metadata.layers.forEach(l => {
                map.setFilter(l)
            })
        })

        modal.querySelector(".modal-body")?.appendChild(form)
        document.body.appendChild(modal);
        window.location.hash = "#"
        window.location.hash = id
    } else {
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
            case "date": filter.push([values[i + 1], ["get", fields[i]], filterValue]); break;
            case "number": filter.push([values[i + 1], ["get", fields[i]], Number(filterValue)]); break;
            default: filter.push(["==", ["get", fields[i]], filterValue]);
        }
    }

    if (filter.length < 1) {
        return null
    } else {
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