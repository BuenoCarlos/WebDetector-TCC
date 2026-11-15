import { randomUUID, createHash } from "node:crypto";
import { supabase } from "../config/supabase";
import { SQLI_PROBES, xssPayloads } from "./probeCatalog";

// O Node apenas executa requisições e coleta os sinais. O Python decide o resultado.
type Attack = "SQLI" | "XSS";
type Method = "GET" | "POST";
type Outcome = "confirmed" | "suspected" | "not_confirmed" | "inconclusive";
type Dict = Record<string, unknown>;
type AuthContract = {success_fields:string[];identity_fields:string[];session_cookie_names:string[];confirmation_mode:"response"|"session"};
type Contract = {kind:"authentication"|"generic";baseline:Record<string,string>;auth?:AuthContract;browser_xss:boolean};
type OperationInfo = {path:string;method:Method;summary:string;fields:string[];contract:Contract};
type Evidence = {status:number;content_type:string;body_digest:string;payload_reflected:boolean;
  flags:Record<string,boolean>;identity_fields_present:string[];session_cookie_names:string[];
  durationMs:number;error?:string};
type Analysis = {outcome:Outcome; explanation:string; recommendations:string[];
  signals:Record<string,unknown>;ml: {request:{classification:string;algorithm:string};attack:{classification:string;algorithm:string}}|null;ml_error?:string|null};
const ACTIVE = new Set<string>();
const PYTHON = process.env.WD_ML_URL || "http://127.0.0.1:5000";

