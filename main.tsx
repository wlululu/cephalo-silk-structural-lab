import {assetUrl} from './shared/assetUrl';
import React,{useState,useEffect,lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
const BridgeCase=lazy(()=>import('./cases/bridge/BridgeCase'));
const ResearchViewer=lazy(()=>import('./research/ResearchViewer'));
import {Header,CaseNavigation,caseStudies} from './shared/Platform';
import './app/globals.css';
import './public/shared/lab.css';
function App(){
 const read=()=>location.hash.startsWith('#/research')?'research':caseStudies.some(c=>c.id===location.hash.slice(2))?location.hash.slice(2):'bridge';
 const [active,setActive]=useState(read);
 useEffect(()=>{const onHash=()=>setActive(read());window.addEventListener('hashchange',onHash);return()=>window.removeEventListener('hashchange',onHash)},[]);
 useEffect(()=>{document.title=`${caseStudies.find(c=>c.id===active)?.title} · 3D Structural Studio`},[active]);
 return <><Header/><CaseNavigation active={active}/><div className={active==='research'?'case-host phase3-host':'case-host'} key={active}><Suspense fallback={<p role="status">Loading view…</p>}>{active==='research'?<ResearchViewer/>:active==='bridge'?<BridgeCase/>:<iframe className="case-frame" title={caseStudies.find(c=>c.id===active)?.title} src={assetUrl(`cases/${active}/index.html`)}/>}</Suspense></div></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
