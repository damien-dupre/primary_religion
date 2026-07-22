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
        'push(){super.push(),this.svg.textContent=this.text,bn.pushText(this.svg,this.anchor,this.rotation,this.offset,this.oriented,this.autoFlip)}',
        'push(){super.push(),this.svg.textContent=this.text,this.text.includes("\\n")&&(()=>{const n=this.text.split("\\n");this.svg.textContent="",n.forEach((h,y)=>{const A=document.createElementNS("http://www.w3.org/2000/svg","tspan");A.textContent=h,A.setAttribute("x","0"),A.setAttribute("dy",y===0?"-0.55em":"1.1em"),this.svg.appendChild(A)})})(),bn.pushText(this.svg,this.anchor,this.rotation,this.offset,this.oriented,this.autoFlip)}',
    ),
    (
        'features:i.map(y=>({type:"Feature",geometry:{type:"Point",coordinates:[y.lng,y.lat]},properties:{}}))',
        'features:i.map(y=>({type:"Feature",geometry:{type:"Point",coordinates:[y.lng,y.lat]},properties:{id:y.id,ethos:y.ethos??(["Catholic","Church of Ireland","Multi-denominational","Inter-denominational","Other"][((y.values&&y.values[0])||[]).findIndex(z=>z>0)]??""),name:y.name??"",county:y.county??"",denomPct:y.denomPct??null,multiPct:y.multiPct??null}}))',
    ),
    (
        'name:J.showCategoryLabels?ot.label:""})),G=',
        'name:J.showCategoryLabels?ot.label.replace("Multi-denominational","Multi-\\ndenominational").replace("Inter-denominational","Inter-\\ndenominational").replace("Church of Ireland","Church of\\nIreland").replace("Denominational","Denomina-\\ntional"):""})),G=',
    ),
    (
        'this.map.getLayer(gr.LAYER_ID)?(this.map.setPaintProperty(gr.LAYER_ID,"circle-radius",n.radius),this.map.setPaintProperty(gr.LAYER_ID,"circle-color",n.color)):this.map.addLayer({id:gr.LAYER_ID,type:"circle",source:gr.SOURCE_ID,paint:{"circle-radius":n.radius,"circle-color":n.color}})',
        'this.map.getLayer(gr.LAYER_ID)?(this.map.setPaintProperty(gr.LAYER_ID,"circle-radius",n.radius),this.map.setPaintProperty(gr.LAYER_ID,"circle-color",["match",["get","ethos"],"Catholic","#8f3fb0","Church of Ireland","#e07a3f","Multi-denominational","#2a7fa3","Inter-denominational","#58a58e","Other","#d1a72b","#777777"])):this.map.addLayer({id:gr.LAYER_ID,type:"circle",source:gr.SOURCE_ID,paint:{"circle-radius":n.radius,"circle-color":["match",["get","ethos"],"Catholic","#8f3fb0","Church of Ireland","#e07a3f","Multi-denominational","#2a7fa3","Inter-denominational","#58a58e","Other","#d1a72b","#777777"],"circle-stroke-color":"rgba(255,255,255,0.9)","circle-stroke-width":0.8}})',
    ),
    (
        'A.update({points:c,groups:n.groups,config:Xy(I)}),new ResizeObserver',
        'window.matchMedia("(max-width: 700px)").matches&&(I.radiusSlider.initial=Math.round(Math.max(70,Math.min(90,window.innerWidth*.23))));A.update({points:c,groups:n.groups,config:Xy(I)}),window.__visquillController=A,window.__visquillPayload={points:c,groups:n.groups,config:Xy(I)},window.dispatchEvent(new Event("visquill-ready")),new ResizeObserver',
    ),
    (
        'Y={type:"bar-plot",aspect:"data",offset:20,barWidth:',
        'Y={type:"bar-plot",aspect:"data",offset:34,barWidth:',
    ),
    (
        'barOffset:10,baselineStyle:',
        'barOffset:14,baselineStyle:',
    ),
    (
        'Y=this.buildTitle(n),ot=10,dt=n.initialRadius',
        'Y=this.buildTitle(n)+72,ot=10,dt=n.initialRadius',
    ),
)

