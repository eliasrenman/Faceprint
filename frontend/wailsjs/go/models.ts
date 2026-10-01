export namespace main {
	
	export class CreateTemplateRequest {
	    sourcePDFBase64: string;
	    options: tiling.TileOptions;
	
	    static createFrom(source: any = {}) {
	        return new CreateTemplateRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourcePDFBase64 = source["sourcePDFBase64"];
	        this.options = this.convertValues(source["options"], tiling.TileOptions);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class IntegrationSelfTestResult {
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
	    finishedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new IntegrationSelfTestResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.finished = source["finished"];
	        this.passed = source["passed"];
	        this.stage = source["stage"];
	        this.detail = source["detail"];
	        this.widthMM = source["widthMM"];
	        this.heightMM = source["heightMM"];
	        this.pageCount = source["pageCount"];
	        this.pdfRendered = source["pdfRendered"];
	        this.kernelOverrideUsed = source["kernelOverrideUsed"];
	        this.kernelDigest = source["kernelDigest"];
	        this.previewDigest = source["previewDigest"];
	        this.finishedAt = source["finishedAt"];
	    }
	}
	export class KernelOverride {
	    found: boolean;
	    base64: string;
	    digest: string;
	    source: string;
	
	    static createFrom(source: any = {}) {
	        return new KernelOverride(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.found = source["found"];
	        this.base64 = source["base64"];
	        this.digest = source["digest"];
	        this.source = source["source"];
	    }
	}
	export class ModelFile {
	    filename: string;
	    base64: string;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new ModelFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filename = source["filename"];
	        this.base64 = source["base64"];
	        this.size = source["size"];
	    }
	}
	export class PreviewResponse {
	    previewID: string;
	    digest: string;
	    pdfBase64: string;
	    info: pdfinfo.Info;
	
	    static createFrom(source: any = {}) {
	        return new PreviewResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.previewID = source["previewID"];
	        this.digest = source["digest"];
	        this.pdfBase64 = source["pdfBase64"];
	        this.info = this.convertValues(source["info"], pdfinfo.Info);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SaveTemplateRequest {
	    previewID: string;
	    suggestedName: string;
	
	    static createFrom(source: any = {}) {
	        return new SaveTemplateRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.previewID = source["previewID"];
	        this.suggestedName = source["suggestedName"];
	    }
	}
	export class SaveTemplateResponse {
	    saved: boolean;
	    filename: string;
	
	    static createFrom(source: any = {}) {
	        return new SaveTemplateResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.saved = source["saved"];
	        this.filename = source["filename"];
	    }
	}

}

export namespace pdfinfo {
	
	export class Info {
	    pageCount: number;
	    pageWidthMM: number;
	    pageHeightMM: number;
	    resolvedOrientation: string;
	
	    static createFrom(source: any = {}) {
	        return new Info(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pageCount = source["pageCount"];
	        this.pageWidthMM = source["pageWidthMM"];
	        this.pageHeightMM = source["pageHeightMM"];
	        this.resolvedOrientation = source["resolvedOrientation"];
	    }
	}

}

export namespace tiling {
	
	export class TileOptions {
	    paper: string;
	    orientation: string;
	    marginMM: number;
	    fullPage: boolean;
	
	    static createFrom(source: any = {}) {
	        return new TileOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.paper = source["paper"];
	        this.orientation = source["orientation"];
	        this.marginMM = source["marginMM"];
	        this.fullPage = source["fullPage"];
	    }
	}

}

