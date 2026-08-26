import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PIPELINE_WORKFLOW_MIGRATION_REQUIRED_MESSAGE,
  pipelineActionErrorState,
  validatePipelineActionInput,
} from "../lib/admin/pipeline-action.ts";

const applicationId = "73083c14-e650-43f4-92ea-b7b31f7ec01a";

test("activation payment guard maps to a friendly administrator message", () => {
  const state = pipelineActionErrorState(
    new Error("ACTIVATION_REQUIRES_APPROVED_AND_PAID"),
  );

  assert.deepEqual(state, {
    message: "This affiliate cannot be activated until BKFC confirms payment.",
    status: "error",
  });
  assert.doesNotMatch(state.message, /ACTIVATION_REQUIRES_APPROVED_AND_PAID/);
});

test("pipeline action errors preserve safe migration guidance and sanitize failures", () => {
  assert.deepEqual(
    pipelineActionErrorState(new Error(PIPELINE_WORKFLOW_MIGRATION_REQUIRED_MESSAGE)),
    { message: PIPELINE_WORKFLOW_MIGRATION_REQUIRED_MESSAGE, status: "error" },
  );
  assert.deepEqual(
    pipelineActionErrorState(new Error("relation private_table does not exist")),
    { message: "Unable to update the application workflow.", status: "error" },
  );
  assert.deepEqual(
    pipelineActionErrorState({ message: "database credentials leaked" }),
    { message: "Unable to update the application workflow.", status: "error" },
  );
});

test("pipeline action validation returns safe inline error states", () => {
  assert.deepEqual(
    validatePipelineActionInput({
      applicationId: "not-an-id",
      reviewStage: "approved",
      status: "approved",
    }),
    { message: "Invalid application id.", status: "error" },
  );
  assert.deepEqual(
    validatePipelineActionInput({ applicationId, reviewStage: "unknown", status: "approved" }),
    { message: "Invalid review stage selected.", status: "error" },
  );
  assert.deepEqual(
    validatePipelineActionInput({ applicationId, reviewStage: "approved", status: "unknown" }),
    { message: "Invalid application status selected.", status: "error" },
  );
  assert.equal(
    validatePipelineActionInput({
      applicationId,
      reviewStage: "activated_affiliate",
      status: "active",
    }),
    null,
  );
});

test("rejected actions return state before redirect while successful actions still redirect", async () => {
  const actions = await readFile("app/admin/applications/[id]/actions.ts", "utf8");
  const start = actions.indexOf("export async function triggerPipelineAction");
  const end = actions.indexOf("export async function createInformationRequestAction", start);
  const pipelineAction = actions.slice(start, end);

  assert.match(pipelineAction, /catch \(error\) \{\s*return pipelineActionErrorState\(error\);\s*\}/);
  assert.match(
    pipelineAction,
    /catch \(error\)[\s\S]*redirect\(`\/admin\/applications\/\$\{applicationId\}`\);/,
  );
  assert.ok(
    pipelineAction.indexOf("pipelineActionErrorState(error)") < pipelineAction.indexOf("redirect("),
  );
});

test("Pipeline Actions renders isolated accessible state and pending controls", async () => {
  const [panel, form] = await Promise.all([
    readFile("components/admin/PipelineActionsPanel.tsx", "utf8"),
    readFile("components/admin/PipelineActionForm.tsx", "utf8"),
  ]);

  assert.match(panel, /<PipelineActionForm/);
  assert.match(panel, /pendingLabel: "Activating affiliate\.\.\."/);
  assert.match(form, /useFormState\(action, initialState\)/);
  assert.match(form, /useFormStatus\(\)/);
  assert.match(form, /disabled=\{pending\}/);
  assert.match(form, /role=\{state\.status === "error" \? "alert" : "status"\}/);
  assert.match(form, /\{state\.message\}/);
});
