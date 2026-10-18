import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {Device,Storage} from '@mobix/core';
import './style.css';
type Page='home'|'device'|'notes';
function App(){
 const [page,setPage]=useState<Page>('home');const [device,setDevice]=useState('Not loaded');const [note,setNote]=useState('');const [status,setStatus]=useState('');
 useEffect(()=>{Storage.get('demo.note').then(v=>setNote(v??'')).catch(()=>{})},[]);
 async function loadDevice(){setPage('device');try{setDevice(JSON.stringify(await Device.getInfo(),null,2))}catch(e){setDevice(String(e))}}
 async function save(){try{await Storage.set('demo.note',note);setStatus('Saved on this device')}catch(e){setStatus(String(e))}}
 return <div className="app"><header><span className="brand">M / MOBIX</span><small>Android prototype v0.2</small></header><main>
 {page==='home'&&<><div className="eyebrow">WELCOME TO MOBIX</div><h1>Build for mobile.<br/>Write for the web.</h1><p>A working demonstration of the Mobix native bridge, navigation and persistent storage.</p><div className="cards"><button onClick={loadDevice}><strong>Device information →</strong><span>Read Android device details</span></button><button onClick={()=>setPage('notes')}><strong>Persistent notes →</strong><span>Save data using the native storage plugin</span></button></div></>}
 {page==='device'&&<><button className="back" onClick={()=>setPage('home')}>← Back</button><h1>Device information</h1><p>Data returned from Kotlin through the Mobix bridge.</p><pre>{device}</pre><button className="primary" onClick={loadDevice}>Refresh</button></>}
 {page==='notes'&&<><button className="back" onClick={()=>setPage('home')}>← Back</button><h1>Persistent notes</h1><p>Stored locally using Android SharedPreferences.</p><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Write something..."/><button className="primary" onClick={save}>Save note</button><p role="status">{status}</p></>}
 </main><footer>Independent mobile runtime · TypeScript + Kotlin</footer></div>
}
createRoot(document.getElementById('root')!).render(<App/>);
