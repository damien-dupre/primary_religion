#!/usr/bin/env python3
"""Add narrow integration hooks to the otherwise unchanged VisQuill export."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VIEWER = ROOT / "viewer.js"

REPLACEMENTS = (
    (
        'this.map=new Ky.Map({container:i,style:t_(n),center:[10,51],zoom:5,attributionControl:!1}),this.map.once',
        'this.map=new Ky.Map({container:i,style:t_(n),center:[10,51],zoom:5,attributionControl:!1}),window.__visquillMap=this.map,this.map.once',
    ),
    (
        'features:i.map(y=>({type:"Feature",geometry:{type:"Point",coordinates:[y.lng,y.lat]},properties:{}}))',
        'features:i.map(y=>({type:"Feature",geometry:{type:"Point",coordinates:[y.lng,y.lat]},properties:{id:y.id,ethos:y.ethos??(["Catholic","Church of Ireland","Multi-denominational","Inter-denominational","Other"][((y.values&&y.values[0])||[]).findIndex(z=>z>0)]??""),name:y.name??"",county:y.county??"",denomPct:y.denomPct??null,multiPct:y.multiPct??null}}))',
    ),
    (
        'this.map.getLayer(gr.LAYER_ID)?(this.map.setPaintProperty(gr.LAYER_ID,"circle-radius",n.radius),this.map.setPaintProperty(gr.LAYER_ID,"circle-color",n.color)):this.map.addLayer({id:gr.LAYER_ID,type:"circle",source:gr.SOURCE_ID,paint:{"circle-radius":n.radius,"circle-color":n.color}})',
        'this.map.getLayer(gr.LAYER_ID)?(this.map.setPaintProperty(gr.LAYER_ID,"circle-radius",n.radius),this.map.setPaintProperty(gr.LAYER_ID,"circle-color",["match",["get","ethos"],"Catholic","#8f3fb0","Church of Ireland","#e07a3f","Multi-denominational","#2a7fa3","Inter-denominational","#58a58e","Other","#d1a72b","#777777"])):this.map.addLayer({id:gr.LAYER_ID,type:"circle",source:gr.SOURCE_ID,paint:{"circle-radius":n.radius,"circle-color":["match",["get","ethos"],"Catholic","#8f3fb0","Church of Ireland","#e07a3f","Multi-denominational","#2a7fa3","Inter-denominational","#58a58e","Other","#d1a72b","#777777"],"circle-stroke-color":"rgba(255,255,255,0.9)","circle-stroke-width":0.8}})',
    ),
    (
        'A.update({points:c,groups:n.groups,config:Xy(I)}),new ResizeObserver',
        'A.update({points:c,groups:n.groups,config:Xy(I)}),window.__visquillController=A,window.__visquillPayload={points:c,groups:n.groups,config:Xy(I)},window.dispatchEvent(new Event("visquill-ready")),new ResizeObserver',
    ),
)

PATCH_UPDATES = (
    (
        'properties:{id:y.id,ethos:y.ethos??"",name:y.name??"",county:y.county??"",denomPct:y.denomPct??null,multiPct:y.multiPct??null}',
        'properties:{id:y.id,ethos:y.ethos??(["Catholic","Church of Ireland","Multi-denominational","Inter-denominational","Other"][((y.values&&y.values[0])||[]).findIndex(z=>z>0)]??""),name:y.name??"",county:y.county??"",denomPct:y.denomPct??null,multiPct:y.multiPct??null}',
    ),
)


def main() -> None:
    source = VIEWER.read_text(encoding="utf-8")
    if "window.__visquillController" in source:
        changed = False
        for before, after in PATCH_UPDATES:
            matches = source.count(before)
            if matches > 1:
                raise RuntimeError(f"Expected at most one viewer update target, found {matches}")
            if matches == 1:
                source = source.replace(before, after, 1)
                changed = True
        if changed:
            VIEWER.write_text(source, encoding="utf-8")
            print(f"Updated VisQuill integration hooks in {VIEWER}")
        else:
            print(f"{VIEWER} is already patched")
        return

    for before, after in REPLACEMENTS:
        matches = source.count(before)
        if matches != 1:
            raise RuntimeError(f"Expected one viewer integration target, found {matches}")
        source = source.replace(before, after, 1)

    VIEWER.write_text(source, encoding="utf-8")
    print(f"Added VisQuill integration hooks to {VIEWER}")


if __name__ == "__main__":
    main()
