import {mountCase} from '../../shared/integration.js';
document.title = 'Loop Towers · 3D Structural Studio';
mountCase({id:'loop-towers',number:'02',title:'Loop Towers',subtitle:'Terraced twin towers · inclined crown · structural cradle',nativeGeometryMode:'architecture',cameraSelector:'.viewbuttons',sourceFile:'../../downloads/building-v2.zip'});
await import('./app.js');
// Optional Blender export adapter; original renderer and worker are unmodified.
await import('./blender-export.js');
