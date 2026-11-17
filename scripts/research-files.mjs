import fs from 'node:fs';
import path from 'node:path';
export const researchRoot=path.resolve(import.meta.dirname,'..');
export const researchIndex=JSON.parse(fs.readFileSync(path.join(researchRoot,'public/research/file-index.json')));
export const distribution=JSON.parse(fs.readFileSync(path.join(researchRoot,'research-data/distribution.json')));
export function researchFile(p){
  const row=distribution.files[p];
  if(!row || path.isAbsolute(row.source) || row.source.split('/').includes('..')) throw Error('Unknown or unsafe research path: '+p);
  return path.join(researchRoot,row.source);
}
