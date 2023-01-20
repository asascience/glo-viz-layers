
export function getAllChecked(boxes) {
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

export function toggleChildren(div, start) {
    div.style.height = div.scrollHeight + "px";
    if (div.scrollHeight > 50) {
        div.style.height = "36px";
        setTimeout(function () {
            var children = div.children;
            if (children.length > 1 && children[start].style.display === "none") {
                for (var i = start; i < children.length; i++) {
                    if (!children[i].dataset.hidden) children[i].style.display = "block"
                }
            } else {
                for (var i = start; i < children.length; i++) {
                    children[i].style.display = "none"
                }
            }
            div.style.height = "auto";
        }, 400)
    } else {
        var children = div.children;
        if (children.length > 1 && children[start].style.display === "none") {
            for (var i = start; i < children.length; i++) {
                if (!children[i].dataset.hidden) children[i].style.display = "block"
            }
        } else {
            for (var i = start; i < children.length; i++) {
                children[i].style.display = "none"
            }
        }
        div.style.height = div.scrollHeight + "px";
        setTimeout(function () {
            div.style.height = "auto";
        }, 400)
    }
}

export function getLayerVisibility(mapLayers, ids, layer) {
    var index = ids.indexOf(layer);
    if (index < 0) {
        return false
    } else {
        return mapLayers[index].layout.visibility === "visible" ? true : false;
    }
}

export function getMapLayerIds(layers) {
    return layers.reduce((array, layer) => {
        return [...array, layer.id]
    }, [])
}

export function getActiveLayers(map, layers) {
    let keys = layers.reduce((i, l) => {
        return [...i, l.id]
    }, []);
    let _map = map;
    let _mapLayers = _map.getStyle().layers;
    let _ids = getMapLayerIds(_mapLayers);
    let urlParams = new URLSearchParams(window.location.search);
    let _layers = [...urlParams.keys()];
    let _values = [...urlParams.values()]; //COULD USE THIS IN THE FUTURE TO TURN LAYERS OFF FOR NOW ADDING ALL LAYERS AS VISIBILITY NONE AND TURNING THEM ON WITH THE LAYER CONTROL
    _layers.map(function (l) {
        if (keys.indexOf(l) > -1) {
            let visibility = getLayerVisibility(_mapLayers, _ids, l);
            if (!visibility) {
                _map.setLayoutProperty(l, "visibility", "visible")
            }
        }
    });
    return _layers
}

export function setLayerVisibility(m, checked, layer) {
    let visibility = (checked === true) ? 'visible' : 'none';
    m.setLayoutProperty(layer, 'visibility', visibility);
}

export function getStyle(layers, layer) {
    let layerConfig = layers.filter(function (l) {
        return l.id === layer.id
    })
    let style = (!layerConfig[0].paint) ? false : layerConfig[0].paint

    return style
}