PATCH_UPDATES = (
    (
        'push(){super.push(),this.svg.textContent=this.text,window.matchMedia("(max-width: 700px)").matches&&this.text.includes("\\n")&&(()=>{const n=this.text.split("\\n");this.svg.textContent="",n.forEach((h,y)=>{const A=document.createElementNS("http://www.w3.org/2000/svg","tspan");A.textContent=h,A.setAttribute("x","0"),A.setAttribute("dy",y===0?"-0.55em":"1.1em"),this.svg.appendChild(A)})})(),bn.pushText(this.svg,this.anchor,this.rotation,this.offset,this.oriented,this.autoFlip)}',
        'push(){super.push(),this.svg.textContent=this.text,this.text.includes("\\n")&&(()=>{const n=this.text.split("\\n");this.svg.textContent="",n.forEach((h,y)=>{const A=document.createElementNS("http://www.w3.org/2000/svg","tspan");A.textContent=h,A.setAttribute("x","0"),A.setAttribute("dy",y===0?"-0.55em":"1.1em"),this.svg.appendChild(A)})})(),bn.pushText(this.svg,this.anchor,this.rotation,this.offset,this.oriented,this.autoFlip)}',
    ),
    (
        'name:J.showCategoryLabels?(window.matchMedia("(max-width: 700px)").matches?ot.label.replace("Multi-denominational","Multi-\\ndenominational").replace("Inter-denominational","Inter-\\ndenominational").replace("Church of Ireland","Church of\\nIreland").replace("Denominational","Denomina-\\ntional"):ot.label):""})),G=',
        'name:J.showCategoryLabels?ot.label.replace("Multi-denominational","Multi-\\ndenominational").replace("Inter-denominational","Inter-\\ndenominational").replace("Church of Ireland","Church of\\nIreland").replace("Denominational","Denomina-\\ntional"):""})),G=',
    ),
    (
        'push(){super.push(),this.svg.textContent=this.text,bn.pushText(this.svg,this.anchor,this.rotation,this.offset,this.oriented,this.autoFlip)}',
        'push(){super.push(),this.svg.textContent=this.text,window.matchMedia("(max-width: 700px)").matches&&this.text.includes("\\n")&&(()=>{const n=this.text.split("\\n");this.svg.textContent="",n.forEach((h,y)=>{const A=document.createElementNS("http://www.w3.org/2000/svg","tspan");A.textContent=h,A.setAttribute("x","0"),A.setAttribute("dy",y===0?"-0.55em":"1.1em"),this.svg.appendChild(A)})})(),bn.pushText(this.svg,this.anchor,this.rotation,this.offset,this.oriented,this.autoFlip)}',
    ),
    (
        'name:J.showCategoryLabels?ot.label:""})),G=',
        'name:J.showCategoryLabels?(window.matchMedia("(max-width: 700px)").matches?ot.label.replace("Multi-denominational","Multi-\\ndenominational").replace("Inter-denominational","Inter-\\ndenominational").replace("Church of Ireland","Church of\\nIreland").replace("Denominational","Denomina-\\ntional"):ot.label):""})),G=',
    ),
    (
        'const c=n.version===2?rx(n.points,n.groups):n.points;A.update({points:c,groups:n.groups,config:Xy(I)})',
        'const c=n.version===2?rx(n.points,n.groups):n.points;window.matchMedia("(max-width: 700px)").matches&&(I.radiusSlider.initial=Math.round(Math.max(70,Math.min(90,window.innerWidth*.23))));A.update({points:c,groups:n.groups,config:Xy(I)})',
    ),
    (
        'properties:{id:y.id,ethos:y.ethos??"",name:y.name??"",county:y.county??"",denomPct:y.denomPct??null,multiPct:y.multiPct??null}',
        'properties:{id:y.id,ethos:y.ethos??(["Catholic","Church of Ireland","Multi-denominational","Inter-denominational","Other"][((y.values&&y.values[0])||[]).findIndex(z=>z>0)]??""),name:y.name??"",county:y.county??"",denomPct:y.denomPct??null,multiPct:y.multiPct??null}',
    ),
    (
        'title:{style:Bo.aspectLabel(J.id),minLength:40,minRadius:40,offset:-20,text:J.label}',
        'title:{style:Bo.aspectLabel(J.id),minLength:40,minRadius:40,text:J.label}',
    ),
    (
        'Y={type:"bar-plot",aspect:"data",offset:20,barWidth:',
        'Y={type:"bar-plot",aspect:"data",offset:34,barWidth:',
    ),
    (
        'barOffset:10,baselineStyle:',
        'barOffset:14,baselineStyle:',
    ),
    (
        'Y=this.buildTitle(n),ot=10,dt=n.initialRadius',
        'Y=this.buildTitle(n)+72,ot=10,dt=n.initialRadius',
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
