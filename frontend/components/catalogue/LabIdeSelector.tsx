"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {useAuth} from "@/contexts/BasicAuthContext";
import { IDE_LABELS, labIdeOptions, resolveLabIde, labIdeHref } from "@/lib/mumbaiUniversity/labIdeAssociations";

export default function LabIdeSelector({labId,preferredIde,onSelect,disabled=false}:{labId:string;preferredIde?:string|null;onSelect?:(ide:string)=>void;disabled?:boolean}) {
  const {user}=useAuth();
  const preferenceKey="labmate:lab-ide:"+(user?.id || "guest")+":"+labId;
  const [selected,setSelected] = useState(resolveLabIde(labId));
  useEffect(()=>{
    let preference: string | null = null;
    try { preference = localStorage.getItem(preferenceKey); } catch {}
    setSelected(resolveLabIde(labId,preferredIde || preference));
  },[labId,preferredIde,preferenceKey]);
  const href=labIdeHref(labId,selected);
  if(!href)return null;
  return <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:12,margin:"16px 0"}}>
    <label htmlFor={"lab-ide-"+labId}>IDE</label>
    <select id={"lab-ide-"+labId} value={selected} disabled={disabled} onChange={event=>{
      const value=resolveLabIde(labId,event.target.value);
      setSelected(value);
      try { if(value)localStorage.setItem(preferenceKey,value); } catch {}
      if(value)onSelect?.(value);
    }} style={{padding:8,border:"1px solid #52525b",borderRadius:6,background:"#18181b",color:"#fafafa"}}>
      {labIdeOptions(labId).map(ide=><option key={ide} value={ide}>{IDE_LABELS[ide]}</option>)}
    </select>
    <Link href={href} style={{padding:"8px 14px",borderRadius:6,background:"#fafafa",color:"#18181b"}}>Open lab</Link>
  </div>;
}
