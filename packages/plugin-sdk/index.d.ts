export interface MobixPlugin {name:string;version:string;protocol:1;methods:Record<string,(params:unknown)=>Promise<unknown>>;permissions?:string[]}
export interface MobixPluginContext {platform:'android'|'ios'|'web';isAvailable(name:string):boolean}
export interface MobixPluginRegistry {register(plugin:MobixPlugin):void;get(name:string):MobixPlugin|undefined;list():string[]}

export function createRegistry(): MobixPluginRegistry;
