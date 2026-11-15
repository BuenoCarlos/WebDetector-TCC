import { Router } from "express";
import { z } from "zod";
import { SecurityEvaluationService } from "../services/securityEvaluationService";

const router=Router();
const service=new SecurityEvaluationService();
const uuid=z.uuid();
const method=z.enum(["GET","POST"]);
const runSchema=z.object({scenarioId:uuid,routeId:uuid,field:z.string().min(1).max(80),attackType:z.enum(["SQLI","XSS"])});

router.use((req,res,next)=>{
  const remote=req.socket.remoteAddress||"";
  if(!["127.0.0.1","::1","::ffff:127.0.0.1"].includes(remote)) {
    res.status(403).json({error:"O módulo de testes ativos aceita apenas conexões locais."});return;
  }
  next();
});
const failure=(res:any,error:unknown,code=400)=>res.status(code).json({error:error instanceof Error?error.message:"Erro ao processar solicitação."});

router.get("/security/ml-metrics",async(_req,res)=>{try{res.json(await service.mlMetrics());}catch(e){failure(res,e,503);}});
router.get("/security/scenarios",async(_req,res)=>{try{res.json(await service.listScenarios());}catch(e){failure(res,e,500);}});
router.get("/security/scenarios/:id/discover",async(req,res)=>{
  const id=uuid.safeParse(req.params.id);if(!id.success){failure(res,new Error("ID inválido."));return;}
  try{res.json(await service.discoverRoutes(id.data));}catch(e){failure(res,e);}
});
router.get("/security/scenarios/:id/routes",async(req,res)=>{
  const id=uuid.safeParse(req.params.id);if(!id.success){failure(res,new Error("ID inválido."));return;}
  try{res.json(await service.listRoutes(id.data));}catch(e){failure(res,e);}
});
router.post("/security/scenarios/:id/select-route",async(req,res)=>{
  const id=uuid.safeParse(req.params.id);
  const input=z.object({path:z.string().min(2).max(220),method}).safeParse(req.body);
  if(!id.success||!input.success){failure(res,new Error("Dados inválidos."));return;}
  try{res.json(await service.selectRoute(id.data,input.data.path,input.data.method));}catch(e){failure(res,e);}
});
router.get("/security/scenarios/:id/reports",async(req,res)=>{
  const id=uuid.safeParse(req.params.id);if(!id.success){failure(res,new Error("ID inválido."));return;}
  try{res.json(await service.listRuns(id.data));}catch(e){failure(res,e,500);}
});
router.post("/security/evaluate",async(req,res)=>{
  const input=runSchema.safeParse(req.body);
  if(!input.success){failure(res,new Error("Informe cenário, rota, campo e SQLI ou XSS."));return;}
  try{res.json(await service.run(input.data));}catch(e){failure(res,e);}
});
export default router;
