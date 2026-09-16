import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import * as policy from "../lib/integrations/bkfc/logo-upload-policy.ts";
const metadata = () => ({ applicationId: randomUUID(), commandId: randomUUID(), version: "4", contentType: "image/png", size: 100, sha256: "a".repeat(64) });
function harness(options: { allowed?: boolean; enabled?: boolean; rpcError?: boolean; signingError?: boolean; existingObject?: boolean } = {}) {
  const calls: Array<{ name: string; args?: unknown }> = [];
  const actor = { id: randomUUID(), email: "operator@example.test" };
  const db = {
    rpc: async (name: string, args: Record<string,unknown>) => { calls.push({name,args}); return { data: `${args.p_application_id}/${args.p_command_id}`, error: options.rpcError ? {} : null }; },
    storage: { from: (bucket: string) => { calls.push({ name: "bucket", args: bucket }); return {
      download: async (path: string) => { calls.push({name:"download",args:path}); return {data:options.existingObject ? new Blob(["stored bytes"]) : null,error:options.existingObject ? null : {}}; },
      createSignedUploadUrl: async (path: string, settings: unknown) => { calls.push({name:"sign",args:{path,settings}}); return { data: { token: "upload-only-fixture-token" }, error: options.signingError ? {} : null }; },
    }; } },
  };
  const imports: Record<string,unknown> = {
    "@/lib/admin/auth": { requireAdminUser: async () => { calls.push({name:"authorize"}); if(options.allowed===false) throw new Error("UNAUTHORIZED"); return actor; } },
    "@/lib/admin/supabase": { createAdminSupabaseClient: () => db },
    "@/lib/config/server": { getBkfcIntegrationConfig: () => ({ gymControlDeliveryEnabled: options.enabled!==false }) },
    "@/lib/integrations/bkfc/logo-upload-policy": policy,
  };
  const source=readFileSync("app/admin/applications/[id]/logo-upload-actions.ts","utf8");
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{} as {prepareGymLogoUpload:(value:policy.LogoUploadMetadata)=>Promise<{path:string;token:string|null}>}};
  new Function("require","module","exports",compiled)((name:string)=>{assert.ok(name in imports,`Unexpected dependency ${name}`);return imports[name];},mod,mod.exports);
  return {action:mod.exports.prepareGymLogoUpload,calls,actor};
}
test("logo metadata accepts the full 10 MiB boundary and rejects larger/invalid metadata",()=>{
  assert.doesNotThrow(()=>policy.validateLogoUploadMetadata({...metadata(),size:policy.GYM_LOGO_MAX_BYTES}));
  for(const bad of [{size:policy.GYM_LOGO_MAX_BYTES+1},{size:0},{size:1.5},{sha256:"unknown"},{contentType:"image/svg+xml"},{version:""},{commandId:"../other-gym"}])
    assert.throws(()=>policy.validateLogoUploadMetadata({...metadata(),...bad}));
});
test("uploaded bytes must match size, signature type and the prepared digest",()=>{
  const intent={size_bytes:100,sha256:"a".repeat(64),content_type:"image/png"};
  assert.equal(policy.logoUploadMatches(100,"a".repeat(64),"image/png",intent),true);
  assert.equal(policy.logoUploadMatches(101,"a".repeat(64),"image/png",intent),false);
  assert.equal(policy.logoUploadMatches(100,"b".repeat(64),"image/png",intent),false);
  assert.equal(policy.logoUploadMatches(100,"a".repeat(64),"image/jpeg",intent),false);
});
test("actual upload preparation authorizes before database access and respects disabled controls",async()=>{
  for(const options of [{allowed:false},{enabled:false}]) {
    const h=harness(options); await assert.rejects(()=>h.action(metadata()));
    assert.deepEqual(h.calls,[{name:"authorize"}]);
  }
});
test("upload preparation signs only a server-derived immutable object for the authenticated actor",async()=>{
  const h=harness();const value=metadata();const result=await h.action(value);
  assert.equal(result.path,`${value.applicationId}/${value.commandId}`);
  assert.equal(result.token,"upload-only-fixture-token");
  assert.deepEqual(h.calls.map(c=>c.name),["authorize","prepare_bkfc_control_logo_upload","bucket","sign"]);
  assert.equal((h.calls[1].args as Record<string,unknown>).p_actor_user_id,h.actor.id);
  assert.equal(h.calls[2].args,"bkfc-control-logos");
  assert.deepEqual(h.calls[3].args,{path:result.path,settings:{upsert:false}});
});
test("validation and persistence failures never issue upload permission",async()=>{
  const invalid=harness();await assert.rejects(()=>invalid.action({...metadata(),size:0}));assert.equal(invalid.calls.length,1);
  const failed=harness({rpcError:true});await assert.rejects(()=>failed.action(metadata()));assert.equal(failed.calls.some(c=>c.name==="sign"),false);
  const signing=harness({signingError:true});await assert.rejects(()=>signing.action(metadata()));
});

test("existing immutable uploads can proceed to final verification without a new token",async()=>{
 const h=harness({signingError:true,existingObject:true});const value=metadata();const result=await h.action(value);
 assert.equal(result.token,null);assert.equal(result.path,`${value.applicationId}/${value.commandId}`);
 assert.equal(h.calls.filter(c=>c.name==="download").length,1);
 assert.equal(h.calls.at(-1)?.args,result.path);
});
