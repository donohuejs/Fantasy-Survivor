'use client';

import {useEffect,useMemo,useState} from 'react';
import type {Castaway,RecipientMode,Tribe} from '@/lib/game-data';

export type RecipientSelection={mode:RecipientMode;tribeId?:string;castawayIds:string[]};

const labels:Record<RecipientMode,string>={individual:'Individual',tribe:'Tribe','all-active':'All Active',custom:'Custom'};

export function RecipientSelector({label='Applies to',modes,castaways,tribes,value,onChange,disabled=false}:{label?:string;modes:RecipientMode[];castaways:Castaway[];tribes:Tribe[];value:RecipientSelection;onChange:(selection:RecipientSelection)=>void;disabled?:boolean}){
  const [editing,setEditing]=useState(value.mode==='custom'&&!value.castawayIds.length),[query,setQuery]=useState('');
  // The parent supplies the canonical eligible collection used by both the
  // Individual dropdown and the Custom picker. Do not derive a second list
  // here, or the two modes can silently disagree about who may be selected.
  const eligible=castaways;
  const selected=useMemo(()=>castaways.filter(castaway=>value.castawayIds.includes(castaway.id)),[castaways,value.castawayIds]);
  const visible=useMemo(()=>eligible.filter(castaway=>`${castaway.name} ${castaway.shortName}`.toLowerCase().includes(query.trim().toLowerCase())),[eligible,query]);
  const activeIds=()=>eligible.map(castaway=>castaway.id);
  const selectMode=(mode:RecipientMode)=>{
    const next:RecipientSelection={mode,castawayIds:[]};
    if(mode==='all-active')next.castawayIds=activeIds();
    if(mode==='custom')setEditing(true);
    if(mode==='individual'&&value.castawayIds.length===1)next.castawayIds=value.castawayIds;
    if(mode==='tribe'&&value.tribeId){next.tribeId=value.tribeId;next.castawayIds=eligible.filter(castaway=>castaway.tribeId===value.tribeId).map(castaway=>castaway.id);}
    onChange(next);
  };
  const chooseTribe=(tribeId:string)=>onChange({mode:'tribe',tribeId,castawayIds:eligible.filter(castaway=>castaway.tribeId===tribeId).map(castaway=>castaway.id)});
  const chooseIndividual=(castawayId:string)=>onChange({mode:'individual',castawayIds:castawayId?[castawayId]:[]});
  const toggleCustom=(castawayId:string)=>onChange({...value,mode:'custom',castawayIds:value.castawayIds.includes(castawayId)?value.castawayIds.filter(id=>id!==castawayId):[...value.castawayIds,castawayId]});
  const selectAll=()=>onChange({...value,mode:'custom',castawayIds:eligible.map(castaway=>castaway.id)});
  const clearAll=()=>onChange({...value,mode:'custom',castawayIds:[]});
  useEffect(()=>{
    if(value.mode==='all-active'&&!value.castawayIds.length)onChange({...value,castawayIds:activeIds()});
  // The selector intentionally reacts only when the selected mode changes in
  // the parent; ordinary roster edits are handled by the server-side snapshot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[value.mode]);
  return <fieldset className="recipient-selector" disabled={disabled}>
    <legend>{label}</legend>
    <div className="recipient-mode-list" role="radiogroup" aria-label={label}>
      {modes.map(mode=><label key={mode} className="recipient-mode"><input type="radio" name={`recipient-mode-${label.replace(/\W/g,'-')}-${modes.join('-')}`} checked={value.mode===mode} onChange={()=>selectMode(mode)}/><span>{labels[mode]}</span></label>)}
    </div>
    {value.mode==='individual'&&<label className="wide">Castaway<select value={value.castawayIds[0]??''} onChange={event=>chooseIndividual(event.target.value)} required><option value="">Choose a castaway…</option>{eligible.map(castaway=><option value={castaway.id} key={castaway.id}>{castaway.name}</option>)}</select></label>}
    {value.mode==='tribe'&&<label className="wide">Tribe<select value={value.tribeId??''} onChange={event=>chooseTribe(event.target.value)} required><option value="">Choose a tribe…</option>{tribes.map(tribe=><option value={tribe.id} key={tribe.id}>{tribe.name} ({castaways.filter(castaway=>castaway.status==='active'&&castaway.tribeId===tribe.id).length} active)</option>)}</select></label>}
    {value.mode==='all-active'&&<div className="recipient-summary"><strong>{selected.length} active castaway{selected.length===1?'':'s'} selected</strong><span>{selected.map(castaway=>castaway.name).join(', ')||'No active castaways'}</span></div>}
    {value.mode==='custom'&&(editing||!selected.length)?<div className="recipient-custom-panel"><div className="recipient-custom-actions"><input aria-label="Search eligible castaways" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search castaways…"/><button type="button" className="text-button" onClick={selectAll}>Select all eligible</button><button type="button" className="text-button" onClick={clearAll}>Clear all</button></div><div className="recipient-options">{visible.map(castaway=><label key={castaway.id} className="recipient-option"><input type="checkbox" checked={value.castawayIds.includes(castaway.id)} onChange={()=>toggleCustom(castaway.id)}/><span>{castaway.name}</span></label>)}{!visible.length&&<p className="admin-feedback">No eligible castaways match that search.</p>}</div>{selected.length>0&&<button type="button" className="secondary-button" onClick={()=>setEditing(false)}>Done selecting</button>}</div>:value.mode==='custom'&&<div className="recipient-summary recipient-custom-summary"><strong>{selected.length} selected</strong><div className="recipient-chips">{selected.map(castaway=><button type="button" key={castaway.id} className="recipient-chip" onClick={()=>toggleCustom(castaway.id)}>{castaway.shortName||castaway.name} ×</button>)}</div><button type="button" className="text-button" onClick={()=>setEditing(true)}>Edit selection</button></div>}
  </fieldset>;
}
