import http from 'node:http';
import {readFile,stat,realpath,appendFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=fileURLToPath(new URL('..',import.meta.url)),dist=path.join(root,'dist'),log=path.join(root,'start.log');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.jpg':'image/jpeg'};
async function note(message){console.log(message);await appendFile(log,`[${new Date().toISOString()}] ${message}\r\n`).catch(()=>{})}
if(!existsSync(path.join(dist,'index.html'))){await note('[ERROR] dist/index.html is missing. Run npm install and npm run build once.');process.exitCode=1;}else{
 const realDist=await realpath(dist);
 const server=http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'}).end();return}
  try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=path.resolve(dist,'.'+name);if(file!==dist&&!file.startsWith(dist+path.sep)){res.writeHead(403).end('Forbidden');return}
   try{if((await stat(file)).isDirectory())file=path.join(file,'index.html')}catch{if(path.extname(file)){res.writeHead(404).end('Not found');return}file=path.join(dist,'index.html')}
   const real=await realpath(file);if(!real.startsWith(realDist+path.sep)){res.writeHead(403).end('Forbidden');return}
   const bytes=await readFile(real);res.writeHead(200,{'Content-Type':mime[path.extname(real)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404).end('Not found')}
 });
 let port=Number(process.env.SAFELOOP_PORT)||5174;
 await new Promise((resolve,reject)=>{server.on('error',e=>{if(e.code==='EADDRINUSE'&&port<5190){port++;server.listen(port,'127.0.0.1')}else reject(e)});server.once('listening',resolve);server.listen(port,'127.0.0.1')});
 const url=`http://127.0.0.1:${port}/`;await note(`SafeLoop is ready: ${url}`);await note('Keep this window open. Press Ctrl+C to stop. No npm install or build is needed.');
 if(!process.argv.includes('--no-open')){
  const child=process.platform==='win32'?spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,stdio:'ignore'}):spawn(process.platform==='darwin'?'open':'xdg-open',[url],{stdio:'ignore'});
  child.on('error',e=>note(`Could not open browser automatically. Open ${url} manually. ${e.message}`));child.unref();
 }
 const stop=()=>server.close(()=>process.exit(0));process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
