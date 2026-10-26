import {mountCase} from '../../shared/integration.js';
mountCase({id:'pavilion',number:'03',title:'Woven-Wing Pavilion',subtitle:'Sweeping perimeter arches · branching supports · woven field',nativeGeometryMode:'concept',cameraSelector:'.view-tools',sourceFile:'../../downloads/pavilion-source.zip'});
await import('./app.js');
// Optional Blender export adapter; original renderer and worker are unmodified.
await import('./blender-export.js');
