import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
import {createElement,Fragment} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {transformWithEsbuild,type Plugin} from "vite";

function publicText(markup:string):string{
  // Preview iframes contain fictitious reservations and sample guest answers.
  // They are illustrations, never commercial knowledge for the sales agent.
  return markup.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi," ")
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi," ")
    .replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&")
    .replace(/&quot;/gi,'"').replace(/&#x27;|&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/\s+/g," ").trim();
}

/** Emit a public text rendition from the same React content used by the site.
 * No duplicate editorial copy and no server/browser required at query time. */
export function landingKnowledgePlugin():Plugin{
  return {name:"pingo-public-landing-knowledge",apply:"build",async generateBundle(){
    const path=resolve(process.cwd(),"src/pages/LandingContent.tsx");
    const source=await readFile(path,"utf8");
    const compiled=await transformWithEsbuild(source,path,{loader:"tsx",jsx:"automatic",format:"esm"});
    const runtime=import.meta.resolve("react/jsx-runtime");
    const code=compiled.code.replace(/from ["']react\/jsx-runtime["']/g,"from "+JSON.stringify(runtime));
    const component=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
    const languages:Record<string,string>={};
    for(const lang of ["es","en"] as const){
      languages[lang]=publicText(renderToStaticMarkup(createElement(Fragment,null,
        createElement(component.LandingContent,{lang}),createElement(component.LandingFinal,{lang}))));
      if(languages[lang].length<500)throw Error("PUBLIC_LANDING_KNOWLEDGE_EMPTY");
    }
    this.emitFile({type:"asset",fileName:"pingo-commercial-knowledge.json",source:JSON.stringify({
      schemaVersion:1,source:"https://www.pin-ngo.com/",builtAt:new Date().toISOString(),
      contentVersion:createHash("sha256").update(source).digest("hex"),
      authority:"Public marketing content. Confirm current prices and operational capabilities with the Pin&Go backend.",languages,
    })});
  }};
}