function isObject(input:unknown):input is Dict {return Boolean(input)&&typeof input==="object"&&!Array.isArray(input);}
function getObj(obj:Dict,key:string):Dict {return isObject(obj[key])?obj[key] as Dict:{};}
function localBase(base:string):URL {
  const url = new URL(base);
  if(url.protocol!=="http:"||!["localhost","127.0.0.1"].includes(url.hostname)||
    !url.port||url.pathname!=="/"||url.search||url.hash||url.username||url.password)
    throw new Error("Use somente URL HTTP local, com porta explícita e sem caminho (ex.: http://127.0.0.1:8000).");
  return url;
}
function validPath(path:string):boolean {return /^\/[A-Za-z0-9/_-]{1,200}$/.test(path)&&!path.includes("//")&&!path.includes("..");}
function boolList(value:unknown):string[] {return Array.isArray(value)?value.filter((x):x is string=>typeof x==="string"&&/^[a-zA-Z0-9_.-]{1,90}$/.test(x)).slice(0,10):[];}
function parseFlatBaseline(value:unknown):Record<string,string> {
  if(!isObject(value)) throw new Error("OpenAPI: configure x-webdetector-test.baseline com valores fictícios.");
  const result:Record<string,string>={};
  for(const [key,v] of Object.entries(value)) {
    if(!/^[a-zA-Z_][\w-]{0,79}$/.test(key) || !["string","number","boolean"].includes(typeof v) || String(v).length>200)
      throw new Error("OpenAPI: baseline inválida; use campos simples com valores fictícios.");
    result[key]=String(v);
  }
  return result;
}
function resolveLocalRef(doc:Dict,value:unknown):Dict {
  if(!isObject(value))return {};
  const ref=value.$ref;
  if(typeof ref!=="string"||!ref.startsWith("#/"))return value;
  let current:unknown=doc;
  for(const segment of ref.slice(2).split("/")) {
    const key=segment.replace(/~1/g,"/").replace(/~0/g,"~");
    current=isObject(current)?current[key]:undefined;
  }
  return isObject(current)?current:{};
}
function opFields(doc:Dict, op:Dict, method:Method):string[] {
  if(method==="GET") {
    return (Array.isArray(op.parameters)?op.parameters:[]).map(p=>resolveLocalRef(doc,p)).filter(p=>p.in==="query"&&
      isObject(p.schema)&&(!p.schema.type||p.schema.type==="string")&&typeof p.name==="string")
      .map(p=>String(p.name));
  }
  const body=resolveLocalRef(doc,op.requestBody);
  const content=getObj(body,"content");
  const mime=getObj(content,"application/json");
  const schema=resolveLocalRef(doc,mime.schema);
  const properties=getObj(schema,"properties");
  return Object.entries(properties).filter(([_,v])=>{const x=resolveLocalRef(doc,v);return x.type==="string"||!x.type;}).map(([k])=>k);
}
function concretePath(doc:Dict, template:string, op:Dict):string|null {
  if(!template.includes("{"))return validPath(template)?template:null;
  const params=(Array.isArray(op.parameters)?op.parameters:[]).map(p=>resolveLocalRef(doc,p));
  const result=template.replace(/\{([^}]+)\}/g,(_,name:string)=>{
    const parameter=params.find(p=>p.in==="path"&&p.name===name);
    const schema=parameter&&isObject(parameter.schema)?parameter.schema:{};
    const example=parameter?.example??schema.example;
    if(!["string","number"].includes(typeof example)|| !/^[a-zA-Z0-9_-]{1,90}$/.test(String(example)))return "__missing__";
    return String(example);
  });
  return result.includes("__missing__")||!validPath(result)?null:result;
}
function infoFromOp(doc:Dict,template:string,method:Method,op:Dict):OperationInfo|null {
  if(op["x-webdetector-safe-to-test"]!==true)return null;
  const extension=getObj(op,"x-webdetector-test");
  if(!["generic","authentication"].includes(String(extension.kind)))return null;
  const path=concretePath(doc,template,op);if(!path)return null;
  const fields=opFields(doc,op,method);
  if(!fields.length)return null;
  const baseline=parseFlatBaseline(extension.baseline);
  // Baseline explícita. Campos opcionais podem não estar presentes.
  // A documentação da aplicação deve incluir todos os campos obrigatórios no baseline.
  if(!Object.keys(baseline).length)return null;
  const rawAuth=getObj(extension,"auth");
  let auth:AuthContract|undefined;
  if(extension.kind==="authentication") {
    if(!["response","session"].includes(String(rawAuth.confirmation_mode)))return null;
    const success_fields=boolList(rawAuth.success_fields);
    const identity_fields=boolList(rawAuth.identity_fields);
    if(!success_fields.length||!identity_fields.length)return null;
    auth={success_fields,identity_fields,session_cookie_names:boolList(rawAuth.session_cookie_names),
      confirmation_mode:rawAuth.confirmation_mode as "response"|"session"};
  }
  return {method,path,summary:String(op.summary||path),fields,
    contract:{kind:extension.kind as "authentication"|"generic",baseline,auth,browser_xss:extension.browser_xss===true}};
}
async function openApi(baseUrl:string):Promise<Dict> {
  const base=localBase(baseUrl);
  for(const pathname of ["/openapi.json","/swagger.json","/api-docs.json","/api/openapi.json"]) {
    try {
      const response=await fetch(new URL(pathname,base),{redirect:"error",signal:AbortSignal.timeout(3500)});
      if(!response.ok)continue;
      const body:unknown=await response.json();
      if(isObject(body)&&isObject(body.paths))return body;
    } catch { /* outras rotas possíveis */ }
  }
  throw new Error("OpenAPI não encontrado. Disponibilize /openapi.json e documente as operações de laboratório.");
}
function operations(doc:Dict):OperationInfo[] {
  const paths=getObj(doc,"paths");
  const result:OperationInfo[]=[];
  for(const [template,defs] of Object.entries(paths)) {
    if(!isObject(defs))continue;
    for(const method of ["get","post"] as const) {
      if(!isObject(defs[method]))continue;
      try {const info=infoFromOp(doc,template,method.toUpperCase() as Method,defs[method] as Dict);if(info)result.push(info);} catch { /* operação inválida omitida da descoberta */ }
    }
  }
  return result;
}
function getTarget(baseUrl:string,info:OperationInfo,body:Record<string,string>):URL {
  const url=new URL(info.path,localBase(baseUrl));
  if(info.method==="GET")for(const [k,v] of Object.entries(body))url.searchParams.set(k,v);
  return url;
}
function hasIdentity(value:unknown):boolean {return Array.isArray(value)?value.length>0:isObject(value);}
function findCookieNames(response:Response,expected:string[]):string[] {
  const cookies=response.headers.getSetCookie?.()||[];
  return expected.filter(name=>cookies.some(cookie=>cookie.startsWith(`${name}=`)));
}
async function send(baseUrl:string,info:OperationInfo,body:Record<string,string>,field:string,needle:string,timeout:number):Promise<Evidence> {
  const started=performance.now();
  try {
    const url=getTarget(baseUrl,info,body);
    const response=await fetch(url,{method:info.method,redirect:"error",signal:AbortSignal.timeout(timeout),
      headers:{Accept:"application/json, text/html, text/plain",...(info.method==="POST"?{"Content-Type":"application/json"}:{})},
      body:info.method==="POST"?JSON.stringify(body):undefined});
    const contentType=response.headers.get("content-type")||"";
    const raw=(await response.text()).slice(0,14000);
    let data:Dict={};
    try{const decoded:unknown=JSON.parse(raw);if(isObject(decoded))data=decoded;}catch{/* não JSON */}
    const auth=info.contract.auth;
    const flags:Record<string,boolean>={};
    for(const name of auth?.success_fields||[])flags[name]=data[name]===true;
    const identity_fields_present=(auth?.identity_fields||[]).filter(name=>hasIdentity(data[name]));
    return {status:response.status,content_type:contentType,
      body_digest:createHash("sha256").update(raw).digest("hex").slice(0,20),
      payload_reflected:needle.length>0&&raw.includes(needle),flags,identity_fields_present,
      session_cookie_names:findCookieNames(response,auth?.session_cookie_names||[]),
      durationMs:Math.round(performance.now()-started)};
  } catch(error) {
    return {status:0,content_type:"",body_digest:"",payload_reflected:false,flags:{},identity_fields_present:[],
      session_cookie_names:[],durationMs:Math.round(performance.now()-started),error:error instanceof Error?error.message.slice(0,160):"Falha HTTP"};
  }
}
async function verifyXssInBrowser(baseUrl:string, info:OperationInfo,body:Record<string,string>, token:string):Promise<{checked:boolean;executed:boolean;error?:string}> {
  if(!info.contract.browser_xss||info.method!=="GET")return {checked:false,executed:false};
  if(process.env.WD_ENABLE_BROWSER_XSS!=="1")return {checked:false,executed:false,error:"Ative WD_ENABLE_BROWSER_XSS=1 e instale playwright/chromium para confirmação no navegador."};
  let browser:any;
  try {
    // Dependência opcional e isolada: npm install playwright && npx playwright install chromium
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {chromium}=require("playwright");
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext({ignoreHTTPSErrors:false});
    const url=getTarget(baseUrl,info,body);
    const page=await context.newPage();
    const origin=url.origin;
    await page.route("**/*",async (route:any)=>{
      const requested=route.request().url();
      if(requested.startsWith("data:")||requested.startsWith("about:"))return route.continue();
      try {if(new URL(requested).origin===origin)return route.continue();} catch{ /* URL inválida */ }
      return route.abort();
    });
    await page.goto(url.toString(),{waitUntil:"domcontentloaded",timeout:7000});
    await page.waitForTimeout(500);
    const executed=await page.evaluate((expected:string)=>(window as any).__webdetector_xss===expected,token);
    return {checked:true,executed};
  } catch(error) {
    return {checked:false,executed:false,error:error instanceof Error?error.message.slice(0,180):"Erro no Chromium"};
  } finally {if(browser)await browser.close();}
}
async function pythonAnalysis(input:Dict):Promise<Analysis> {
  const base=new URL(PYTHON);
  if(base.protocol!=="http:"||!["127.0.0.1","localhost"].includes(base.hostname))throw new Error("backendML deve ser local.");
  const response=await fetch(new URL("/api/ml/analyze",base),{method:"POST",redirect:"error",signal:AbortSignal.timeout(12000),
    headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
  if(!response.ok)throw new Error(`Falha na análise Python (HTTP ${response.status}).`);
  return await response.json() as Analysis;
}
const wait=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));

