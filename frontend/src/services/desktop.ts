import {
  CreateTemplate as createTemplateBinding,
  DiscardTemplate as discardTemplateBinding,
  GetKernelOverride as getKernelOverrideBinding,
  IntegrationSelfTestEnabled as integrationSelfTestEnabledBinding,
  OpenModel as openModelBinding,
  RecordIntegrationSelfTest as recordIntegrationSelfTestBinding,
  SaveTemplate as saveTemplateBinding,
} from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';
import { base64ToArrayBuffer } from './transport';

export type Paper = 'A4' | 'A3' | 'A2';
export type Orientation = 'auto' | 'portrait' | 'landscape';

export interface TileOptions {
  paper: Paper;
  orientation: Orientation;
  marginMM: number;
  fullPage: boolean;
}

export interface OpenedModel {
  filename: string;
  bytes: ArrayBuffer;
}

export interface PreviewResult {
  previewID: string;
  digest: string;
  pdfBase64: string;
  info: {
    pageCount: number;
    pageWidthMM: number;
    pageHeightMM: number;
    resolvedOrientation: 'portrait' | 'landscape';
  };
}

export interface IntegrationSelfTestResult {
  finished: boolean;
  passed: boolean;
  stage: string;
  detail: string;
  widthMM: number;
  heightMM: number;
  pageCount: number;
  pdfRendered: boolean;
  kernelOverrideUsed: boolean;
  kernelDigest: string;
  previewDigest: string;
}

export async function getKernelOverride(): Promise<{ found: boolean; bytes?: ArrayBuffer; digest?: string }> {
  const result = (await getKernelOverrideBinding()) as unknown as { found: boolean; base64: string; digest: string };
  return result.found
    ? { found: true, bytes: base64ToArrayBuffer(result.base64), digest: result.digest }
    : { found: false };
}

export async function integrationSelfTestEnabled(): Promise<boolean> {
  return integrationSelfTestEnabledBinding();
}

export async function recordIntegrationSelfTest(result: IntegrationSelfTestResult): Promise<void> {
  await recordIntegrationSelfTestBinding(new main.IntegrationSelfTestResult(result));
}

export async function openModel(): Promise<OpenedModel | undefined> {
  const result = (await openModelBinding()) as unknown as { filename: string; base64: string; size: number };
  if (!result.filename) return undefined;
  return { filename: result.filename, bytes: base64ToArrayBuffer(result.base64) };
}

export async function createTemplate(sourcePDFBase64: string, options: TileOptions): Promise<PreviewResult> {
  return (await createTemplateBinding(new main.CreateTemplateRequest({ sourcePDFBase64, options }))) as unknown as PreviewResult;
}

export async function saveTemplate(previewID: string, suggestedName: string): Promise<{ saved: boolean; filename: string }> {
  return (await saveTemplateBinding(new main.SaveTemplateRequest({ previewID, suggestedName }))) as unknown as { saved: boolean; filename: string };
}

export async function discardTemplate(previewID: string): Promise<void> {
  await discardTemplateBinding(previewID);
}

export async function modelFromDroppedFile(file: File): Promise<OpenedModel> {
  if (!/\.(step|stp)$/i.test(file.name)) throw new Error('Choose a .step or .stp file');
  if (file.size > 100 * 1024 * 1024) throw new Error('STEP file exceeds the 100 MiB limit');
  return { filename: file.name, bytes: await file.arrayBuffer() };
}
