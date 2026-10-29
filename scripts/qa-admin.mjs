import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=resolve('dist');
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!path.startsWith(root))throw Error();const file=path===root?resolve(root,'index.html'):path;res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(5193,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5193/');await page.getByRole('heading',{name:'현장 대시보드',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'작업자 앱',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'출근하기',exact:true}).count(),0);
 await page.screenshot({path:'../tmp/admin-dashboard.png',fullPage:true});
 for(const title of ['작업자 관리','위험 신고 · 조치','안전 타임라인','근로 기록','보고서']){
  await page.locator('nav').getByRole('button',{name:title,exact:false}).click();
  await page.getByRole('heading',{name:title,exact:true}).waitFor();
 }
 await page.getByRole('button',{name:'작업자 초대',exact:true}).click();await page.getByText('Android 앱에서 인증 후 현장에 참여합니다.',{exact:false}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: 관리자 6개 화면·초대 안내·작업자 화면 제거·런타임 오류 없음');
}finally{await browser.close();server.close();}