export class SecurityEvaluationService {
  async listScenarios() {
    const {data,error}=await supabase.from("scenarios").select("id,name,base_url,attack_types,max_requests,duration_seconds,interval_ms,request_timeout_ms").order("created_at",{ascending:false});
    if(error)throw error;return data||[];
  }
  async discoverRoutes(scenarioId:string) {
    const {data,error}=await supabase.from("scenarios").select("base_url").eq("id",scenarioId).single();
    if(error||!data)throw new Error("Cenário não encontrado.");
    return operations(await openApi(data.base_url)).map(({path,method,summary,fields,contract})=>({path,method,summary,fields,kind:contract.kind}));
  }
  async listRoutes(scenarioId:string) {
    const {data:scenario,error:se}=await supabase.from("scenarios").select("base_url").eq("id",scenarioId).single();
    if(se||!scenario)throw new Error("Cenário não encontrado.");
    const {data,error}=await supabase.from("scenario_routes").select("id,path,method,enabled").eq("scenario_id",scenarioId).eq("enabled",true);
    if(error)throw error;
    const infos=operations(await openApi(scenario.base_url));
    return (data||[]).map((route:{id:string;path:string;method:string;enabled:boolean})=>{const m=infos.find(i=>i.method===route.method&&i.path===route.path);
      return {...route,fields:m?.fields||[],kind:m?.contract.kind||null,valid:!!m};});
  }
  async selectRoute(scenarioId:string,path:string,method:Method) {
    if(!validPath(path))throw new Error("Rota inválida.");
    const list=await this.discoverRoutes(scenarioId);
    if(!list.some(r=>r.path===path&&r.method===method))throw new Error("Operação não autorizada no OpenAPI.");
    const {data:existing,error:e}=await supabase.from("scenario_routes").select("id").eq("scenario_id",scenarioId).eq("path",path).eq("method",method).maybeSingle();
    if(e)throw e;
    if(existing){const {error}=await supabase.from("scenario_routes").update({enabled:true}).eq("id",existing.id);if(error)throw error;return existing;}
    const {data,error}=await supabase.from("scenario_routes").insert({scenario_id:scenarioId,path,method,enabled:true}).select("id").single();
    if(error)throw error;return data;
  }
  async mlMetrics() {
    const url=new URL("/api/ml/metrics",PYTHON);
    const response=await fetch(url,{redirect:"error",signal:AbortSignal.timeout(6000)});
    if(!response.ok)throw new Error("Modelos não treinados ou backendML fora do ar.");
    return response.json();
  }
  async listRuns(scenarioId:string) {
    const {data,error}=await supabase.from("webdetector_assessments").select("id,created_at,report,outcome").eq("scenario_id",scenarioId).order("created_at",{ascending:false}).limit(30);
    if(error)throw error;return data||[];
  }
  async run({scenarioId,routeId,field,attackType}:{scenarioId:string;routeId:string;field:string;attackType:Attack}) {
    if(ACTIVE.has(scenarioId))throw new Error("Já existe avaliação em execução para este cenário.");
    ACTIVE.add(scenarioId);
    try {
      const {data:scenario,error:se}=await supabase.from("scenarios").select("id,base_url,attack_types,max_requests,duration_seconds,interval_ms,request_timeout_ms").eq("id",scenarioId).single();
      if(se||!scenario)throw new Error("Cenário não encontrado.");
      const attackName=attackType==="SQLI"?"SQL Injection":"XSS";
      if(!scenario.attack_types?.includes(attackName))throw new Error(`Habilite ${attackName} no cenário.`);
      const {data:route,error:re}=await supabase.from("scenario_routes").select("id,path,method,enabled").eq("id",routeId).eq("scenario_id",scenarioId).single();
      if(re||!route||!route.enabled)throw new Error("Operação não foi selecionada neste cenário.");
      const op=operations(await openApi(scenario.base_url)).find(x=>x.method===route.method&&x.path===route.path);
      if(!op)throw new Error("Operação removida ou não autorizada no OpenAPI atual.");
      if(!op.fields.includes(field))throw new Error("Campo não documentado no OpenAPI da operação.");
      const baseline={...op.contract.baseline};
      const maxRequests=Math.max(1,Math.min(100,Math.trunc(Number(scenario.max_requests)||20)));
      const interval=Math.max(1000,Math.min(10000,Number(scenario.interval_ms)||1000));
      const timeout=Math.max(1000,Math.min(8000,Number(scenario.request_timeout_ms)||5000));
      const deadline=Date.now()+Math.max(5,Math.min(120,Number(scenario.duration_seconds)||60))*1000;
      let sent=0;
      const sendLimited=async (data:Record<string,string>,needle:string):Promise<Evidence|null>=>{
        if(sent>=maxRequests||Date.now()>=deadline)return null;
        if(sent>0)await wait(Math.min(interval,Math.max(0,deadline-Date.now())));
        if(Date.now()>=deadline)return null;
        sent+=1;
        return send(scenario.base_url,op,data,field,needle,Math.min(timeout,Math.max(1,deadline-Date.now())));
      };
      const reference=await sendLimited(baseline,"");
      if(!reference)throw new Error("Não foi possível obter resposta de referência.");
      const results:Array<Dict>=[];
      if(reference.status!==429 && reference.status!==0) {
        const probes=attackType==="SQLI"
          ? SQLI_PROBES.map(p=>({name:p.name,payload:p.trueValue,falseValue:p.falseValue,token:""}))
          : xssPayloads(randomUUID().replace(/-/g,"")).map(p=>({name:p.name,payload:p.value,falseValue:null,token:(p.value.match(/__webdetector_xss='([^']+)'/)||[])[1]||""}));
        for(const probe of probes) {
          const needed=attackType==="SQLI"?2:1;
          if(sent+needed>maxRequests||Date.now()+interval*needed+200>=deadline)break;
          const falseCondition=attackType==="SQLI"?await sendLimited({...baseline,[field]:probe.falseValue!},probe.falseValue!):null;
          if(attackType==="SQLI"&&!falseCondition)break;
          if(falseCondition?.status===429)break;
          const requestBody={...baseline,[field]:probe.payload};
          const testResponse=await sendLimited(requestBody,probe.payload);
          if(!testResponse)break;
          const browser=attackType==="XSS"?await verifyXssInBrowser(scenario.base_url,op,requestBody,probe.token):{checked:false,executed:false};
          const analyzed=await pythonAnalysis({attackType,request:{method:op.method,path:op.path,field,payload:probe.payload},
            baseline:reference,falseCondition,testResponse,browser,contract:op.contract});
          results.push({name:probe.name,payload:probe.payload,outcome:analyzed.outcome,explanation:analyzed.explanation,
            ml:analyzed.ml,ml_error:analyzed.ml_error,signals:analyzed.signals,recommendations:analyzed.recommendations,
            falseCondition,testResponse,browser});
          if(testResponse.status===429||testResponse.status===0)break;
        }
      }
      const outcome:Outcome=results.some(r=>r.outcome==="confirmed")?"confirmed":
        results.some(r=>r.outcome==="suspected")?"suspected":
        results.some(r=>r.outcome==="inconclusive")||results.length===0?"inconclusive":"not_confirmed";
      const recommendations=results[0]?.recommendations||[];
      const report={attackType,route:{method:op.method,path:op.path},field,outcome,reference,sentRequests:sent,
        executedProbes:results.length,plannedProbes:attackType==="SQLI"?SQLI_PROBES.length:3,
        explanation:outcome==="confirmed"?"Ao menos um teste demonstrou a vulnerabilidade segundo evidências verificáveis.":
          outcome==="suspected"?"Há indícios, mas ainda não há prova suficiente de exploração.":
          outcome==="not_confirmed"?"Nenhum teste executado demonstrou vulnerabilidade; isso não comprova ausência de outras falhas.":
          "Respostas ou limites não permitiram concluir a avaliação.",
        results,recommendations};
      const {data:saved,error:saveError}=await supabase.from("webdetector_assessments")
        .insert({scenario_id:scenarioId,route_id:routeId,field,outcome,report})
        .select("id,created_at").single();
      if(saveError)throw new Error(`Falha ao salvar relatório: ${saveError.message}`);
      return {...report,id:saved.id,created_at:saved.created_at};
    } finally {ACTIVE.delete(scenarioId);}
  }
}
